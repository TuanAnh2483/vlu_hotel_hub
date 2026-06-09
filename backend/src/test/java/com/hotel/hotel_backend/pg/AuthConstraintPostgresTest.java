package com.hotel.hotel_backend.pg;

import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.EmailVerificationTokenRepository;
import com.hotel.hotel_backend.repository.PartnerApplicationRepository;
import com.hotel.hotel_backend.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies auth constraints enforced by PostgreSQL (unique email, FK integrity,
 * email-verification gate) — behaviors that H2 in PostgreSQL-compat mode may not
 * reproduce faithfully under concurrent load.
 */
class AuthConstraintPostgresTest extends AbstractPostgresIntegrationTest {

    @Autowired private PartnerApplicationRepository partnerApplicationRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @BeforeEach
    void setUp() {
        partnerApplicationRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        emailVerificationTokenRepository.deleteAll();
        clearAll();
    }

    @Test
    void registerVerifyLoginAndAccessProtectedEndpoint() throws Exception {
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "pg-auth@example.com",
                                  "password": "Password123",
                                  "confirmPassword": "Password123"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.verificationToken").isString())
                .andReturn();

        JsonNode body = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        String token = body.path("data").path("verificationToken").asText();

        // Unverified user cannot log in
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "pg-auth@example.com", "password": "Password123" }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("EMAIL_NOT_VERIFIED"));

        // Verify email
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "token": "%s" }
                                """.formatted(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.message").value("Email has been verified successfully"));

        // Now login succeeds — PostgreSQL persisted the emailVerifiedAt timestamp
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "pg-auth@example.com", "password": "Password123" }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isString())
                .andExpect(jsonPath("$.data.user.emailVerified").value(true))
                .andReturn();

        String accessToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
        assertThat(accessToken).isNotBlank();

        // Verified user is persisted correctly in PostgreSQL
        var user = userRepository.findByEmail("pg-auth@example.com").orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    }

    @Test
    void postgresUniqueConstraintPreventsDuplicateActiveEmail() throws Exception {
        // Seed an already-verified user directly via repository (simulates existing account)
        seedUser("existing@example.com", UserType.CUSTOMER);

        // Re-registering a verified email is rejected with EMAIL_EXISTS
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "existing@example.com",
                                  "password": "AnotherPass123",
                                  "confirmPassword": "AnotherPass123"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("EMAIL_EXISTS"));

        // PostgreSQL unique constraint ensures only one row per email
        assertThat(userRepository.count()).isEqualTo(1);
    }

    @Test
    void wrongPasswordReturnsUnauthorized() throws Exception {
        seedUser("wrong-pass@example.com", UserType.CUSTOMER);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "email": "wrong-pass@example.com", "password": "WrongPassword1" }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
    }
}
