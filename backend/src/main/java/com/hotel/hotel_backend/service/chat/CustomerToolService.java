package com.hotel.hotel_backend.service.chat;

import com.hotel.hotel_backend.dto.request.BookingContactRequest;
import com.hotel.hotel_backend.dto.request.BookingRoomRequest;
import com.hotel.hotel_backend.dto.request.CreateBookingRequest;
import com.hotel.hotel_backend.dto.response.BookingResponse;
import com.hotel.hotel_backend.dto.response.HotelAvailableRoomItemResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelStatus;
import com.hotel.hotel_backend.entity.UserProfile;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.UserProfileRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import com.hotel.hotel_backend.service.BookingService;
import com.hotel.hotel_backend.service.LocationNormalizer;
import com.hotel.hotel_backend.service.SecurityService;
import com.hotel.hotel_backend.service.search.HotelAvailabilityService;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asDate;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asDouble;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asInt;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asLong;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asString;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.asStringList;
import static com.hotel.hotel_backend.service.chat.ChatJsonUtil.obj;

/**
 * Thực thi customer tool. Tái dùng {@link HotelAvailabilityService}/{@link BookingService} và các
 * repository sẵn có thay cho raw SQL. Mỗi tool trả về một Map sẽ được serialize làm functionResponse.
 *
 * <p>Tool đọc chạy trong 1 transaction readOnly ({@link #executeRead}); tool ghi (huỷ/giữ phòng) KHÔNG
 * bọc trong transaction đó — uỷ quyền cho {@link BookingService} tự quản lý tx (giữ nguyên cơ chế
 * retry optimistic-lock của createBooking).
 */
@Service
@RequiredArgsConstructor
public class CustomerToolService {

    private static final int MAX_HOTELS = 8;
    private static final int MAX_ROOMS_PER_HOTEL = 4;

    private final HotelRepository hotelRepository;
    private final BookingRepository bookingRepository;
    private final HotelAvailabilityService hotelAvailabilityService;
    private final SecurityService securityService;
    private final BookingService bookingService;
    private final UserProfileRepository userProfileRepository;

    /** Self-proxy để tool đọc chạy qua @Transactional(readOnly) còn tool ghi thì không. */
    @Autowired
    @Lazy
    private CustomerToolService self;

    public Map<String, Object> execute(String name, Map<String, Object> args) {
        return switch (name) {
            case "cancel_my_booking" -> cancelMyBooking(args);
            case "create_booking_hold" -> createBookingHold(args);
            default -> self.executeRead(name, args);
        };
    }

    @Transactional(readOnly = true)
    public Map<String, Object> executeRead(String name, Map<String, Object> args) {
        return switch (name) {
            case "search_rooms" -> searchRooms(args);
            case "get_booking_status" -> bookingStatus(args);
            case "find_booking_by_contact" -> bookingByContact(args);
            case "get_my_bookings" -> myBookings();
            case "suggest_hotels" -> suggestHotels(args);
            case "get_hotel_faq" -> hotelFaq(args);
            case "get_nearby_attractions" -> nearbyAttractions(args);
            default -> obj("error", "Tool không tồn tại: " + name);
        };
    }

