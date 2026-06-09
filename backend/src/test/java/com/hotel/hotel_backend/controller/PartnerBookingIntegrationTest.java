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
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PartnerBookingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private HotelReviewRepository hotelReviewRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomUnitRepository roomUnitRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
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
    void partnerShouldListOwnedBookingsWithFilters() throws Exception {
        User partnerOne = createUser("partner-bookings-1@test.com", UserType.PARTNER);
        User partnerTwo = createUser("partner-bookings-2@test.com", UserType.PARTNER);
        String partnerOneToken = jwtService.generate(partnerOne);
        String customerToken = jwtService.generate(createUser("customer-partner-list@test.com", UserType.CUSTOMER));

        Hotel partnerOneHotelA = createHotel(partnerOne, "Partner One Hotel A");
        Hotel partnerOneHotelB = createHotel(partnerOne, "Partner One Hotel B");
        Hotel partnerTwoHotel = createHotel(partnerTwo, "Partner Two Hotel");

        Room roomA = createRoom(partnerOneHotelA, "Partner One Room A", 2);
        Room roomB = createRoom(partnerOneHotelB, "Partner One Room B", 2);
        Room roomC = createRoom(partnerTwoHotel, "Partner Two Room", 2);

        LocalDate firstCheckIn = LocalDate.now().plusDays(1);
        LocalDate firstCheckOut = firstCheckIn.plusDays(2);
        LocalDate secondCheckIn = LocalDate.now().plusDays(5);
        LocalDate secondCheckOut = secondCheckIn.plusDays(2);

        initInventory(roomA, firstCheckIn, firstCheckOut);
        initInventory(roomB, secondCheckIn, secondCheckOut);
        initInventory(roomC, firstCheckIn, firstCheckOut);

        long bookingA = createBooking(customerToken, roomA.getId(), firstCheckIn, firstCheckOut, "customer-a@test.com");
        long bookingB = createBooking(customerToken, roomB.getId(), secondCheckIn, secondCheckOut, "customer-b@test.com");
        long bookingC = createBooking(customerToken, roomC.getId(), firstCheckIn, firstCheckOut, "customer-c@test.com");

        payBooking(customerToken, bookingB, "partner-booking-list-pay-1");

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(partnerOneHotelB.getId()))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.items[1].bookingId").value(bookingA))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(partnerOneHotelA.getId()))
                .andExpect(jsonPath("$.data.items[1].status").value("PENDING_PAYMENT"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("hotelId", String.valueOf(partnerOneHotelA.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingA))
                .andExpect(jsonPath("$.data.items[0].hotelName").value("Partner One Hotel A"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("checkInFrom", secondCheckIn.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB));

        assertThat(bookingRepository.findById(bookingC)).isPresent();
    }

    @Test
    void partnerShouldGetOwnedBookingDetail() throws Exception {
        User partner = createUser("partner-booking-detail@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        String customerToken = jwtService.generate(createUser("customer-partner-detail@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Partner Detail Hotel");
        Room room = createRoom(hotel, "Partner Detail Room", 2);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(2);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "partner-detail-customer@test.com");

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.hotelName").value("Partner Detail Hotel"))
                .andExpect(jsonPath("$.data.customerId").exists())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.totalPrice").value(2_000_000.0))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(room.getId()))
                .andExpect(jsonPath("$.data.contact.fullName").value("Partner Detail Customer"))
                .andExpect(jsonPath("$.data.contact.email").value("partner-detail-customer@test.com"));
    }

    @Test
    void partnerBookingDetailShouldReturnNotFoundForOtherPartnersBooking() throws Exception {
        User ownerPartner = createUser("partner-booking-owner@test.com", UserType.PARTNER);
        User strangerPartner = createUser("partner-booking-stranger@test.com", UserType.PARTNER);
        String strangerToken = jwtService.generate(strangerPartner);
        String customerToken = jwtService.generate(createUser("customer-partner-other@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(ownerPartner, "Owner Partner Hotel");
        Room room = createRoom(hotel, "Owner Partner Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(2);
        LocalDate checkOut = checkIn.plusDays(2);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "partner-other-customer@test.com");

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void partnerShouldCompletePastConfirmedBooking() throws Exception {
        User partner = createUser("partner-complete@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        String customerToken = jwtService.generate(createUser("customer-complete@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Partner Complete Hotel");
        Room room = createRoom(hotel, "Partner Complete Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(2);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "complete@test.com");
        payBooking(customerToken, bookingId, "partner-complete-pay");
        LocalDate pastIn = LocalDate.now().minusDays(3);
        LocalDate pastOut = LocalDate.now().minusDays(1);
        initInventory(room, pastIn, pastOut);
        inventoryService.reserveInventory(room.getId(), pastIn, pastOut, 1);
        moveBookingStay(bookingId, pastIn, pastOut);

        mockMvc.perform(post("/api/partner/bookings/{bookingId}/complete", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        MvcResult notificationResult = mockMvc.perform(get("/api/me/notifications")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").exists())
                .andExpect(jsonPath("$.data[0].type").value("REVIEW"))
                .andExpect(jsonPath("$.data[0].read").value(false))
                .andExpect(jsonPath("$.data[0].actionUrl").value("/customer/reviews"))
                .andExpect(jsonPath("$.data[0].title").value("Cảm ơn bạn đã lưu trú tại Partner Complete Hotel"))
                .andExpect(jsonPath("$.data[0].message").value("Booking #" + bookingId + " đã hoàn tất. Bạn có thể gửi đánh giá để chia sẻ trải nghiệm dịch vụ."))
                .andReturn();

        JsonNode notificationBody = objectMapper.readTree(notificationResult.getResponse().getContentAsString());
        long notificationId = notificationBody.path("data").path(0).path("id").asLong();

        mockMvc.perform(post("/api/me/notifications/{notificationId}/read", notificationId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(notificationId))
                .andExpect(jsonPath("$.data.read").value(true))
                .andExpect(jsonPath("$.data.readAt").exists());

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 5,
                                  "comment": null
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId));

        mockMvc.perform(get("/api/me/notifications")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(notificationId))
                .andExpect(jsonPath("$.data[0].read").value(true))
                .andExpect(jsonPath("$.data[0].title").value("Cảm ơn bạn đã đánh giá Partner Complete Hotel"))
                .andExpect(jsonPath("$.data[0].message").value("Đánh giá của bạn cho booking #" + bookingId + " đã được ghi nhận."));
    }

    @Test
    void partnerShouldRefundFutureConfirmedBookingAndReleaseInventory() throws Exception {
        User partner = createUser("partner-refund@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        String customerToken = jwtService.generate(createUser("customer-refund@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Partner Refund Hotel");
        Room room = createRoom(hotel, "Partner Refund Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(5);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "refund@test.com");
        payBooking(customerToken, bookingId, "partner-refund-pay");

        mockMvc.perform(post("/api/partner/bookings/{bookingId}/refund", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "clientRequestId": "partner-refund-op-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        mockMvc.perform(get("/api/hotels/{hotelId}/available-rooms", hotel.getId())
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].roomId").value(room.getId()))
                .andExpect(jsonPath("$.data[0].availableUnits").value(1));

        assertThat(paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId))
                .hasSize(2)
                .anySatisfy(transaction -> assertThat(transaction.getAmount()).isEqualTo(-1_000_000L));
    }

    @Test
    void partnerShouldSeeAnalyticsSummary() throws Exception {
        User partner = createUser("partner-analytics@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        String customerToken = jwtService.generate(createUser("customer-analytics@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Partner Analytics Hotel");
        Room room = createRoom(hotel, "Partner Analytics Room", 4);

        LocalDate pendingCheckIn = LocalDate.now().plusDays(1);
        LocalDate pendingCheckOut = pendingCheckIn.plusDays(1);
        LocalDate confirmedCheckIn = LocalDate.now().plusDays(3);
        LocalDate confirmedCheckOut = confirmedCheckIn.plusDays(1);
        LocalDate completedCheckIn = LocalDate.now().plusDays(7);
        LocalDate completedCheckOut = completedCheckIn.plusDays(1);
        LocalDate refundedCheckIn = LocalDate.now().plusDays(5);
        LocalDate refundedCheckOut = refundedCheckIn.plusDays(1);

        initInventory(room, pendingCheckIn, pendingCheckOut);
        initInventory(room, confirmedCheckIn, confirmedCheckOut);
        initInventory(room, completedCheckIn, completedCheckOut);
        initInventory(room, refundedCheckIn, refundedCheckOut);

        long pendingBookingId = createBooking(customerToken, room.getId(), pendingCheckIn, pendingCheckOut, "pending@test.com");
        long confirmedBookingId = createBooking(customerToken, room.getId(), confirmedCheckIn, confirmedCheckOut, "confirmed@test.com");
        long completedBookingId = createBooking(customerToken, room.getId(), completedCheckIn, completedCheckOut, "completed@test.com");
        long refundedBookingId = createBooking(customerToken, room.getId(), refundedCheckIn, refundedCheckOut, "refunded@test.com");

        payBooking(customerToken, confirmedBookingId, "analytics-pay-confirmed");
        payBooking(customerToken, completedBookingId, "analytics-pay-completed");
        payBooking(customerToken, refundedBookingId, "analytics-pay-refunded");
        LocalDate cPastIn = LocalDate.now().minusDays(3);
        LocalDate cPastOut = LocalDate.now().minusDays(2);
        initInventory(room, cPastIn, cPastOut);
        inventoryService.reserveInventory(room.getId(), cPastIn, cPastOut, 1);
        moveBookingStay(completedBookingId, cPastIn, cPastOut);

        mockMvc.perform(post("/api/partner/bookings/{bookingId}/complete", completedBookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));

        mockMvc.perform(post("/api/partner/bookings/{bookingId}/refund", refundedBookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "clientRequestId": "analytics-refund-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REFUNDED"));

        mockMvc.perform(get("/api/partner/analytics/summary")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .param("hotelId", String.valueOf(hotel.getId()))
                        .param("checkInFrom", LocalDate.now().minusDays(3).toString())
                        .param("checkInTo", refundedCheckIn.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.hotelIdFilter").value(hotel.getId()))
                .andExpect(jsonPath("$.data.totalBookings").value(4))
                .andExpect(jsonPath("$.data.pendingPaymentBookings").value(1))
                .andExpect(jsonPath("$.data.confirmedBookings").value(1))
                .andExpect(jsonPath("$.data.completedBookings").value(1))
                .andExpect(jsonPath("$.data.refundedBookings").value(1))
                .andExpect(jsonPath("$.data.cancelledBookings").value(0))
                .andExpect(jsonPath("$.data.grossRevenue").value(3_000_000.0))
                .andExpect(jsonPath("$.data.refundedAmount").value(1_000_000.0))
                .andExpect(jsonPath("$.data.netRevenue").value(2_000_000.0))
                .andExpect(jsonPath("$.data.hotels.length()").value(1))
                .andExpect(jsonPath("$.data.hotels[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.hotels[0].totalBookings").value(4));

        assertThat(bookingRepository.findById(pendingBookingId)).isPresent();
    }

    private User createUser(String email, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private Hotel createHotel(User owner, String name) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince("Bangkok");
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

    private void initInventory(Room room, LocalDate checkIn, LocalDate checkOut) {
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
    }

    private long createBooking(String customerToken, Long roomId, LocalDate checkIn, LocalDate checkOut, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [
                                    {
                                      "roomId": %d,
                                      "quantity": 1
                                    }
                                  ],
                                  "contact": {
                                    "fullName": "Partner Detail Customer",
                                    "email": "%s",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId, email)))
                .andExpect(status().isCreated())
                .andReturn();

        return readBookingId(result);
    }

    private void payBooking(String customerToken, long bookingId, String clientRequestId) throws Exception {
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

    private void moveBookingStay(long bookingId, LocalDate checkIn, LocalDate checkOut) {
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setCheckIn(checkIn);
        booking.setCheckOut(checkOut);
        bookingRepository.save(booking);
    }

    private long readBookingId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
