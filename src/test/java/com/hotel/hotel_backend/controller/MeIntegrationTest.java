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
import com.hotel.hotel_backend.repository.RefundRequestRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeIntegrationTest {

    @Autowired private MockMvc mockMvc;
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
    @Autowired private PasswordEncoder passwordEncoder;

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
    void customerShouldGetOwnUserInfo() throws Exception {
        User user = createVerifiedUser("me-info@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("me-info@test.com"))
                .andExpect(jsonPath("$.data.userType").value("CUSTOMER"));
    }

    @Test
    void partnerShouldGetOwnUserInfo() throws Exception {
        User user = createVerifiedUser("me-partner@test.com", UserType.PARTNER);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userType").value("PARTNER"));
    }

    @Test
    void customerShouldGetProfile() throws Exception {
        User user = createVerifiedUser("me-profile@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/me/profile")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void customerShouldUpdateProfile() throws Exception {
        User user = createVerifiedUser("me-update@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(put("/api/me/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "fullName": "Nguyen Van A",
                                  "phone": "0901234567",
                                  "bio": "Test bio update"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/me/profile")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Nguyen Van A"));
    }

    @Test
    void partnerShouldUpdateBusinessProfile() throws Exception {
        User user = createVerifiedUser("me-partner-update@test.com", UserType.PARTNER);
        String token = jwtService.generate(user);

        mockMvc.perform(put("/api/me/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "brandName": "My Hotel Brand",
                                  "taxCode": "0123456789",
                                  "representativeName": "Tran Thi B",
                                  "businessType": "Company"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/me/profile")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.brandName").value("My Hotel Brand"));
    }

    @Test
    void customerShouldUpdateNotificationPreferences() throws Exception {
        User user = createVerifiedUser("me-prefs@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(put("/api/me/preferences")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "loginAlertEnabled": true,
                                  "bookingUpdateEnabled": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void customerShouldGetBillingItems() throws Exception {
        User user = createVerifiedUser("me-billing@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/me/billing")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void customerShouldGetEmptyNotifications() throws Exception {
        User user = createVerifiedUser("me-notifs@test.com", UserType.CUSTOMER);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/me/notifications")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void customerShouldChangePasswordAndLoginWithNewPassword() throws Exception {
        User user = new User();
        user.setEmail("me-changepass@test.com");
        user.setPasswordHash(passwordEncoder.encode("OldPass123"));
        user.setUserType(UserType.CUSTOMER);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        user = userRepository.save(user);
        String token = jwtService.generate(user);

        mockMvc.perform(post("/api/me/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "currentPassword": "OldPass123",
                                  "newPassword": "NewPass456!",
                                  "confirmPassword": "NewPass456!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Old password login should fail
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "me-changepass@test.com",
                                  "password": "OldPass123"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        // New password login should succeed
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "me-changepass@test.com",
                                  "password": "NewPass456!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isString());
    }

    @Test
    void changePasswordShouldFailWithWrongCurrentPassword() throws Exception {
        User user = new User();
        user.setEmail("me-wrongpass@test.com");
        user.setPasswordHash(passwordEncoder.encode("CorrectPass123"));
        user.setUserType(UserType.CUSTOMER);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        user = userRepository.save(user);
        String token = jwtService.generate(user);

        mockMvc.perform(post("/api/me/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "currentPassword": "WrongPass000",
                                  "newPassword": "NewPass456!",
                                  "confirmPassword": "NewPass456!"
                                }
                                """))
                .andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void unauthenticatedShouldNotAccessMeEndpoints() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/me/profile"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/me/billing"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/me/notifications"))
                .andExpect(status().isUnauthorized());
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

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
