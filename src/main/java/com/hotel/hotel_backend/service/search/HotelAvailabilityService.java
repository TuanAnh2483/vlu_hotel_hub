package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.dto.response.HotelAvailableRoomItemResponse;
import com.hotel.hotel_backend.entity.*;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HotelAvailabilityService {

    private final RoomRepository roomRepository;
    private final DailyInventoryRepository dailyInventoryRepository;
    private final DailyRateRepository dailyRateRepository;

    public List<Hotel> filterAvailableHotels(List<Hotel> hotels, HotelStayCriteria criteria) {
        // Khong co candidate hotel thi khong can lam them buoc nao nua.
        if (hotels.isEmpty()) {
            return List.of();
        }

        // Service van tu phong thu lai request shape, du boundary validation da xu ly o DTO. +
        if (!hasValidStayRequest(criteria)) {
            return List.of();
        }

        StayEvaluationContext context = buildStayEvaluationContext(hotels, criteria);

        // Chi giu lai hotel nao dap ung dong thoi:
        // - du so phong user yeu cau
        // - tong suc chua cua cac phong duoc chon >= adults user yeu cau
        return hotels.stream()
                .filter(hotel -> evaluateHotelForSearch(
                        context.roomsByHotelId().getOrDefault(hotel.getId(), List.of()),
                        criteria,
                        context
                ).canSatisfyStay())
                .toList();
    }

    public Long findMinPriceForStay(Hotel hotel, HotelStayCriteria criteria) {
        if (hotel == null || !hasValidStayRequest(criteria)) {
            return null;
        }

        StayEvaluationContext context = buildStayEvaluationContext(List.of(hotel), criteria);
        HotelStaySummary summary = evaluateHotelForSearch(
                context.roomsByHotelId().getOrDefault(hotel.getId(), List.of()),
                criteria,
                context
        );

        return summary.canSatisfyStay() ? summary.minPrice() : null;
    }


    /// 8 List <Hotel></>  này có có hotel nào pass search & minprice
    public Map<Long, Long> findAvailableHotelMinPrices(List<Hotel> hotels, HotelStayCriteria criteria) {
        if (hotels.isEmpty() || !hasValidStayRequest(criteria)) {
            return Map.of();
        }

        StayEvaluationContext context = buildStayEvaluationContext(hotels, criteria);
        Map<Long, Long> minPricesByHotelId = new LinkedHashMap<>();

        for (Hotel hotel : hotels) {
            List<Room> rooms = context.roomsByHotelId().getOrDefault(hotel.getId(), List.of());
            HotelStaySummary summary = evaluateHotelForSearch(rooms, criteria, context);
            if (!summary.canSatisfyStay()) {
                continue;
            }

            minPricesByHotelId.put(hotel.getId(), summary.minPrice());
        }

        return minPricesByHotelId;
    }


    ///2 room co san la bao nhieu
    private int availableUnitsForStay(
            Room room,
            HotelStayCriteria criteria,
            Map<Long, List<DailyInventory>> inventoriesByRoomId
    ) {
        // Inventory duoc luu theo tung ngay.
        // Muon biet room type nay con bao nhieu phong cho ca ky o,
        // ta phai load toan bo inventory trong [checkIn, checkOut).
        List<DailyInventory> inventories = inventoriesByRoomId.getOrDefault(room.getId(), List.of());

        long nights = ChronoUnit.DAYS.between(criteria.checkIn(), criteria.checkOut());

        // Thieu bat ky ngay nao trong ky o thi room type nay khong cover duoc stay.
        if (inventories.size() != nights) {
            return 0;
        }

        // So phong co the ban cho ca ky o la muc thap nhat con lai giua cac ngay.
        // Vi chi can 1 ngay khong du phong, room type nay khong the bao tron stay.
        return inventories.stream()
                .mapToInt(inv -> inv.getAvailableRooms() - inv.getBlockedRooms())
                .min()
                .orElse(0);
    }


    private record RoomStayOption(int capacity, int availableUnits) {
    }

    private record HotelStaySummary(boolean canSatisfyStay, Long minPrice) {
    }

    /// 7 Hotel nay có đủ rooms + capacity để cover booking hay không
    private boolean canSatisfyStay(List<RoomStayOption> options, HotelStayCriteria criteria) {
        if (options.isEmpty()) {
            return false;
        }

        // Tong so phong available cua hotel phai du lon de cover request rooms.
        int totalAvailableRooms = options.stream()
                .mapToInt(opt -> opt.availableUnits())
                .sum();

        if (totalAvailableRooms < criteria.rooms()) {
            return false;
        }

        // De toi da hoa suc chua voi cung so phong user yeu cau,
        // uu tien lay phong co capacity lon truoc.
        List<RoomStayOption> optionsSorted = options.stream()
                .sorted(Comparator.comparingInt(RoomStayOption::capacity).reversed())
                .toList();

        int roomsRemaining = criteria.rooms();
        int coveredAdults = 0;

        for (RoomStayOption option : optionsSorted) {
            if (roomsRemaining == 0) {
                break;
            }

            // Tu room type hien tai, lay toi da so phong con thieu.
            int roomsToTake = Math.min(option.availableUnits(), roomsRemaining);
            coveredAdults += roomsToTake * option.capacity();
            roomsRemaining -= roomsToTake;
        }

        // Hotel chi pass khi:
        // - da lay du so phong
        // - tong suc chua cua so phong do du de chua adults request
        return roomsRemaining == 0 && coveredAdults >= criteria.adults();
    }

    private boolean hasValidStayRequest(HotelStayCriteria criteria) {
        return criteria.checkIn() != null
                && criteria.checkOut() != null
                && criteria.checkOut().isAfter(criteria.checkIn())
                && criteria.rooms() != null
                && criteria.rooms() > 0
                && criteria.adults() != null
                && criteria.adults() > 0;
    }




    /// 3 Với mỗi room khả dụng tính tổng giá của kỳ ở
    ///
    private Long calculateRoomStayPrice(
            Room room,
            HotelStayCriteria criteria,
            Map<Long, List<DailyRate>> ratesByRoomId
    ) {
        long night = ChronoUnit.DAYS.between(criteria.checkIn(), criteria.checkOut());
        if (night <= 0) {
            return null;
        }
        List<DailyRate> dailyRates = ratesByRoomId.getOrDefault(room.getId(), List.of());
        Map<LocalDate, DailyRate> ratesByDate = dailyRates.stream()
                .collect(Collectors.toMap(rate -> rate.getId().date(), rate -> rate));


        //loop checkIn<checkOut
        long totalPrice = 0;

        for (LocalDate date = criteria.checkIn();
             date.isBefore(criteria.checkOut());
             date = date.plusDays(1)) {
            DailyRate rate = ratesByDate.get(date);
            if (rate == null) {
                totalPrice += room.getPrice();
                continue;
            }

            if (rate.isClosed()) {
                return null;
            }

            if (rate.getMinStay() != null && rate.getMinStay() > night) {
                return null;

            }
            totalPrice += rate.getPrice();
        }
        return totalPrice;
    }

    private record RoomStayQuote(Room room, int availableUnits, long stayPrice) {
        int capacity(){
            return room.getCapacity();
        }
    }

    public record BookableRoomStay(
            Long roomId,
            int availableUnits,
            long stayPrice
    ) {
    }


    /// 5 Room nao ban dc
    private RoomStayQuote evaluateRoomStayForStay(
            Room room,
            HotelStayCriteria criteria,
            StayEvaluationContext context
    ) {
        int availableUnit = availableUnitsForStay(room, criteria, context.inventoriesByRoomId());
        if (availableUnit <= 0) {
            return null;
        }
        Long stayPrice = calculateRoomStayPrice(room, criteria, context.ratesByRoomId());
        if (stayPrice == null) {
            return null;
        }


        return new RoomStayQuote(room, availableUnit, stayPrice);
    }


    private HotelStaySummary evaluateHotelForSearch(
            List<Room> rooms,
            HotelStayCriteria criteria,
            StayEvaluationContext context
    ) {
        if (rooms.isEmpty()) {
            return new HotelStaySummary(false, null);
        }

        List<RoomStayOption> options = new ArrayList<>();
        Long minPrice = null;

        for (Room room : rooms) {
            int availableUnits = availableUnitsForStay(room, criteria, context.inventoriesByRoomId());
            if (availableUnits <= 0) {
                continue;
            }

            options.add(new RoomStayOption(room.getCapacity(), availableUnits));

            Long stayPrice = calculateRoomStayPrice(room, criteria, context.ratesByRoomId());
            if (stayPrice != null && (minPrice == null || stayPrice < minPrice)) {
                minPrice = stayPrice;
            }
        }

        return new HotelStaySummary(canSatisfyStay(options, criteria), minPrice);
    }

    /// 6 room nao hop le trong List<RoomStayQuote>
    private List<RoomStayQuote> buildRoomStayQuotes(
            List<Room> rooms,
            HotelStayCriteria criteria,
            StayEvaluationContext context
    ) {
        if (rooms.isEmpty()) {
            return List.of();
        }

        List<RoomStayQuote> quotes = new ArrayList<>();
        for (Room room : rooms) {
            RoomStayQuote quote = evaluateRoomStayForStay(room, criteria, context);
            if (quote != null) {
                quotes.add(quote);
            }
        }

        quotes.sort(
                Comparator.comparingLong(RoomStayQuote::stayPrice)
                        .thenComparing(Comparator.comparingInt(RoomStayQuote::capacity).reversed())
        );

        return quotes;

    }

    private record StayEvaluationContext(
            Map<Long, List<Room>> roomsByHotelId,
            Map<Long, List<DailyInventory>> inventoriesByRoomId,
            Map<Long, List<DailyRate>> ratesByRoomId
    ) {
    }





    private StayEvaluationContext buildStayEvaluationContext(List<Hotel> hotels, HotelStayCriteria criteria) {
        if (hotels.isEmpty() || !hasValidStayRequest(criteria)) {
            return new StayEvaluationContext(Map.of(), Map.of(), Map.of());
        }

        List<Long> hotelIds = hotels.stream()
                .map(Hotel::getId)
                .toList();
        // ROOM ACTIVE
        List<Room> activeRooms = roomRepository.findByHotelIdInAndStatus(hotelIds, RoomStatus.ACTIVE);
        activeRooms = activeRooms.stream()
                .filter(room -> matchesRoomFilters(room, criteria))
                .toList();


        ///  LAY PHONG BY hotelId
        Map<Long, List<Room>> roomsByHotelId = activeRooms.stream()
                .collect(Collectors.groupingBy(room -> room.getHotel().getId()));


        List<Long> roomIds = activeRooms.stream()
                .map(Room::getId)
                .toList();

        if (roomIds.isEmpty()) {
            return new StayEvaluationContext(roomsByHotelId, Map.of(), Map.of());
        }

        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdInAndIdDateBetween(
                roomIds,
                criteria.checkIn(),
                criteria.checkOut().minusDays(1)
        );

        //kiemTra kho theo roomId
        Map<Long, List<DailyInventory>> inventoriesByRoomId = inventories.stream()
                .collect(Collectors.groupingBy(inventory -> inventory.getId().getRoomId()));


        List<DailyRate> rates = dailyRateRepository.findByIdRoomIdInAndIdDateBetween(
                roomIds,
                criteria.checkIn(),
                criteria.checkOut().minusDays(1)
        );

        //kiemTra gia theo roomId
        Map<Long, List<DailyRate>> ratesByRoomId = rates.stream()
                .collect(Collectors.groupingBy(rate -> rate.getId().roomId()));

        return new StayEvaluationContext(roomsByHotelId, inventoriesByRoomId, ratesByRoomId);
    }

    private boolean matchesRoomFilters(Room room, HotelStayCriteria criteria) {
        if (!criteria.roomCategories().isEmpty() && !criteria.roomCategories().contains(room.getRoomCategory())) {
            return false;
        }

        if (!criteria.bedTypes().isEmpty() && !criteria.bedTypes().contains(room.getBedType())) {
            return false;
        }

        return criteria.roomAmenities().isEmpty() || room.getAmenities().containsAll(criteria.roomAmenities());
    }

    private HotelAvailableRoomItemResponse toAvailableRoomItemResponse(RoomStayQuote quote) {
        return new HotelAvailableRoomItemResponse(
                quote.room().getId(),
                quote.room().getName(),
                quote.room().getCapacity(),
                quote.availableUnits(),
                quote.stayPrice()
        );
    }
    /// 9 hotel này có roomItems nào sẽ trả ra API detail ?
    public List<HotelAvailableRoomItemResponse> findAvailableRoomItems(Hotel hotel, HotelStayCriteria criteria) {
        if (hotel == null || !hasValidStayRequest(criteria)) {
            return List.of();
        }

        StayEvaluationContext context = buildStayEvaluationContext(List.of(hotel), criteria);
        List<Room> rooms = context.roomsByHotelId().getOrDefault(hotel.getId(), List.of());

        return buildRoomStayQuotes(rooms, criteria, context).stream()
                .map(this::toAvailableRoomItemResponse)
                .toList();
    }

    public Map<Long, BookableRoomStay> findBookableRoomStays(List<Room> rooms, HotelStayCriteria criteria) {
        if (rooms == null || rooms.isEmpty() || criteria == null
                || criteria.checkIn() == null || criteria.checkOut() == null
                || !criteria.checkOut().isAfter(criteria.checkIn())) {
            return Map.of();
        }

        List<Hotel> hotels = rooms.stream()
                .map(Room::getHotel)
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Hotel::getId, hotel -> hotel, (left, right) -> left, LinkedHashMap::new))
                .values()
                .stream()
                .toList();

        StayEvaluationContext context = buildStayEvaluationContext(
                hotels,
                new HotelStayCriteria(criteria.checkIn(), criteria.checkOut(), 1, 1, criteria.roomCategories(), criteria.bedTypes(), criteria.roomAmenities())
        );

        Map<Long, BookableRoomStay> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            RoomStayQuote quote = evaluateRoomStayForStay(
                    room,
                    new HotelStayCriteria(criteria.checkIn(), criteria.checkOut(), 1, 1, criteria.roomCategories(), criteria.bedTypes(), criteria.roomAmenities()),
                    context
            );
            if (quote != null) {
                result.put(room.getId(), new BookableRoomStay(room.getId(), quote.availableUnits(), quote.stayPrice()));
            }
        }

        return result;
    }




}
