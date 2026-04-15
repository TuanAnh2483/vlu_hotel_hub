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

        List<Long> hotelIds = hotels.stream()
                .map(Hotel::getId)
                .toList();

        // Lay toan bo room type dang active cua cac hotel candidate.
        // Tu day tro di, ta danh gia o muc HOTEL, khong con o muc tung room type rieng le.
        List<Room> activeRooms = roomRepository.findByHotelIdInAndStatus(hotelIds, RoomStatus.ACTIVE);

        // Gom room type theo hotel de co the tra loi cau hoi:
        // "voi tat ca room hien co, hotel nay co dap ung duoc request hay khong?"
        Map<Long, List<Room>> roomsByHotelId = activeRooms.stream()
                .collect(Collectors.groupingBy(room -> room.getHotel().getId()));

        // Chi giu lai hotel nao dap ung dong thoi:
        // - du so phong user yeu cau
        // - tong suc chua cua cac phong duoc chon >= adults user yeu cau
        return hotels.stream()
                .filter(hotel -> canSatisfyStay(roomsByHotelId.getOrDefault(hotel.getId(), List.of()), criteria))
                .toList();
    }

    public Long findMinPriceForStay(Hotel hotel, HotelStayCriteria criteria) {
        if (hotel == null || !hasValidStayRequest(criteria)) {
            return null;
        }

        return findAvailableRoomQuotes(hotel, criteria).stream()
                .map(RoomStayQuote::stayPrice)
                .min(Long::compareTo)
                .orElse(null);
    }

    private int availableUnitsForStay(Room room, HotelStayCriteria criteria) {
        // Inventory duoc luu theo tung ngay.
        // Muon biet room type nay con bao nhieu phong cho ca ky o,
        // ta phai load toan bo inventory trong [checkIn, checkOut).
        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                criteria.checkIn(),
                criteria.checkOut().minusDays(1)
        );

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

    private boolean canSatisfyStay(List<Room> rooms, HotelStayCriteria criteria) {
        // Khong co room active nao thi chac chan fail.
        if (rooms.isEmpty()) {
            return false;
        }

        // Quy doi moi room type thanh 2 thong tin can cho bai toan search:
        // - capacity: moi phong cua room type nay chua duoc bao nhieu nguoi
        // - availableUnits: room type nay con bao nhieu phong cho tron ky o
        List<RoomStayOption> options = rooms.stream()
                .map(roommap -> new RoomStayOption(roommap.getCapacity(), availableUnitsForStay(roommap, criteria)))
                .filter(option -> option.availableUnits() > 0)
                .toList();

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

    private record RoomStayOption(int capacity, int availableUnits) {
    }


    /// Với mỗi room khả dụng tính tổng giá của kỳ ở
    ///
    private Long calculateRoomStayPrice(Room room, HotelStayCriteria criteria) {
        long night = ChronoUnit.DAYS.between(criteria.checkIn(), criteria.checkOut());
        if (night <= 0) {
            return null;
        }
        List<DailyRate> dailyRates = dailyRateRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                criteria.checkIn(),
                criteria.checkOut().minusDays(1)
        );
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

    private RoomStayQuote evaluateRoomStayForStay(Room room, HotelStayCriteria criteria) {
        int availableUnit = availableUnitsForStay(room, criteria);
        if (availableUnit <= 0) {
            return null;
        }
        Long stayPrice = calculateRoomStayPrice(room, criteria);
        if (stayPrice == null) {
            return null;
        }


        return new RoomStayQuote(room, availableUnit, stayPrice);
    }


    /// method trả ở mức room_type
    private List<RoomStayQuote> findAvailableRoomQuotes(Hotel hotel, HotelStayCriteria criteria) {
        if (hotel == null || !hasValidStayRequest(criteria)) {
            return List.of();
        }

        List<Room> activeRooms = roomRepository.findByHotelIdInAndStatus(
                List.of(hotel.getId()),
                RoomStatus.ACTIVE
        );

        List<RoomStayQuote> quotes = new ArrayList<>();
        for (Room room : activeRooms) {
            RoomStayQuote quote = evaluateRoomStayForStay(room, criteria);
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

    private HotelAvailableRoomItemResponse toAvailableRoomItemResponse(RoomStayQuote quote) {
        return new HotelAvailableRoomItemResponse(
                quote.room().getId(),
                quote.room().getName(),
                quote.room().getCapacity(),
                quote.availableUnits(),
                quote.stayPrice()
        );
    }

    public List<HotelAvailableRoomItemResponse> findAvailableRoomItems(Hotel hotel, HotelStayCriteria criteria) {
        return findAvailableRoomQuotes(hotel, criteria).stream()
                .map(this::toAvailableRoomItemResponse)
                .toList();
    }




}
