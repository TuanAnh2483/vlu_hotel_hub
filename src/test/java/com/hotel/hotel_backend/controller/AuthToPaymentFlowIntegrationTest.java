package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.PartnerApplicationRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthToPaymentFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PartnerApplicationRepository partnerApplicationRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomUnitRepository roomUnitRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @BeforeEach
    void setUp() {
        paymentTransactionRepository.deleteAll();
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        partnerApplicationRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void loginToPaymentFlowShouldStayConsistentAcrossAuthPartnerSearchBookingAndPayment() throws Exception {
        LocalDate checkIn = LocalDate.now().plusDays(7);
        LocalDate checkOut = checkIn.plusDays(2);

        createUser("admin-flow@test.com", "Password123", UserType.ADMIN);

        String onboardingToken = registerVerifyAndLogin("partner-flow@test.com", "Password123");
        registerVerifyAndLogin("customer-flow@test.com", "Password123");

        MvcResult startResult = mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(onboardingToken))
                        .content("""
                                {
                                  "businessName": "Flow Suites",
                                  "email": "partner-flow@test.com",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();

        long applicationId = readLong(startResult, "data", "id");

        mockMvc.perform(post("/api/partner-onboarding/{applicationId}/submit", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(onboardingToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        String adminToken = loginAndExtractToken("admin-flow@test.com", "Password123");
        mockMvc.perform(post("/api/admin/partner-applications/{applicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(applicationId))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(onboardingToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        String partnerToken = loginAndExtractToken("partner-flow@test.com", "Password123");
        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("partner-flow@test.com"))
                .andExpect(jsonPath("$.data.userType").value("PARTNER"));

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Flow Suites Hotel",
                                  "address": "123 Flow Street",
                                  "district": "District 1",
                                  "province": "Bangkok",
                                  "description": "End-to-end flow hotel",
                                  "hotelType": "HOTEL",
                                  "amenities": ["PARKING"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Flow Suites Hotel"))
                .andReturn();

        long hotelId = readLong(hotelResult, "data", "id");

        MvcResult roomResult = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Flow Room",
                                  "capacity": 2,
                                  "quantity": 3,
                                  "price": 1200000,
                                  "roomCategory": "STANDARD",
                                  "bedType": "DOUBLE",
                                  "amenities": ["TV"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Flow Room"))
                .andExpect(jsonPath("$.data.quantity").value(3))
                .andReturn();

        long roomId = readLong(roomResult, "data", "id");

        String customerToken = loginAndExtractToken("customer-flow@test.com", "Password123");
        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("customer-flow@test.com"))
                .andExpect(jsonPath("$.data.userType").value("CUSTOMER"));

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "recommended"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.sort").value("recommended"))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(2400000));

        mockMvc.perform(get("/api/hotels/{hotelId}", hotelId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.name").value("Flow Suites Hotel"));

        mockMvc.perform(get("/api/hotels/{hotelId}/available-rooms", hotelId)
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].roomId").value(roomId))
                .andExpect(jsonPath("$.data[0].availableUnits").value(3))
                .andExpect(jsonPath("$.data[0].stayPrice").value(2400000));

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
                                """.formatted(checkIn, checkOut, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.totalPrice").value(2400000.0))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(roomId));

        MvcResult bookingResult = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Flow Customer",
                                    "email": "customer-flow@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(roomId))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andReturn();

        long bookingId = readLong(bookingResult, "data", "bookingId");

        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "flow-pay-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.expiresAt").doesNotExist());

        mockMvc.perform(get("/api/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));

        mockMvc.perform(get("/api/bookings/{bookingId}/payments", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.data[0].clientRequestId").value("flow-pay-1"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"));

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.contact.email").value("customer-flow@test.com"))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    private void createUser(String email, String password, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(java.time.OffsetDateTime.now());
        userRepository.save(user);
    }

    private String registerVerifyAndLogin(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s",
                                  "confirmPassword": "%s"
                                }
                                """.formatted(email, password, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verificationToken").isString())
                .andReturn();

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(readText(result, "data", "verificationToken"))))
                .andExpect(status().isOk());

        return loginAndExtractToken(email, password);
    }

    private String loginAndExtractToken(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andReturn();

        return readText(result, "data", "accessToken");
    }

    private long readLong(MvcResult result, String... path) throws Exception {
        JsonNode current = objectMapper.readTree(result.getResponse().getContentAsString());
        for (String key : path) {
            current = current.path(key);
        }
        return current.asLong();
    }

    private String readText(MvcResult result, String... path) throws Exception {
        JsonNode current = objectMapper.readTree(result.getResponse().getContentAsString());
        for (String key : path) {
            current = current.path(key);
        }
        return current.asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
