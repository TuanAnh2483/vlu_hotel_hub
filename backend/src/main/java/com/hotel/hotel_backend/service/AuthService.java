package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.ForgotPasswordRequest;
import com.hotel.hotel_backend.dto.request.LoginRequest;
import com.hotel.hotel_backend.dto.request.RefreshTokenRequest;
import com.hotel.hotel_backend.dto.request.RegisterRequest;
import com.hotel.hotel_backend.dto.request.ResendVerificationRequest;
import com.hotel.hotel_backend.dto.request.ResetPasswordRequest;
import com.hotel.hotel_backend.dto.request.VerifyEmailRequest;
import com.hotel.hotel_backend.dto.response.AuthResponse;
import com.hotel.hotel_backend.dto.response.ForgotPasswordResponse;
import com.hotel.hotel_backend.dto.response.RefreshResponse;
import com.hotel.hotel_backend.dto.response.RegisterResponse;
import com.hotel.hotel_backend.dto.response.ResendVerificationResponse;
import com.hotel.hotel_backend.dto.response.ResetPasswordResponse;
import com.hotel.hotel_backend.dto.response.VerifyEmailResponse;
import com.hotel.hotel_backend.entity.EmailVerificationToken;
import com.hotel.hotel_backend.entity.PasswordResetToken;
import com.hotel.hotel_backend.entity.RefreshToken;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.BadRequestException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.EmailVerificationTokenRepository;
import com.hotel.hotel_backend.repository.PasswordResetTokenRepository;
import com.hotel.hotel_backend.repository.RefreshTokenRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.hotel.hotel_backend.dto.request.GoogleLoginRequest;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

@Service
public class AuthService {

    private static final long PASSWORD_RESET_TTL_MINUTES = 30;
    private static final long EMAIL_VERIFICATION_TTL_HOURS = 24;
    private static final long REFRESH_TOKEN_TTL_DAYS = 7;
    private static final String PASSWORD_RESET_MESSAGE =
            "If the account exists, a password reset token has been generated";
    private static final String REGISTER_MESSAGE =
            "Registration successful. Please verify your email before logging in";
    private static final String RESEND_VERIFICATION_MESSAGE =
            "If the account exists and the email is not verified, a verification email has been queued";

    private final UserRepository userRepo;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SecurityService securityService;
    private final PasswordResetEmailService passwordResetEmailService;
    private final EmailVerificationEmailService emailVerificationEmailService;
    private final boolean exposeDebugTokens;
    private final String googleClientId;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(
            UserRepository userRepo,
            EmailVerificationTokenRepository emailVerificationTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            SecurityService securityService,
            PasswordResetEmailService passwordResetEmailService,
            EmailVerificationEmailService emailVerificationEmailService,
            @Value("${app.mail.expose-debug-tokens:false}") boolean exposeDebugTokens,
            @Value("${google.client-id:}") String googleClientId
    ) {
        this.userRepo = userRepo;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.securityService = securityService;
        this.passwordResetEmailService = passwordResetEmailService;
        this.emailVerificationEmailService = emailVerificationEmailService;
        this.exposeDebugTokens = exposeDebugTokens;
        this.googleClientId = googleClientId;
    }

    private record RefreshTokenData(String rawToken, long expiresInSeconds) {}

    private RefreshTokenData issueNewRefreshToken(User user) {
        refreshTokenRepository.deleteByUserId(user.getId());
        String rawToken = generateOpaqueToken();
        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(hashToken(rawToken));
        rt.setExpiresAt(OffsetDateTime.now().plusDays(REFRESH_TOKEN_TTL_DAYS));
        refreshTokenRepository.save(rt);
        return new RefreshTokenData(rawToken, REFRESH_TOKEN_TTL_DAYS * 86400L);
    }

    private AuthResponse buildAuthResponse(User user, String accessToken) {
        RefreshTokenData rtd = issueNewRefreshToken(user);
        return new AuthResponse(
                accessToken,
                "Bearer",
                jwtService.getExpSeconds(),
                rtd.rawToken(),
                rtd.expiresInSeconds(),
                new AuthResponse.UserView(
                        user.getId(),
                        user.getEmail(),
                        user.getUserType().name(),
                        user.getStatus().name(),
                        user.isEmailVerified(),
                        user.getEmailVerifiedAt()
                )
        );
    }

    @Transactional
    public RegisterResponse register(@Valid RegisterRequest req) {
        return registerWithRole(req, UserType.CUSTOMER);
    }

