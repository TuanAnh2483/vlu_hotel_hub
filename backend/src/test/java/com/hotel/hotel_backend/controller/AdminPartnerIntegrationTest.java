package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.PartnerApplicationStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.HotelReviewRepository;
import com.hotel.hotel_backend.repository.PartnerApplicationRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RefundRequestRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminPartnerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private HotelReviewRepository hotelReviewRepository;

    @Autowired
    private RoomUnitRepository roomUnitRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private PartnerApplicationRepository partnerApplicationRepository;

    @Autowired
    private RefundRequestRepository refundRequestRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        partnerApplicationRepository.deleteAll();
        hotelReviewRepository.deleteAll();
        refundRequestRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void adminShouldApproveSubmittedPartnerApplication() throws Exception {
        String adminToken = createUserAndExtractToken("admin@example.com", "Password123", UserType.ADMIN);
        String customerToken = registerAndExtractToken("partner-review@example.com", "Password123");
        Long applicationId = startAndSubmitPartnerApplication(customerToken, "Sunrise Suites");

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/partner-applications")
                        .param("status", "SUBMITTED")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(applicationId))
                .andExpect(jsonPath("$.data[0].email").value("partner-review@example.com"))
                .andExpect(jsonPath("$.data[0].phone").value("01234567"))
                .andExpect(jsonPath("$.data[0].status").value("SUBMITTED"));

        mockMvc.perform(post("/api/admin/partner-applications/{applicationId}/approve", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(applicationId))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        User approvedUser = userRepository.findByEmail("partner-review@example.com").orElseThrow();
        assertThat(approvedUser.getUserType()).isEqualTo(UserType.PARTNER);
        assertThat(partnerApplicationRepository.findById(applicationId).orElseThrow().getStatus())
                .isEqualTo(PartnerApplicationStatus.APPROVED);

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk());
    }

    @Test
    void adminShouldRejectSubmittedPartnerApplication() throws Exception {
        String adminToken = createUserAndExtractToken("admin@example.com", "Password123", UserType.ADMIN);
        String customerToken = registerAndExtractToken("partner-reject@example.com", "Password123");
        Long applicationId = startAndSubmitPartnerApplication(customerToken, "Moonlight Villas");

        mockMvc.perform(post("/api/admin/partner-applications/{applicationId}/reject", applicationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .content("""
                                {
                                  "reason": "Missing business license"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(applicationId))
                .andExpect(jsonPath("$.data.status").value("REJECTED"));

        User rejectedUser = userRepository.findByEmail("partner-reject@example.com").orElseThrow();
        assertThat(rejectedUser.getUserType()).isEqualTo(UserType.CUSTOMER);
        var rejectedApplication = partnerApplicationRepository.findById(applicationId).orElseThrow();
        assertThat(rejectedApplication.getStatus()).isEqualTo(PartnerApplicationStatus.REJECTED);
        assertThat(rejectedApplication.getRejectReason()).isEqualTo("Missing business license");

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isForbidden());

        MvcResult restartResult = mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "businessName": "Restart Villas",
                                  "email": "partner-reject@example.com",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();

        long restartedApplicationId = objectMapper.readTree(restartResult.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asLong();

        assertThat(restartedApplicationId).isNotEqualTo(applicationId);
        assertThat(partnerApplicationRepository.findByUserIdOrderByIdDesc(rejectedUser.getId()))
                .extracting(application -> application.getStatus().name())
                .containsExactly("DRAFT", "REJECTED");
    }

    @Test
    void adminShouldCreateAndToggleUser() throws Exception {
        String adminToken = createUserAndExtractToken("admin-ops@example.com", "Password123", UserType.ADMIN);

        MvcResult createResult = mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .content("""
                                {
                                  "email": "new-partner@example.com",
                                  "password": "Password123",
                                  "userType": "PARTNER"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("new-partner@example.com"))
                .andExpect(jsonPath("$.data.userType").value("PARTNER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andReturn();

        long createdUserId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asLong();

        mockMvc.perform(post("/api/admin/users/{userId}/toggle-status", createdUserId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(createdUserId))
                .andExpect(jsonPath("$.data.status").value("LOCKED"));

        mockMvc.perform(get("/api/admin/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    private String createUserAndExtractToken(String email, String password, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(java.time.OffsetDateTime.now());
        user = userRepository.save(user);
        return jwtService.generate(user);
    }

    private Long startAndSubmitPartnerApplication(String token, String businessName) throws Exception {
        MvcResult startResult = mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "businessName": "%s",
                                  "email": "%s",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """.formatted(businessName, extractEmailFromToken(token))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn();

        JsonNode body = objectMapper.readTree(startResult.getResponse().getContentAsString());
        long applicationId = body.path("data").path("id").asLong();

        mockMvc.perform(post("/api/partner-onboarding/{applicationId}/submit", applicationId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        return applicationId;
    }

    private String registerAndExtractToken(String email, String password) throws Exception {
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
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.verificationToken").isString())
                .andReturn();

        String verificationToken = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("verificationToken")
                .asText();

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(verificationToken)))
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

        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("accessToken")
                .asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String extractEmailFromToken(String token) {
        return jwtService.parse(token).email();
    }
}
