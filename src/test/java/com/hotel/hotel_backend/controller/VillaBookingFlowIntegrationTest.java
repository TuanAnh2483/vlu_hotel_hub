package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.HotelReviewRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end integration test cho luồng villa (bookingMode=ENTIRE):
 * Partner tạo villa → thêm phòng nguyên căn → khách tìm kiếm → xem chi tiết
 * → đặt phòng → thanh toán → xác nhận.
 *
 * Mục đích: đảm bảo villa (loại bất động sản thuê nguyên căn) đi qua đúng
 * toàn bộ pipeline tìm kiếm, inventory, booking, và payment.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VillaBookingFlowIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;

    @Autowired private UserRepository userRepository;
    @Autowired private HotelRepository hotelRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private DailyInventoryRepository dailyInventoryRepository;
    @Autowired private DailyRateRepository dailyRateRepository;
    @Autowired private BookingItemRepository bookingItemRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private HotelReviewRepository hotelReviewRepository;
    @Autowired private RoomUnitRepository roomUnitRepository;

    @BeforeEach
    void setUp() {
        cleanAll();
    }

    @AfterEach
    void tearDown() {
        cleanAll();
    }

    private void cleanAll() {
        hotelReviewRepository.deleteAll();
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void villaFlowShouldSupportCreateSearchBookAndPayForWholeUnit() throws Exception {
        // ─── Arrange: dates ──────────────────────────────────────────────────────
        LocalDate checkIn = LocalDate.now().plusDays(10);
        LocalDate checkOut = checkIn.plusDays(3); // 3 đêm

        // ─── Step 1: Partner tạo villa (bookingMode=ENTIRE) ──────────────────────
        User partner = createUser("villa-partner@test.com", UserType.PARTNER);
        String partnerToken = bearer(partner);

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Villa Phú Quốc",
                                  "address": "Đường Trần Hưng Đạo",
                                  "district": "Dương Đông",
                                  "province": "Kiên Giang",
                                  "description": "Villa nguyên căn view biển",
                                  "hotelType": "VILLA",
                                  "bookingMode": "ENTIRE",
                                  "amenities": ["POOL", "PARKING", "WIFI"],
                                  "imageUrls": ["https://cdn.example.com/villa/cover.jpg"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Villa Phú Quốc"))
                .andExpect(jsonPath("$.data.hotelType").value("VILLA"))
                .andExpect(jsonPath("$.data.bookingMode").value("ENTIRE"))
                .andReturn();

        long hotelId = readLong(hotelResult, "data", "id");

        // ─── Step 2: Thêm phòng nguyên căn (quantity=1, capacity=8) ─────────────
        // Villa chỉ có 1 "room" đại diện cho toàn bộ tài sản
        MvcResult roomResult = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Nguyên căn villa",
                                  "capacity": 8,
                                  "quantity": 1,
                                  "price": 5000000,
                                  "roomCategory": "SUITE",
                                  "bedType": "DOUBLE",
                                  "amenities": ["BALCONY", "BATHTUB"],
                                  "imageUrls": ["https://cdn.example.com/villa/room.jpg"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Nguyên căn villa"))
                .andExpect(jsonPath("$.data.quantity").value(1))
                .andExpect(jsonPath("$.data.capacity").value(8))
                .andReturn();

        long roomId = readLong(roomResult, "data", "id");

        // Inventory phải được tạo tự động sau khi thêm phòng
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId, LocalDate.now(), LocalDate.now().plusDays(365)
        )).isNotEmpty();

        // ─── Step 3: Khách tìm kiếm villa theo tỉnh ──────────────────────────────
        User customer = createUser("villa-customer@test.com", UserType.CUSTOMER);
        String customerToken = bearer(customer);

        // Tìm kiếm với rooms=1 (1 đơn vị nguyên căn), adults=4
        // minPrice = 5_000_000 VND/đêm × 3 đêm = 15_000_000
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Kiên Giang")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "4")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].name").value("Villa Phú Quốc"))
                .andExpect(jsonPath("$.data.items[0].hotelType").value("VILLA"))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(15_000_000));

        // ─── Step 4: Xem chi tiết villa ──────────────────────────────────────────
        mockMvc.perform(get("/api/hotels/{hotelId}", hotelId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.name").value("Villa Phú Quốc"))
                .andExpect(jsonPath("$.data.bookingMode").value("ENTIRE"));

        // ─── Step 5: Xem phòng khả dụng (whole unit) ─────────────────────────────
        mockMvc.perform(get("/api/hotels/{hotelId}/available-rooms", hotelId)
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "4")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].roomId").value(roomId))
                .andExpect(jsonPath("$.data[0].availableUnits").value(1))
                .andExpect(jsonPath("$.data[0].stayPrice").value(15_000_000));

        // ─── Step 6: Quote booking ────────────────────────────────────────────────
        mockMvc.perform(post("/api/bookings/quote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, customerToken)
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [
                                    { "roomId": %d, "quantity": 1 }
                                  ]
                                }
                                """.formatted(checkIn, checkOut, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.totalPrice").value(15_000_000.0))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(roomId));

        // ─── Step 7: Tạo booking (PENDING_PAYMENT) ────────────────────────────────
        MvcResult bookingResult = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, customerToken)
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [
                                    { "roomId": %d, "quantity": 1 }
                                  ],
                                  "contact": {
                                    "fullName": "Nguyễn Văn A",
                                    "email": "villa-customer@test.com",
                                    "phone": "0909123456"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(roomId))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andReturn();

        long bookingId = readLong(bookingResult, "data", "bookingId");

        // Sau khi giữ chỗ, inventory của nguyên căn phải bằng 0 trong kỳ ở
        var inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId, checkIn, checkOut.minusDays(1)
        );
        assertThat(inventories).isNotEmpty();
        assertThat(inventories).allSatisfy(inv ->
                assertThat(inv.getBlockedRooms()).isEqualTo(1)
        );

        // ─── Step 8: Thanh toán (simulate success) ────────────────────────────────
        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, customerToken)
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "villa-pay-001"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.expiresAt").doesNotExist());

        // ─── Step 9: Kiểm tra booking đã CONFIRMED ────────────────────────────────
        mockMvc.perform(get("/api/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, customerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        mockMvc.perform(get("/api/bookings/{bookingId}/payments", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, customerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.data[0].clientRequestId").value("villa-pay-001"));

        // ─── Step 10: Partner xem booking trong dashboard ─────────────────────────
        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"));

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.contact.email").value("villa-customer@test.com"))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    @Test
    void villaWithMinStayShouldNotAppearInSearchForShorterStays() throws Exception {
        // Đảm bảo rằng nếu daily_rate có min_stay=7 thì tìm kiếm 2 đêm không ra villa.
        // (Đây là trường hợp gốc gây ra bug villa không xuất hiện)
        LocalDate checkIn = LocalDate.now().plusDays(5);
        LocalDate checkOut = checkIn.plusDays(2); // 2 đêm

        User partner = createUser("villa-minstay@test.com", UserType.PARTNER);
        String partnerToken = bearer(partner);

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Villa Min Stay",
                                  "address": "Min Stay Street",
                                  "district": "Phú Quốc",
                                  "province": "Kiên Giang",
                                  "description": "Yêu cầu thuê tối thiểu 7 đêm",
                                  "hotelType": "VILLA",
                                  "bookingMode": "ENTIRE",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long hotelId = readLong(hotelResult, "data", "id");

        MvcResult roomResult = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Whole Villa",
                                  "capacity": 6,
                                  "quantity": 1,
                                  "price": 4000000,
                                  "roomCategory": "SUITE",
                                  "bedType": "DOUBLE",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long roomId = readLong(roomResult, "data", "id");

        // Đặt min_stay=7 thông qua calendar API
        LocalDate calStart = LocalDate.now().plusDays(1);
        LocalDate calEnd = LocalDate.now().plusDays(30);

        mockMvc.perform(put("/api/partner/rooms/{roomId}/calendar", roomId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "startDate": "%s",
                                  "endDate": "%s",
                                  "price": 4000000,
                                  "minStay": 7,
                                  "closed": false
                                }
                                """.formatted(calStart, calEnd)))
                .andExpect(status().isOk());

        // Tìm kiếm 2 đêm → không ra (min_stay=7 > 2)
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Kiên Giang")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(0));

        // Tìm kiếm 7 đêm → ra (đúng với min_stay)
        LocalDate longCheckOut = checkIn.plusDays(7);
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Kiên Giang")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", longCheckOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(28_000_000)); // 4_000_000 × 7
    }

    @Test
    void villaAlreadyBookedShouldNotAppearInSearchForSameDates() throws Exception {
        // Sau khi 1 khách book villa, tìm kiếm cùng kỳ không ra kết quả.
        LocalDate checkIn = LocalDate.now().plusDays(15);
        LocalDate checkOut = checkIn.plusDays(3);

        User partner = createUser("villa-conflict@test.com", UserType.PARTNER);
        User customer1 = createUser("customer-first@test.com", UserType.CUSTOMER);
        User customer2 = createUser("customer-second@test.com", UserType.CUSTOMER);
        String partnerToken = bearer(partner);
        String cust1Token = bearer(customer1);
        String cust2Token = bearer(customer2);

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Villa Bị Đặt",
                                  "address": "Conflict Street",
                                  "district": "Phú Quốc",
                                  "province": "Kiên Giang",
                                  "hotelType": "VILLA",
                                  "bookingMode": "ENTIRE",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long hotelId = readLong(hotelResult, "data", "id");

        MvcResult roomResult = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, partnerToken)
                        .content("""
                                {
                                  "name": "Whole Villa",
                                  "capacity": 6,
                                  "quantity": 1,
                                  "price": 3000000,
                                  "roomCategory": "SUITE",
                                  "bedType": "DOUBLE",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long roomId = readLong(roomResult, "data", "id");

        // Customer 1 đặt thành công
        MvcResult bookingResult = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, cust1Token)
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [{ "roomId": %d, "quantity": 1 }],
                                  "contact": {
                                    "fullName": "Khách Đầu Tiên",
                                    "email": "customer-first@test.com",
                                    "phone": "0900000001"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = readLong(bookingResult, "data", "bookingId");

        // Thanh toán → CONFIRMED
        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, cust1Token)
                        .content("""
                                {"simulateSuccess": true, "clientRequestId": "conflict-pay-001"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        // Customer 2 tìm cùng kỳ → villa không xuất hiện (đã hết phòng)
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Kiên Giang")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(0));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User createUser(String email, UserType type) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash-" + email);
        user.setUserType(type);
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generate(user);
    }

    private long readLong(MvcResult result, String... path) throws Exception {
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        for (String key : path) {
            node = node.path(key);
        }
        return node.asLong();
    }
}