    @Transactional
    public AuthResponse login(LoginRequest log) {
        String email = normalizeEmail(log.email());
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(log.password(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS,"sai email hoặc password");
        }

        assertActive(user);
        assertEmailVerified(user);

        String token = jwtService.generate(user);
        return buildAuthResponse(user, token);
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(@Valid ForgotPasswordRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepo.findByEmail(email).orElse(null);
        if (user == null || user.getStatus() != UserStatus.ACTIVE) {
            return new ForgotPasswordResponse(PASSWORD_RESET_MESSAGE, passwordResetEmailService.deliveryMode(), null, null);
        }

        passwordResetTokenRepository.deleteByUserId(user.getId());

        PasswordResetToken passwordResetToken = new PasswordResetToken();
        passwordResetToken.setUser(user);
        passwordResetToken.setToken(UUID.randomUUID().toString());
        passwordResetToken.setExpiresAt(OffsetDateTime.now().plusMinutes(PASSWORD_RESET_TTL_MINUTES));

        PasswordResetToken savedToken = passwordResetTokenRepository.save(passwordResetToken);
        PasswordResetEmailService.PasswordResetDelivery delivery = passwordResetEmailService.sendPasswordResetEmail(
                savedToken.getUser().getEmail(),
                savedToken.getToken(),
                savedToken.getExpiresAt()
        );

        return new ForgotPasswordResponse(
                PASSWORD_RESET_MESSAGE,
                delivery.deliveryMode(),
                exposeDebugTokens ? savedToken.getToken() : null,
                exposeDebugTokens ? savedToken.getExpiresAt() : null
        );
    }

    @Transactional
    public ResetPasswordResponse resetPassword(@Valid ResetPasswordRequest request) {
        PasswordResetToken passwordResetToken = passwordResetTokenRepository.findByToken(request.token())
                .orElseThrow(() -> new ApiException(
                        ErrorCode.NOT_FOUND,
                        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"
                ));

        if (passwordResetToken.getUsedAt() != null) {
            throw new ApiException(ErrorCode.CONFLICT, "Liên kết đặt lại mật khẩu đã được sử dụng");
        }
        if (passwordResetToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ApiException(ErrorCode.CONFLICT, "Liên kết đặt lại mật khẩu đã hết hạn");
        }

        User user = passwordResetToken.getUser();
        assertActive(user);

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        passwordResetToken.setUsedAt(OffsetDateTime.now());

        passwordResetTokenRepository.save(passwordResetToken);
        userRepo.save(user);

        return new ResetPasswordResponse("Password has been reset successfully");
    }

    @Transactional
    public VerifyEmailResponse verifyEmail(@Valid VerifyEmailRequest request) {
        EmailVerificationToken token = emailVerificationTokenRepository.findByTokenHash(hashToken(request.token()))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Email verification token not found"));

        User user = token.getUser();
        if (user.isEmailVerified()) {
            return new VerifyEmailResponse("Email is already verified", user.getEmailVerifiedAt());
        }
        if (token.getUsedAt() != null) {
            return new VerifyEmailResponse("Email is already verified", token.getUsedAt());
        }
        if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ApiException(ErrorCode.CONFLICT, "Email verification token expired");
        }

        OffsetDateTime verifiedAt = OffsetDateTime.now();
        user.setEmailVerifiedAt(verifiedAt);
        token.setUsedAt(verifiedAt);

        userRepo.save(user);
        emailVerificationTokenRepository.save(token);

        return new VerifyEmailResponse("Email has been verified successfully", verifiedAt);
    }

    @Transactional
    public ResendVerificationResponse resendVerification(@Valid ResendVerificationRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepo.findByEmail(email).orElse(null);

        if (user == null || user.isEmailVerified() || !canIssueVerification(user)) {
            return new ResendVerificationResponse(
                    RESEND_VERIFICATION_MESSAGE,
                    emailVerificationEmailService.deliveryMode(),
                    null,
                    null
            );
        }

        EmailVerificationDispatch dispatch = issueEmailVerification(user);
        return new ResendVerificationResponse(
                RESEND_VERIFICATION_MESSAGE,
                dispatch.deliveryMode(),
                dispatch.debugToken(),
                dispatch.expiresAt()
        );
    }

    @Transactional
    public RefreshResponse refresh(@Valid RefreshTokenRequest request) {
        String hash = hashToken(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Refresh token không hợp lệ"));

        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenRepository.delete(stored);
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
        }

        User user = stored.getUser();
        assertActive(user);

        // Rotate: xoá token cũ, phát token mới
        refreshTokenRepository.delete(stored);
        String newRaw = generateOpaqueToken();
        RefreshToken newRt = new RefreshToken();
        newRt.setUser(user);
        newRt.setTokenHash(hashToken(newRaw));
        newRt.setExpiresAt(OffsetDateTime.now().plusDays(REFRESH_TOKEN_TTL_DAYS));
        refreshTokenRepository.save(newRt);

        String newAccessToken = jwtService.generate(user);
        return new RefreshResponse(
                newAccessToken,
                "Bearer",
                jwtService.getExpSeconds(),
                newRaw,
                REFRESH_TOKEN_TTL_DAYS * 86400L
        );
    }

