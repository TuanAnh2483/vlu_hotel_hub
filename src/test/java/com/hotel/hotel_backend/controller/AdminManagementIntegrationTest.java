package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomCategory;
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
import com.hotel.hotel_backend.repository.RefundRequestRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
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
import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminManagementIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;

    @Autowired private UserRepository userRepository;
    @Autowired private HotelRepository hotelRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private RoomUnitRepository roomUnitRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private BookingItemRepository bookingItemRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private HotelReviewRepository hotelReviewRepository;
    @Autowired private RefundRequestRepository refundRequestRepository;
    @Autowired private DailyInventoryRepository dailyInventoryRepository;
    @Autowired private DailyRateRepository dailyRateRepository;
    @Autowired private InventoryService inventoryService;

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
        refundRequestRepository.deleteAll();
        bookingItemRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        bookingRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void adminShouldGetSystemStats() throws Exception {
        User admin = createAdmin("admin-stats@test.com");
        String adminToken = jwtService.generate(admin);

        createVerifiedUser("customer1@test.com", UserType.CUSTOMER);
        createVerifiedUser("partner1@test.com", UserType.PARTNER);

        mockMvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").exists());
    }

    @Test
    void adminShouldListAllUsers() throws Exception {
        User admin = createAdmin("admin-users@test.com");
        String adminToken = jwtService.generate(admin);
        createVerifiedUser("customer-list@test.com", UserType.CUSTOMER);
        createVerifiedUser("partner-list@test.com", UserType.PARTNER);

        mockMvc.perform(get("/api/admin/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void adminShouldToggleUserStatus() throws Exception {
        User admin = createAdmin("admin-toggle@test.com");
        String adminToken = jwtService.generate(admin);
        User target = createVerifiedUser("target-user@test.com", UserType.CUSTOMER);

        // Disable the user
        mockMvc.perform(post("/api/admin/users/{userId}/toggle-status", target.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Re-enable the user
        mockMvc.perform(post("/api/admin/users/{userId}/toggle-status", target.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void adminShouldListAllHotels() throws Exception {
        User admin = createAdmin("admin-hotels@test.com");
        String adminToken = jwtService.generate(admin);
        User partner = createVerifiedUser("partner-hotels@test.com", UserType.PARTNER);
        createHotel(partner, "Admin Listed Hotel");

        mockMvc.perform(get("/api/admin/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").exists());
    }

    @Test
    void adminShouldListAllBookings() throws Exception {
        User admin = createAdmin("admin-bookings@test.com");
        String adminToken = jwtService.generate(admin);
        User partner = createVerifiedUser("partner-admin-bookings@test.com", UserType.PARTNER);
        User customer = createVerifiedUser("customer-admin-bookings@test.com", UserType.CUSTOMER);
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Admin Booking Hotel");
        Room room = createRoom(hotel, "Admin Booking Room", 2);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(2);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
        createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "admin-booking@test.com");

        mockMvc.perform(get("/api/admin/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").exists());
    }

    @Test
    void adminShouldListAndDeleteReviews() throws Exception {
        User admin = createAdmin("admin-reviews@test.com");
        String adminToken = jwtService.generate(admin);
        User partner = createVerifiedUser("partner-admin-reviews@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        User customer = createVerifiedUser("customer-admin-reviews@test.com", UserType.CUSTOMER);
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Admin Review Hotel");
        Room room = createRoom(hotel, "Admin Review Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(1);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        long bookingId = createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "admin-review@test.com");
        payBookingHttp(customerToken, bookingId, "admin-review-pay-1");
        moveBookingToPast(bookingId);
        completeBookingHttp(partnerToken, bookingId);

        MvcResult reviewResult = mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 4,
                                  "comment": "Good stay!"
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isOk())
                .andReturn();

        long reviewId = objectMapper.readTree(reviewResult.getResponse().getContentAsString())
                .path("data").path("reviewId").asLong();

        // Admin lists reviews
        mockMvc.perform(get("/api/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        // Admin deletes the review
        mockMvc.perform(delete("/api/admin/reviews/{reviewId}", reviewId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Review should no longer appear
        mockMvc.perform(get("/api/admin/reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void adminShouldListAndApproveRefundRequests() throws Exception {
        User admin = createAdmin("admin-refund@test.com");
        String adminToken = jwtService.generate(admin);
        User partner = createVerifiedUser("partner-admin-refund@test.com", UserType.PARTNER);
        User customer = createVerifiedUser("customer-admin-refund@test.com", UserType.CUSTOMER);
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Admin Refund Hotel");
        Room room = createRoom(hotel, "Admin Refund Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(5);
        LocalDate checkOut = checkIn.plusDays(1);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        long bookingId = createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "admin-refund@test.com");
        payBookingHttp(customerToken, bookingId, "admin-refund-pay-1");

        // Customer submits refund request
        MvcResult refundResult = mockMvc.perform(post("/api/bookings/{bookingId}/refund-request", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "reason": "Change of plans"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode refundData = objectMapper.readTree(refundResult.getResponse().getContentAsString()).path("data");
        long refundId = refundData.path("id").asLong() != 0
                ? refundData.path("id").asLong()
                : refundData.path("refundRequestId").asLong();

        // Admin lists refund requests
        mockMvc.perform(get("/api/admin/refunds")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        // Admin approves refund
        mockMvc.perform(post("/api/admin/refunds/{refundId}/approve", refundId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .content("""
                                {
                                  "note": "Approved by admin"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void adminShouldRejectRefundRequest() throws Exception {
        User admin = createAdmin("admin-reject@test.com");
        String adminToken = jwtService.generate(admin);
        User partner = createVerifiedUser("partner-admin-reject@test.com", UserType.PARTNER);
        User customer = createVerifiedUser("customer-admin-reject@test.com", UserType.CUSTOMER);
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Admin Reject Hotel");
        Room room = createRoom(hotel, "Admin Reject Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(5);
        LocalDate checkOut = checkIn.plusDays(1);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        long bookingId = createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "admin-reject@test.com");
        payBookingHttp(customerToken, bookingId, "admin-reject-pay-1");

        MvcResult refundResult = mockMvc.perform(post("/api/bookings/{bookingId}/refund-request", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "reason": "Not satisfied"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode refundData2 = objectMapper.readTree(refundResult.getResponse().getContentAsString()).path("data");
        long refundId = refundData2.path("id").asLong() != 0
                ? refundData2.path("id").asLong()
                : refundData2.path("refundRequestId").asLong();

        mockMvc.perform(post("/api/admin/refunds/{refundId}/reject", refundId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .content("""
                                {
                                  "note": "Policy does not cover this case"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void nonAdminShouldBeForbiddenFromAdminEndpoints() throws Exception {
        User customer = createVerifiedUser("non-admin@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(customer);

        mockMvc.perform(get("/api/admin/stats")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedShouldNotAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isUnauthorized());
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private User createAdmin(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(UserType.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    private User createVerifiedUser(String email, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    private Hotel createHotel(User owner, String name) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince("HCM");
        hotel.setDistrict("District 1");
        hotel.setHotelType(HotelType.HOTEL);
        return hotelRepository.save(hotel);
    }

    private Room createRoom(Hotel hotel, String name, int quantity) {
        Room room = new Room();
        room.setHotel(hotel);
        room.setName(name);
        room.setPrice(1_000_000L);
        room.setCapacity(2);
        room.setQuantity(quantity);
        room.setRoomCategory(RoomCategory.STANDARD);
        room.setBedType(BedType.DOUBLE);
        return roomRepository.save(room);
    }

    private long createBookingHttp(String customerToken, Long roomId,
                                   LocalDate checkIn, LocalDate checkOut,
                                   String contactEmail) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [{"roomId": %d, "quantity": 1}],
                                  "contact": {
                                    "fullName": "Test Customer",
                                    "email": "%s",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId, contactEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
    }

    private void payBookingHttp(String customerToken, long bookingId, String clientRequestId) throws Exception {
        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "%s"
                                }
                                """.formatted(clientRequestId)))
                .andExpect(status().isOk());
    }

    private void completeBookingHttp(String partnerToken, long bookingId) throws Exception {
        mockMvc.perform(post("/api/partner/bookings/{bookingId}/complete", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk());
    }

    private void moveBookingToPast(long bookingId) {
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setCheckIn(LocalDate.now().minusDays(3));
        booking.setCheckOut(LocalDate.now().minusDays(1));
        bookingRepository.save(booking);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
