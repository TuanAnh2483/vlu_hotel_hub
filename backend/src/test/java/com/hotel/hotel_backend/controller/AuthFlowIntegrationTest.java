package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.PasswordResetToken;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.repository.EmailVerificationTokenRepository;
import com.hotel.hotel_backend.repository.PartnerApplicationRepository;
import com.hotel.hotel_backend.repository.PasswordResetTokenRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PartnerApplicationRepository partnerApplicationRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Autowired
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        partnerApplicationRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        emailVerificationTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @org.junit.jupiter.api.Disabled("auth-demo.html static file was removed")
    void authDemoPageShouldBePublic() throws Exception {
        mockMvc.perform(get("/auth-demo.html"))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .contains("Email Verify Test Bench"));
    }

    @Test
    void registerVerifyLoginMeLogoutAndRoleGuardShouldWork() throws Exception {
        MvcResult registerResult = register("customer@example.com", "Password123");
        String verificationToken = readText(registerResult, "data", "verificationToken");
        User pendingUser = userRepository.findByEmail("customer@example.com").orElseThrow();

        assertThat(pendingUser.getStatus()).isEqualTo(com.hotel.hotel_backend.entity.UserStatus.ACTIVE);
        assertThat(pendingUser.isEmailVerified()).isFalse();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "customer@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("EMAIL_NOT_VERIFIED"));

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(verificationToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"))
                .andExpect(jsonPath("$.data.verifiedAt").exists());

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(verificationToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email is already verified"));

        User verifiedUser = userRepository.findByEmail("customer@example.com").orElseThrow();
        assertThat(verifiedUser.getStatus()).isEqualTo(com.hotel.hotel_backend.entity.UserStatus.ACTIVE);
        assertThat(verifiedUser.isEmailVerified()).isTrue();

        String token = loginAndExtractToken("customer@example.com", "Password123");

        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.email").value("customer@example.com"))
                .andExpect(jsonPath("$.data.userType").value("CUSTOMER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.emailVerified").value(true));

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "customer@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.user.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.user.emailVerified").value(true));
    }

    @Test
    void resendVerificationShouldRotateTokenAndKeepResponseGeneric() throws Exception {
        MvcResult registerResult = register("resend@example.com", "Password123");
        String firstToken = readText(registerResult, "data", "verificationToken");

        MvcResult resendResult = mockMvc.perform(post("/api/auth/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "resend@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").exists())
                .andExpect(jsonPath("$.data.deliveryMode").value("EMAIL_LOG"))
                .andExpect(jsonPath("$.data.verificationToken").isString())
                .andReturn();

        String secondToken = readText(resendResult, "data", "verificationToken");
        assertThat(secondToken).isNotEqualTo(firstToken);

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(firstToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(secondToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"));

        mockMvc.perform(post("/api/auth/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "resend@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deliveryMode").value("EMAIL_LOG"))
                .andExpect(jsonPath("$.data.verificationToken").isEmpty());
    }

    @Test
    void verifyEmailShouldIgnoreInvalidBearerHeaderBecauseEndpointIsPublic() throws Exception {
        MvcResult registerResult = register("public-verify@example.com", "Password123");
        String verificationToken = readText(registerResult, "data", "verificationToken");

        mockMvc.perform(post("/api/auth/verify-email")
                        .header(HttpHeaders.AUTHORIZATION, bearer("invalid-jwt-token"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(verificationToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"));
    }

    @Test
    void registerShouldResendVerificationForUnverifiedEmailWithoutOverwritingPassword() throws Exception {
        MvcResult firstRegister = register("pending@example.com", "Password123");
        String firstToken = readText(firstRegister, "data", "verificationToken");

        MvcResult secondRegister = register("pending@example.com", "OtherPassword123");
        String secondToken = readText(secondRegister, "data", "verificationToken");

        assertThat(secondToken).isNotEqualTo(firstToken);
        assertThat(userRepository.count()).isEqualTo(1);

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(firstToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(secondToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "pending@example.com",
                                  "password": "OtherPassword123"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "pending@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("pending@example.com"))
                .andExpect(jsonPath("$.data.user.emailVerified").value(true));
    }

    @Test
    void customerShouldStartPartnerOnboardingOnce() throws Exception {
        String token = registerVerifyAndLogin("partner-candidate@example.com", "Password123");

        mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "businessName": "Sunrise Suites",
                                  "email": "partner-candidate@example.com",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.businessName").value("Sunrise Suites"));

        mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "businessName": "Sunrise Suites",
                                  "email": "partner-candidate@example.com",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("PARTNER_APPLICATION_EXISTS"));
    }

    @Test
    void unverifiedCustomerShouldNotStartPartnerOnboardingEvenWithJwt() throws Exception {
        register("partner-unverified@example.com", "Password123");
        User unverifiedUser = userRepository.findByEmail("partner-unverified@example.com").orElseThrow();
        String token = jwtService.generate(unverifiedUser);

        mockMvc.perform(post("/api/partner-onboarding/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "businessName": "Blocked Suites",
                                  "email": "partner-unverified@example.com",
                                  "phone": "01234567",
                                  "taxCode": "1234567890",
                                  "propertyType": "HOTEL"
                                }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("EMAIL_NOT_VERIFIED"));
    }

    @Test
    void forgotAndResetPasswordShouldInvalidateOldSessionsAndAllowNewLogin() throws Exception {
        String oldAccessToken = registerVerifyAndLogin("reset-me@example.com", "Password123");

        MvcResult forgotPasswordResult = mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "reset-me@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").exists())
                .andExpect(jsonPath("$.data.deliveryMode").value("EMAIL_LOG"))
                .andExpect(jsonPath("$.data.resetToken").isString())
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andReturn();

        User resetUser = userRepository.findByEmail("reset-me@example.com").orElseThrow();
        PasswordResetToken resetTokenEntity = passwordResetTokenRepository
                .findFirstByUserIdOrderByCreatedAtDesc(resetUser.getId())
                .orElseThrow();
        String resetToken = readText(forgotPasswordResult, "data", "resetToken");
        assertThat(resetToken).isEqualTo(resetTokenEntity.getToken());

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s",
                                  "newPassword": "NewPassword123",
                                  "confirmPassword": "NewPassword123"
                                }
                                """.formatted(resetToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").value("Password has been reset successfully"));

        mockMvc.perform(get("/api/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(oldAccessToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "reset-me@example.com",
                                  "password": "Password123"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "reset-me@example.com",
                                  "password": "NewPassword123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value("reset-me@example.com"));

        mockMvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s",
                                  "newPassword": "OtherPassword123",
                                  "confirmPassword": "OtherPassword123"
                                }
                                """.formatted(resetToken)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void forgotPasswordShouldReturnGenericSuccessForUnknownEmail() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "unknown@example.com"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").exists())
                .andExpect(jsonPath("$.data.deliveryMode").value("EMAIL_LOG"))
                .andExpect(jsonPath("$.data.resetToken").isEmpty());

        assertThat(passwordResetTokenRepository.count()).isZero();
    }

    private MvcResult register(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/register")
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
                .andExpect(jsonPath("$.data.message").value("Registration successful. Please verify your email before logging in"))
                .andExpect(jsonPath("$.data.deliveryMode").value("EMAIL_LOG"))
                .andExpect(jsonPath("$.data.verificationToken").isString())
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andReturn();
    }

    private String registerVerifyAndLogin(String email, String password) throws Exception {
        MvcResult registerResult = register(email, password);
        verifyEmail(readText(registerResult, "data", "verificationToken"));
        return loginAndExtractToken(email, password);
    }

    private void verifyEmail(String verificationToken) throws Exception {
        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "token": "%s"
                                }
                                """.formatted(verificationToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"));
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