    private Map<String, Object> searchRooms(Map<String, Object> args) {
        LocalDate checkIn = asDate(args, "checkIn");
        LocalDate checkOut = asDate(args, "checkOut");
        int guests = asInt(args, "guests", 1);
        Long minPrice = asLong(args, "minPrice");
        Long maxPrice = asLong(args, "maxPrice");
        Long hotelId = asLong(args, "hotelId");
        String location = asString(args, "location", null);
        Set<HotelAmenity> wantedAmenities = parseHotelAmenities(asStringList(args, "amenities"));

        if (checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            return obj("error", "Cần checkIn và checkOut hợp lệ (checkOut phải sau checkIn).");
        }

        List<Hotel> hotels = hotelId != null
                ? hotelRepository.findByIdWithCollections(hotelId)
                        .filter(h -> h.getStatus() == HotelStatus.ACTIVE)
                        .map(List::of)
                        .orElse(List.of())
                : hotelRepository.findByStatus(HotelStatus.ACTIVE);

        if (hotelId == null && location != null && !location.isBlank()) {
            hotels = hotels.stream()
                    .filter(h -> LocationNormalizer.provinceMatches(h.getProvince(), location)
                            || LocationNormalizer.districtMatches(h.getDistrict(), location))
                    .toList();
            if (hotels.isEmpty()) {
                return obj("count", 0, "hotels", List.of(),
                        "note", "Không tìm thấy khách sạn nào ở \"" + location + "\".");
            }
        }

        if (!wantedAmenities.isEmpty()) {
            hotels = hotels.stream()
                    .filter(h -> h.getAmenities() != null && h.getAmenities().containsAll(wantedAmenities))
                    .toList();
            if (hotels.isEmpty()) {
                return obj("count", 0, "hotels", List.of(),
                        "note", "Không tìm thấy khách sạn có đủ tiện nghi yêu cầu.");
            }
        }

        HotelStayCriteria criteria = new HotelStayCriteria(
                checkIn, checkOut, guests, 1, Set.of(), Set.of(), Set.of());
        Map<Long, HotelAvailabilityService.HotelSearchAvailability> availability =
                hotelAvailabilityService.findAvailableHotelSummaries(hotels, criteria);

        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Hotel hotel : hotels) {
            if (!availability.containsKey(hotel.getId())) {
                continue;
            }
            List<Map<String, Object>> rooms = new ArrayList<>();
            long fromPrice = Long.MAX_VALUE;
            for (HotelAvailableRoomItemResponse item : hotelAvailabilityService.findAvailableRoomItems(hotel, criteria)) {
                long perNight = nights > 0 ? item.stayPrice() / nights : item.stayPrice();
                if (maxPrice != null && perNight > maxPrice) {
                    continue;
                }
                if (minPrice != null && perNight < minPrice) {
                    continue;
                }
                fromPrice = Math.min(fromPrice, perNight);
                rooms.add(obj(
                        "roomId", item.roomId(),
                        "roomName", item.name(),
                        "category", item.roomCategory(),
                        "bedType", item.bedType(),
                        "capacity", item.capacity(),
                        "availableUnits", item.availableUnits(),
                        "pricePerNight", perNight,
                        "totalStayPrice", item.stayPrice()));
                if (rooms.size() >= MAX_ROOMS_PER_HOTEL) {
                    break;
                }
            }
            if (rooms.isEmpty()) {
                continue;
            }
            result.add(obj(
                    "hotelId", hotel.getId(),
                    "hotelName", hotel.getName(),
                    "address", hotel.getAddress(),
                    "district", hotel.getDistrict(),
                    "province", hotel.getProvince(),
                    "coverImage", coverImageOf(hotel),
                    "ratingAvg", hotel.getRatingAvg(),
                    "amenities", amenityNames(hotel),
                    "fromPrice", fromPrice == Long.MAX_VALUE ? null : fromPrice,
                    "rooms", rooms));
            if (result.size() >= MAX_HOTELS) {
                break;
            }
        }
        return obj("nights", nights, "count", result.size(), "hotels", result);
    }

    private Map<String, Object> bookingStatus(Map<String, Object> args) {
        Long code = asLong(args, "bookingCode");
        if (code == null) {
            return obj("error", "Thiếu mã booking.");
        }
        return bookingRepository.findByIdWithDetails(code)
                .<Map<String, Object>>map(booking -> {
                    Map<String, Object> m = obj(
                            "bookingId", booking.getId(),
                            "status", booking.getStatus() != null ? booking.getStatus().name() : null,
                            "checkIn", String.valueOf(booking.getCheckIn()),
                            "checkOut", String.valueOf(booking.getCheckOut()),
                            "guests", booking.getGuests(),
                            "totalPrice", booking.getTotalPrice());
                    if (booking.getContact() != null) {
                        m.put("contactName", booking.getContact().getName());
                    }
                    if (!booking.getItems().isEmpty()) {
                        var room = booking.getItems().get(0).getRoom();
                        m.put("roomName", room.getName());
                        if (room.getHotel() != null) {
                            m.put("hotelName", room.getHotel().getName());
                            m.put("hotelAddress", room.getHotel().getAddress());
                        }
                    }
                    return m;
                })
                .orElse(obj("error", "Không tìm thấy booking với mã " + code));
    }

    private Map<String, Object> bookingByContact(Map<String, Object> args) {
        String email = asString(args, "email", null);
        String phone = asString(args, "phone", null);
        email = (email != null && !email.isBlank()) ? email.trim() : null;
        phone = (phone != null && !phone.isBlank()) ? phone.trim() : null;
        if (email == null && phone == null) {
            return obj("error", "Cần email hoặc số điện thoại đã dùng khi đặt phòng.");
        }

        List<Map<String, Object>> bookings = new ArrayList<>();
        for (var booking : bookingRepository.findByContactEmailOrPhone(email, phone)) {
            Map<String, Object> m = obj(
                    "bookingId", booking.getId(),
                    "status", booking.getStatus() != null ? booking.getStatus().name() : null,
                    "checkIn", String.valueOf(booking.getCheckIn()),
                    "checkOut", String.valueOf(booking.getCheckOut()),
                    "guests", booking.getGuests(),
                    "totalPrice", booking.getTotalPrice());
            if (!booking.getItems().isEmpty()) {
                var room = booking.getItems().get(0).getRoom();
                m.put("roomName", room.getName());
                if (room.getHotel() != null) {
                    m.put("hotelName", room.getHotel().getName());
                }
            }
            bookings.add(m);
            if (bookings.size() >= 5) {
                break;
            }
        }
        if (bookings.isEmpty()) {
            return obj("count", 0, "bookings", List.of(),
                    "note", "Không tìm thấy booking nào khớp với thông tin liên hệ này.");
        }
        return obj("count", bookings.size(), "bookings", bookings);
    }

    /**
     * Booking của chính khách đang đăng nhập (lấy userId từ JWT). Nếu chưa đăng nhập thì trả note
     * để model chuyển sang hỏi email/phone (find_booking_by_contact).
     */
    private Map<String, Object> myBookings() {
        JwtPrincipal principal = securityService.getCurrentPrincipalOrNull();
        if (principal == null) {
            return obj("authenticated", false,
                    "note", "Khách chưa đăng nhập. Hãy hỏi email hoặc số điện thoại đã dùng khi đặt phòng "
                            + "rồi dùng find_booking_by_contact.");
        }
        List<Map<String, Object>> bookings = new ArrayList<>();
        for (var booking : bookingRepository.findByUserIdWithDetails(principal.userId())) {
            Map<String, Object> m = obj(
                    "bookingId", booking.getId(),
                    "status", booking.getStatus() != null ? booking.getStatus().name() : null,
                    "checkIn", String.valueOf(booking.getCheckIn()),
                    "checkOut", String.valueOf(booking.getCheckOut()),
                    "guests", booking.getGuests(),
                    "totalPrice", booking.getTotalPrice());
            if (!booking.getItems().isEmpty()) {
                var room = booking.getItems().get(0).getRoom();
                m.put("roomName", room.getName());
                if (room.getHotel() != null) {
                    m.put("hotelName", room.getHotel().getName());
                }
            }
            bookings.add(m);
            if (bookings.size() >= 10) {
                break;
            }
        }
        if (bookings.isEmpty()) {
            return obj("authenticated", true, "count", 0, "bookings", List.of(),
                    "note", "Khách chưa có booking nào.");
        }
        return obj("authenticated", true, "count", bookings.size(), "bookings", bookings);
    }

    private Map<String, Object> suggestHotels(Map<String, Object> args) {
        String location = asString(args, "location", null);
        String sortBy = asString(args, "sortBy", "rating");
        boolean byPrice = "price".equalsIgnoreCase(sortBy);
        boolean byDistance = "distance".equalsIgnoreCase(sortBy);
        Double lat = asDouble(args, "lat");
        Double lng = asDouble(args, "lng");
        boolean canDistance = byDistance && lat != null && lng != null;
        Set<HotelAmenity> wantedAmenities = parseHotelAmenities(asStringList(args, "amenities"));
        Map<Long, Set<HotelAmenity>> amenityMap = wantedAmenities.isEmpty() ? Map.of() : loadAmenityMap();
        Long minPrice = asLong(args, "minPrice");
        Long maxPrice = asLong(args, "maxPrice");

        List<Map<String, Object>> hotels = new ArrayList<>();
        for (Object[] row : hotelRepository.findHotelSuggestionRows()) {
            Long id = ((Number) row[0]).longValue();
            String province = (String) row[2];
            String district = (String) row[3];
            if (location != null && !location.isBlank()
                    && !LocationNormalizer.provinceMatches(province, location)
                    && !LocationNormalizer.districtMatches(district, location)) {
                continue;
            }
            if (!wantedAmenities.isEmpty()
                    && !amenityMap.getOrDefault(id, Set.of()).containsAll(wantedAmenities)) {
                continue;
            }
            Long fromPrice = row[6] == null ? null : ((Number) row[6]).longValue();
            if (fromPrice != null) {
                if (minPrice != null && fromPrice < minPrice) {
                    continue;
                }
                if (maxPrice != null && fromPrice > maxPrice) {
                    continue;
                }
            }
            Double hLat = row[8] == null ? null : ((Number) row[8]).doubleValue();
            Double hLng = row[9] == null ? null : ((Number) row[9]).doubleValue();
            Map<String, Object> h = obj(
                    "hotelId", id,
                    "hotelName", row[1],
                    "district", district,
                    "province", province,
                    "ratingAvg", row[4],
                    "ratingCount", row[5],
                    "fromPricePerNight", row[6],
                    "coverImage", row[7]);
            if (canDistance && hLat != null && hLng != null) {
                h.put("distanceKm", Math.round(haversineKm(lat, lng, hLat, hLng) * 10) / 10.0);
            }
            hotels.add(h);
        }

        Comparator<Map<String, Object>> cmp;
        if (canDistance) {
            cmp = Comparator.comparingDouble(h -> h.get("distanceKm") == null
                    ? Double.MAX_VALUE
                    : ((Number) h.get("distanceKm")).doubleValue());
        } else if (byPrice) {
            cmp = Comparator.comparingLong(h -> ((Number) h.get("fromPricePerNight")).longValue());
        } else {
            cmp = Comparator.<Map<String, Object>>comparingDouble(
                    h -> ((Number) h.get("ratingAvg")).doubleValue()).reversed();
        }
        hotels.sort(cmp);
        List<Map<String, Object>> top = hotels.stream().limit(MAX_HOTELS).toList();

        if (top.isEmpty()) {
            return obj("count", 0, "hotels", List.of(),
                    "note", location != null && !location.isBlank()
                            ? "Không tìm thấy khách sạn nào ở \"" + location + "\"."
                            : "Hiện chưa có khách sạn nào để gợi ý.");
        }
        // Dòng gợi ý chỉ có coverImageUrl; nếu trống thì fallback ảnh đầu trong imageUrls (giống search_rooms).
        // Chỉ tra cứu cho số ít KS top thiếu ảnh (≤ MAX_HOTELS) — không N+1 toàn bảng.
        for (Map<String, Object> h : top) {
            Object cover = h.get("coverImage");
            if (cover != null && !String.valueOf(cover).isBlank()) {
                continue;
            }
            hotelRepository.findById((Long) h.get("hotelId"))
                    .map(this::coverImageOf)
                    .ifPresent(img -> h.put("coverImage", img));
        }
        String appliedSort = canDistance ? "distance" : (byPrice ? "price" : "rating");
        return obj("sortBy", appliedSort, "count", top.size(), "hotels", top);
    }

    private Map<String, Object> hotelFaq(Map<String, Object> args) {
        Long hotelId = asLong(args, "hotelId");
        String topic = asString(args, "topic", "general");
        if (hotelId == null) {
            return obj("topic", topic,
                    "note", "Không có khách sạn cụ thể. Trả lời chính sách chung của HotelHub theo chủ đề.");
        }
        return hotelRepository.findByIdWithCollections(hotelId)
                .filter(h -> h.getStatus() == HotelStatus.ACTIVE)
                .<Map<String, Object>>map(hotel -> {
                    List<String> amenities = new ArrayList<>();
                    hotel.getAmenities().forEach(a -> amenities.add(a.name()));
                    amenities.addAll(hotel.getCustomAmenities());
                    return obj(
                            "hotelName", hotel.getName(),
                            "topic", topic,
                            "cancellationPolicy", hotel.getCancellationPolicy() != null
                                    ? hotel.getCancellationPolicy().name() : null,
                            "bookingMode", hotel.getBookingMode() != null
                                    ? hotel.getBookingMode().name() : null,
                            "amenities", amenities);
                })
                .orElse(obj("error", "Không tìm thấy khách sạn."));
    }

    /**
     * Không bịa địa điểm: thay vì để model tự liệt kê, trả về liên kết bản đồ (Google Maps) dựng từ
     * toạ độ/tên khách sạn theo loại địa điểm — model chia sẻ link cho khách tự khám phá.
     */
    private Map<String, Object> nearbyAttractions(Map<String, Object> args) {
        Long hotelId = asLong(args, "hotelId");
        String category = asString(args, "category", "all");
        if (hotelId == null) {
            return obj("error", "Thiếu hotelId.");
        }
        return hotelRepository.findById(hotelId)
                .<Map<String, Object>>map(hotel -> {
                    String query = categoryQuery(category);
                    String mapsUrl;
                    if (hotel.getLatitude() != null && hotel.getLongitude() != null) {
                        mapsUrl = "https://www.google.com/maps/search/" + urlEncode(query)
                                + "/@" + hotel.getLatitude() + "," + hotel.getLongitude() + ",15z";
                    } else {
                        mapsUrl = "https://www.google.com/maps/search/" + urlEncode(query + " gần " + hotel.getName());
                    }
                    return obj(
                            "hotelName", hotel.getName(),
                            "district", hotel.getDistrict(),
                            "province", hotel.getProvince(),
                            "category", category,
                            "mapsUrl", mapsUrl,
                            "note", "Hãy chia sẻ liên kết bản đồ (mapsUrl) cho khách để tự xem địa điểm xung quanh; "
                                    + "KHÔNG tự liệt kê tên địa điểm cụ thể.");
                })
                .orElse(obj("error", "Không tìm thấy khách sạn."));
    }

    // ── Write tools (ngoài tx readOnly; BookingService tự quản lý tx) ───────────

    private Map<String, Object> cancelMyBooking(Map<String, Object> args) {
        Long bookingId = asLong(args, "bookingId");
        if (bookingId == null) {
            return obj("error", "Thiếu mã đơn cần huỷ.");
        }
        JwtPrincipal principal = securityService.getCurrentPrincipalOrNull();
        if (principal == null) {
            return obj("authenticated", false, "note", "Khách cần đăng nhập để huỷ đơn của mình.");
        }
        BookingResponse res = bookingService.cancelBooking(principal.userId(), bookingId);
        return obj(
                "bookingId", res.bookingId(),
                "status", res.status(),
                "note", "Đã huỷ đơn #" + res.bookingId() + ".");
    }

    private Map<String, Object> createBookingHold(Map<String, Object> args) {
        Long roomId = asLong(args, "roomId");
        LocalDate checkIn = asDate(args, "checkIn");
        LocalDate checkOut = asDate(args, "checkOut");
        int guests = asInt(args, "guests", 1);
        int quantity = Math.max(asInt(args, "quantity", 1), 1);
        if (roomId == null || checkIn == null || checkOut == null || !checkOut.isAfter(checkIn)) {
            return obj("error", "Cần roomId, checkIn và checkOut hợp lệ (checkOut sau checkIn).");
        }
        JwtPrincipal principal = securityService.getCurrentPrincipalOrNull();
        if (principal == null) {
            return obj("authenticated", false,
                    "note", "Khách cần đăng nhập để giữ phòng. Có thể mở trang khách sạn để đặt.");
        }
        UserProfile profile = userProfileRepository.findByUserId(principal.userId()).orElse(null);
        String fullName = firstNonBlank(profile != null ? profile.getFullName() : null, principal.email());
        String email = firstNonBlank(profile != null ? profile.getContactEmail() : null, principal.email());
        String phone = profile != null ? profile.getPhone() : null;
        if (phone == null || phone.isBlank()) {
            return obj("error", "Bạn cần cập nhật số điện thoại trong hồ sơ để đặt nhanh, "
                    + "hoặc mở trang khách sạn để đặt.");
        }

        CreateBookingRequest req = new CreateBookingRequest();
        req.setCheckIn(checkIn);
        req.setCheckOut(checkOut);
        req.setGuests(guests);
        req.setRoom(List.of(new BookingRoomRequest(roomId, quantity)));
        req.setContact(new BookingContactRequest(fullName, email, phone));

        String idempotencyKey = "chat:" + principal.userId() + ":" + roomId + ":" + checkIn + ":" + checkOut;
        BookingResponse res = bookingService.createBooking(principal.userId(), req, idempotencyKey);
        return obj(
                "bookingId", res.bookingId(),
                "hotelName", res.hotelName(),
                "status", res.status(),
                "totalPrice", res.totalPrice(),
                "checkIn", String.valueOf(res.checkIn()),
                "checkOut", String.valueOf(res.checkOut()),
                "payUrl", "/payment/" + res.bookingId(),
                "note", "Đã giữ phòng, đơn đang chờ thanh toán. Mời khách bấm thẻ thanh toán để hoàn tất.");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Ảnh đại diện khách sạn cho card chat: ưu tiên coverImageUrl, fallback ảnh đầu trong imageUrls. */
    private String coverImageOf(Hotel hotel) {
        if (hotel.getCoverImageUrl() != null && !hotel.getCoverImageUrl().isBlank()) {
            return hotel.getCoverImageUrl();
        }
        return hotel.getImageUrls().isEmpty() ? null : hotel.getImageUrls().get(0);
    }

    private List<String> amenityNames(Hotel hotel) {
        List<String> names = new ArrayList<>();
        if (hotel.getAmenities() != null) {
            hotel.getAmenities().forEach(a -> names.add(a.name()));
        }
        return names;
    }

    private Map<Long, Set<HotelAmenity>> loadAmenityMap() {
        Map<Long, Set<HotelAmenity>> map = new java.util.HashMap<>();
        for (Hotel h : hotelRepository.findByStatus(HotelStatus.ACTIVE)) {
            map.put(h.getId(), h.getAmenities() == null ? Set.of() : new HashSet<>(h.getAmenities()));
        }
        return map;
    }

    /** Map từ khoá tiếng Việt/Anh người dùng nhập → enum HotelAmenity (contains, không phân biệt hoa thường). */
    private Set<HotelAmenity> parseHotelAmenities(List<String> inputs) {
        EnumSet<HotelAmenity> out = EnumSet.noneOf(HotelAmenity.class);
        for (String raw : inputs) {
            String s = raw.toLowerCase(Locale.ROOT);
            for (String[] pair : AMENITY_KEYWORDS) {
                if (s.contains(pair[0])) {
                    out.add(HotelAmenity.valueOf(pair[1]));
                }
            }
        }
        return out;
    }

    /** Cặp (từ khoá, tên enum HotelAmenity). */
    private static final String[][] AMENITY_KEYWORDS = {
            {"hồ bơi", "POOL"}, {"bể bơi", "POOL"}, {"pool", "POOL"}, {"bơi", "POOL"},
            {"đỗ xe", "PARKING"}, {"đậu xe", "PARKING"}, {"bãi xe", "PARKING"}, {"gửi xe", "PARKING"}, {"parking", "PARKING"},
            {"gym", "GYM"}, {"phòng tập", "GYM"}, {"thể hình", "GYM"},
            {"spa", "SPA"}, {"massage", "MASSAGE"}, {"xông hơi", "SAUNA"}, {"sauna", "SAUNA"},
            {"bồn tắm", "HOT_TUB"}, {"jacuzzi", "HOT_TUB"},
            {"wifi", "WIFI"}, {"internet", "WIFI"},
            {"ăn sáng", "BREAKFAST_INCLUDED"}, {"breakfast", "BREAKFAST_INCLUDED"},
            {"nhà hàng", "RESTAURANT"}, {"restaurant", "RESTAURANT"},
            {"quầy bar", "BAR"}, {"bar", "BAR"}, {"cà phê", "CAFE"}, {"cafe", "CAFE"}, {"coffee", "CAFE"},
            {"thú cưng", "PET_ALLOWED"}, {"pet", "PET_ALLOWED"},
            {"bãi biển", "BEACH_ACCESS"}, {"biển", "BEACH_ACCESS"}, {"beach", "BEACH_ACCESS"},
            {"lễ tân", "RECEPTION_24H"}, {"24/7", "RECEPTION_24H"}, {"24h", "RECEPTION_24H"},
            {"thang máy", "ELEVATOR"}, {"elevator", "ELEVATOR"},
            {"sân bay", "AIRPORT_SHUTTLE"}, {"đưa đón", "AIRPORT_SHUTTLE"}, {"shuttle", "AIRPORT_SHUTTLE"},
            {"tennis", "TENNIS_COURT"}, {"phòng họp", "MEETING_ROOM"}, {"hội nghị", "MEETING_ROOM"},
            {"sân vườn", "GARDEN"}, {"khu vườn", "GARDEN"}, {"garden", "GARDEN"},
            {"sân thượng", "ROOFTOP"}, {"rooftop", "ROOFTOP"},
    };

    private String categoryQuery(String category) {
        return switch (category == null ? "all" : category.toLowerCase(Locale.ROOT)) {
            case "food" -> "nhà hàng quán ăn";
            case "entertainment" -> "địa điểm giải trí";
            case "shopping" -> "trung tâm mua sắm";
            case "nature" -> "công viên thiên nhiên";
            default -> "địa điểm tham quan ăn uống";
        };
    }

    private String urlEncode(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    /** Khoảng cách Haversine giữa 2 toạ độ (km). */
    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }
}
