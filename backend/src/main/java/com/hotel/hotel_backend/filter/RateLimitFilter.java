package com.hotel.hotel_backend.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotel.hotel_backend.dto.response.ApiError;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory token-bucket rate limiter for authentication endpoints.
 * Limits each IP to 5 requests/minute on login and register to prevent brute-force attacks.
 * For production with multiple nodes, replace the ConcurrentHashMap with a distributed cache (Redis).
 * Disabled by setting app.rate-limit.enabled=false (used in test profile).
 */
@Component
@Order(1)
@ConditionalOnProperty(name = "app.rate-limit.enabled", havingValue = "true", matchIfMissing = true)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 5;
    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/auth/login",    "/api/v1/auth/login",
            "/api/auth/register", "/api/v1/auth/register"
    );

    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!RATE_LIMITED_PATHS.contains(path)) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        String bucketKey = clientIp + ":" + path;
        Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> buildBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            writeTooManyRequestsResponse(response);
        }
    }

    private Bucket buildBucket() {
        Refill refill = Refill.greedy(MAX_REQUESTS_PER_MINUTE, Duration.ofMinutes(1));
        Bandwidth limit = Bandwidth.classic(MAX_REQUESTS_PER_MINUTE, refill);
        return Bucket.builder().addLimit(limit).build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private void writeTooManyRequestsResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", "60");

        ApiError error = new ApiError(
                "TOO_MANY_REQUESTS",
                "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.",
                List.of()
        );
        ApiResponse<Void> body = ApiResponse.fail(error);
        objectMapper.writeValue(response.getWriter(), body);
    }
}