    @Transactional
    public void logout() {
        User currentUser = securityService.getCurrentUser();
        refreshTokenRepository.deleteByUserId(currentUser.getId());
        currentUser.setTokenVersion(currentUser.getTokenVersion() + 1);
        userRepo.save(currentUser);
    }

    private RegisterResponse registerWithRole(RegisterRequest req, UserType role) {
        String email = normalizeEmail(req.email());

        if (!Objects.equals(req.password(), req.confirmPassword())) {
            throw new BadRequestException("Mật khẩu xác nhận không khớp", ErrorCode.VALIDATION_ERROR);
        }

        User existingUser = userRepo.findByEmail(email).orElse(null);
        if (existingUser != null) {
            if (existingUser.isEmailVerified()) {
                // Security: don't reveal that this email already has a verified account
                return new RegisterResponse(REGISTER_MESSAGE, null, null, null);
            }
            if (!canIssueVerification(existingUser) || existingUser.getUserType() != role) {
                throw new ApiException(ErrorCode.EMAIL_EXISTS);
            }

            return buildRegisterResponse(issueEmailVerification(existingUser));
        }

        User user = createUser(email, req.password(), role);
        return buildRegisterResponse(issueEmailVerification(user));
    }

    @Transactional
    public AuthResponse googleLogin(@Valid GoogleLoginRequest request) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new IllegalStateException("GOOGLE_CLIENT_ID chưa được cấu hình");
        }

        GoogleIdToken.Payload payload = verifyGoogleCredential(request.credential());

        String email = normalizeEmail(payload.getEmail());
        Boolean emailVerified = payload.getEmailVerified();

        if (email == null || email.isBlank() || !Boolean.TRUE.equals(emailVerified)) {
            throw new ApiException(
                    ErrorCode.UNAUTHORIZED,
                    "Email Google không hợp lệ hoặc chưa được xác minh"
            );
        }

        User user = userRepo.findByEmail(email).orElseGet(() -> {
            User newUser = new User();
            newUser.setEmail(email);
            newUser.setUserType(UserType.CUSTOMER);
            newUser.setStatus(UserStatus.ACTIVE);
            newUser.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            newUser.setEmailVerifiedAt(OffsetDateTime.now());
            return userRepo.save(newUser);
        });

        assertActive(user);

        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(OffsetDateTime.now());
            userRepo.save(user);
        }

        String token = jwtService.generate(user);
        return buildAuthResponse(user, token);
    }

    private GoogleIdToken.Payload verifyGoogleCredential(String credential) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(credential);

            if (idToken == null) {
                throw new ApiException(ErrorCode.UNAUTHORIZED, "Google token không hợp lệ");
            }

            return idToken.getPayload();
        } catch (GeneralSecurityException | IOException ex) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "Không thể xác thực Google token");
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private User createUser(String email, String rawPassword, UserType role) {
        User user = new User();
        user.setEmail(email);
        user.setUserType(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        return userRepo.save(user);
    }

    private void assertActive(User user) {
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_INACTIVE);
        }
    }

    private void assertEmailVerified(User user) {
        if (!user.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, "Please verify your email before logging in");
        }
    }

    private EmailVerificationDispatch issueEmailVerification(User user) {
        emailVerificationTokenRepository.deleteByUserId(user.getId());

        String rawToken = generateOpaqueToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUser(user);
        token.setTokenHash(hashToken(rawToken));
        token.setExpiresAt(OffsetDateTime.now().plusHours(EMAIL_VERIFICATION_TTL_HOURS));

        EmailVerificationToken savedToken = emailVerificationTokenRepository.save(token);
        EmailVerificationEmailService.EmailVerificationDelivery delivery =
                emailVerificationEmailService.sendVerificationEmail(
                        savedToken.getUser().getEmail(),
                        rawToken,
                        savedToken.getExpiresAt()
                );

        return new EmailVerificationDispatch(
                delivery.deliveryMode(),
                exposeDebugTokens ? rawToken : null,
                exposeDebugTokens ? savedToken.getExpiresAt() : null
        );
    }

    private boolean canIssueVerification(User user) {
        return user.getStatus() == UserStatus.ACTIVE;
    }

    private RegisterResponse buildRegisterResponse(EmailVerificationDispatch dispatch) {
        return new RegisterResponse(
                REGISTER_MESSAGE,
                dispatch.deliveryMode(),
                dispatch.debugToken(),
                dispatch.expiresAt()
        );
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm is not available", ex);
        }
    }

    private record EmailVerificationDispatch(
            String deliveryMode,
            String debugToken,
            OffsetDateTime expiresAt
    ) {
    }
}
