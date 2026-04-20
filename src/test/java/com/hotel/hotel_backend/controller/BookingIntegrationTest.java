package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyRate;
import com.hotel.hotel_backend.entity.DailyRateId;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.BookingExpirationJob;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingIntegrationTest {

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
    private RoomRepository roomRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private BookingExpirationJob bookingExpirationJob;

    private LocalDate checkIn;
    private LocalDate checkOut;

    @BeforeEach
    void setUp() {
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();

        checkIn = LocalDate.now().plusDays(1);
        checkOut = checkIn.plusDays(2);
    }

    @Test
    void quoteShouldCalculateStayPricingWithoutPersistingBookingOrBlockingInventory() throws Exception {
        String customerToken = createToken("customer-quote@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-quote@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Quote Hotel");
        Room room = createRoom(hotel, "Quote Room", 2);
        initInventory(room);
        createDailyRate(room, checkIn, 600_000L, 1, false);
        createDailyRate(room, checkIn.plusDays(1), 650_000L, 1, false);

        mockMvc.perform(post("/api/bookings/quote")
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
                                  ]
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.hotelName").value("Quote Hotel"))
                .andExpect(jsonPath("$.data.totalPrice").value(1_250_000.0))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(room.getId()))
                .andExpect(jsonPath("$.data.items[0].stayPrice").value(1_250_000.0));

        assertThat(bookingRepository.count()).isZero();

        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                checkIn,
                checkOut.minusDays(1)
        );
        assertThat(inventories).allMatch(inventory -> inventory.getBlockedRooms() == 0);
    }

    @Test
    void customerShouldCreateBookingUsingStayPricingAndListIt() throws Exception {
        String customerToken = createToken("customer-booking@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-booking@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Booking Hotel");
        Room room = createRoom(hotel, "Suite Room", 2);
        initInventory(room);
        createDailyRate(room, checkIn, 800_000L, 1, false);
        createDailyRate(room, checkIn.plusDays(1), 900_000L, 1, false);

        mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Booking Customer",
                                    "email": "customer-booking@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.checkIn").value(checkIn.toString()))
                .andExpect(jsonPath("$.data.checkOut").value(checkOut.toString()))
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.totalPrice").value(1_700_000.0))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(room.getId()))
                .andExpect(jsonPath("$.data.items[0].stayPrice").value(1_700_000.0))
                .andExpect(jsonPath("$.data.contact.fullName").value("Booking Customer"));

        mockMvc.perform(get("/api/bookings/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].totalPrice").value(1_700_000.0))
                .andExpect(jsonPath("$.data[0].items[0].roomTypeId").value(room.getId()));
    }

    @Test
    void customerShouldGetOwnedBookingDetail() throws Exception {
        String customerToken = createToken("customer-booking-detail@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-booking-detail@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Booking Detail Hotel");
        Room room = createRoom(hotel, "Booking Detail Room", 2);
        initInventory(room);
        createDailyRate(room, checkIn, 800_000L, 1, false);
        createDailyRate(room, checkIn.plusDays(1), 900_000L, 1, false);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Booking Detail Customer",
                                    "email": "customer-booking-detail@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(get("/api/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.checkIn").value(checkIn.toString()))
                .andExpect(jsonPath("$.data.checkOut").value(checkOut.toString()))
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.totalPrice").value(1_700_000.0))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.contact.fullName").value("Booking Detail Customer"));
    }

    @Test
    void getBookingDetailShouldReturnNotFoundWhenBookingDoesNotExist() throws Exception {
        String customerToken = createToken("customer-booking-detail-404@test.com", UserType.CUSTOMER);

        mockMvc.perform(get("/api/bookings/{bookingId}", 999999L)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void getBookingDetailShouldReturnNotFoundWhenBookingBelongsToAnotherUser() throws Exception {
        String ownerToken = createToken("customer-booking-owner@test.com", UserType.CUSTOMER);
        String strangerToken = createToken("customer-booking-stranger@test.com", UserType.CUSTOMER);
        User partner = createUser("partner-booking-other@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(partner, "Booking Other User Hotel");
        Room room = createRoom(hotel, "Booking Other User Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken))
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
                                    "fullName": "Booking Owner Customer",
                                    "email": "customer-booking-owner@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(get("/api/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void quoteShouldRejectRoomThatIsClosedForStay() throws Exception {
        String customerToken = createToken("customer-quote-closed@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-quote-closed@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Quote Closed Hotel");
        Room room = createRoom(hotel, "Quote Closed Room", 1);
        initInventory(room);
        createDailyRate(room, checkIn, 500_000L, 1, false);
        createDailyRate(room, checkIn.plusDays(1), 500_000L, 1, true);

        mockMvc.perform(post("/api/bookings/quote")
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
                                  ]
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void cancelBookingShouldReleaseInventory() throws Exception {
        String customerToken = createToken("customer-cancel@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-cancel@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Cancel Hotel");
        Room room = createRoom(hotel, "Cancel Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Cancel Customer",
                                    "email": "customer-cancel@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(post("/api/bookings/{bookingId}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                checkIn,
                checkOut.minusDays(1)
        );
        assertThat(inventories).allMatch(inventory -> inventory.getBlockedRooms() == 0);
    }

    @Test
    void payShouldConfirmPendingPaymentBooking() throws Exception {
        String customerToken = createToken("customer-pay@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-pay@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Pay Hotel");
        Room room = createRoom(hotel, "Pay Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Pay Customer",
                                    "email": "customer-pay@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "pay-success-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        var transactions = paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        assertThat(transactions).hasSize(1);
        assertThat(transactions.get(0).getStatus().name()).isEqualTo("SUCCESS");
        assertThat(transactions.get(0).getMethod().name()).isEqualTo("SIMULATED");
        assertThat(transactions.get(0).getFailureReason()).isNull();
    }

    @Test
    void payRetryWithSameClientRequestIdShouldReturnSameSuccessWithoutNewTransaction() throws Exception {
        String customerToken = createToken("customer-pay-retry-success@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-pay-retry-success@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Pay Retry Success Hotel");
        Room room = createRoom(hotel, "Pay Retry Success Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Pay Retry Success Customer",
                                    "email": "customer-pay-retry-success@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        String paymentBody = """
                {
                  "simulateSuccess": true,
                  "clientRequestId": "pay-retry-success-1"
                }
                """;

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content(paymentBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content(paymentBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        var transactions = paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        assertThat(transactions).hasSize(1);
        assertThat(transactions.get(0).getClientRequestId()).isEqualTo("pay-retry-success-1");
        assertThat(transactions.get(0).getStatus().name()).isEqualTo("SUCCESS");
    }

    @Test
    void payFailureShouldKeepBookingPendingPayment() throws Exception {
        String customerToken = createToken("customer-pay-fail@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-pay-fail@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Pay Fail Hotel");
        Room room = createRoom(hotel, "Pay Fail Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Pay Fail Customer",
                                    "email": "customer-pay-fail@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": false,
                                  "clientRequestId": "pay-fail-1"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        mockMvc.perform(get("/api/bookings/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("PENDING_PAYMENT"));

        var transactions = paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        assertThat(transactions).hasSize(1);
        assertThat(transactions.get(0).getStatus().name()).isEqualTo("FAILED");
        assertThat(transactions.get(0).getFailureReason()).isEqualTo("Payment failed");
    }

    @Test
    void payRetryWithSameClientRequestIdShouldReturnSameFailureWithoutNewTransaction() throws Exception {
        String customerToken = createToken("customer-pay-retry-fail@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-pay-retry-fail@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Pay Retry Fail Hotel");
        Room room = createRoom(hotel, "Pay Retry Fail Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Pay Retry Fail Customer",
                                    "email": "customer-pay-retry-fail@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        String paymentBody = """
                {
                  "simulateSuccess": false,
                  "clientRequestId": "pay-retry-fail-1"
                }
                """;

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content(paymentBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content(paymentBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        var transactions = paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        assertThat(transactions).hasSize(1);
        assertThat(transactions.get(0).getClientRequestId()).isEqualTo("pay-retry-fail-1");
        assertThat(transactions.get(0).getStatus().name()).isEqualTo("FAILED");
        assertThat(transactions.get(0).getFailureReason()).isEqualTo("Payment failed");
    }

    @Test
    void getBookingPaymentsShouldReturnPaymentTimelineForOwnedBooking() throws Exception {
        String customerToken = createToken("customer-payments@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-payments@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Payment Timeline Hotel");
        Room room = createRoom(hotel, "Payment Timeline Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Payment Timeline Customer",
                                    "email": "customer-payments@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andReturn();

        long bookingId = readBookingId(createResult);

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": false,
                                  "clientRequestId": "timeline-fail-1"
                                }
                                """))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "timeline-success-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        mockMvc.perform(get("/api/bookings/{bookingId}/payments", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].status").value("FAILED"))
                .andExpect(jsonPath("$.data[0].method").value("SIMULATED"))
                .andExpect(jsonPath("$.data[0].failureReason").value("Payment failed"))
                .andExpect(jsonPath("$.data[0].clientRequestId").value("timeline-fail-1"))
                .andExpect(jsonPath("$.data[0].createdAt").exists())
                .andExpect(jsonPath("$.data[1].status").value("SUCCESS"))
                .andExpect(jsonPath("$.data[1].method").value("SIMULATED"))
                .andExpect(jsonPath("$.data[1].failureReason").doesNotExist())
                .andExpect(jsonPath("$.data[1].clientRequestId").value("timeline-success-1"))
                .andExpect(jsonPath("$.data[1].providerReference").exists())
                .andExpect(jsonPath("$.data[1].createdAt").exists());
    }

    @Test
    void payShouldExpirePendingPaymentBookingAndReleaseInventoryWhenTtlHasPassed() throws Exception {
        String customerToken = createToken("customer-pay-expired@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-pay-expired@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Pay Expired Hotel");
        Room room = createRoom(hotel, "Pay Expired Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Pay Expired Customer",
                                    "email": "customer-pay-expired@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = readBookingId(createResult);
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        bookingRepository.save(booking);

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "pay-expired-1"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        mockMvc.perform(get("/api/bookings/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("CANCELLED"));

        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                checkIn,
                checkOut.minusDays(1)
        );
        assertThat(inventories).allMatch(inventory -> inventory.getBlockedRooms() == 0);

        var transactions = paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        assertThat(transactions).hasSize(1);
        assertThat(transactions.get(0).getStatus().name()).isEqualTo("FAILED");
        assertThat(transactions.get(0).getFailureReason()).isEqualTo("Booking is not waiting for payment");
    }

    @Test
    void expirationJobShouldCancelExpiredPendingPaymentBookingAndReleaseInventory() throws Exception {
        String customerToken = createToken("customer-job-expired@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-job-expired@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Job Expired Hotel");
        Room room = createRoom(hotel, "Job Expired Room", 1);
        initInventory(room);

        MvcResult createResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Job Expired Customer",
                                    "email": "customer-job-expired@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = readBookingId(createResult);
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        bookingRepository.save(booking);

        bookingExpirationJob.expirePendingBookings();

        var expiredBooking = bookingRepository.findById(bookingId).orElseThrow();
        assertThat(expiredBooking.getStatus().name()).isEqualTo("CANCELLED");
        assertThat(expiredBooking.getExpiresAt()).isNull();

        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                checkIn,
                checkOut.minusDays(1)
        );
        assertThat(inventories).allMatch(inventory -> inventory.getBlockedRooms() == 0);
    }

    @Test
    void bookingShouldRejectRoomThatIsClosedForStay() throws Exception {
        String customerToken = createToken("customer-closed@test.com", UserType.CUSTOMER);
        User owner = createUser("partner-closed@test.com", UserType.PARTNER);

        Hotel hotel = createHotel(owner, "Closed Hotel");
        Room room = createRoom(hotel, "Closed Room", 1);
        initInventory(room);
        createDailyRate(room, checkIn, 700_000L, 1, false);
        createDailyRate(room, checkIn.plusDays(1), 700_000L, 1, true);

        mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Closed Customer",
                                    "email": "customer-closed@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    private String createToken(String email, UserType userType) {
        return jwtService.generate(createUser(email, userType));
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

    private void initInventory(Room room) {
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
    }

    private void createDailyRate(Room room, LocalDate date, long price, int minStay, boolean closed) {
        DailyRate dailyRate = new DailyRate();
        dailyRate.setId(new DailyRateId(room.getId(), date));
        dailyRate.setRoom(room);
        dailyRate.setPrice(price);
        dailyRate.setMinStay(minStay);
        dailyRate.setClosed(closed);
        dailyRateRepository.save(dailyRate);
    }

    private long readBookingId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
