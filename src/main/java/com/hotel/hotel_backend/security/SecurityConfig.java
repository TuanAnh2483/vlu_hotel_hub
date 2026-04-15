package com.hotel.hotel_backend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * SecurityConfig: nơi cấu hình Spring Security.
 *
 * Mục tiêu:
 * - Chỉ mở public đúng các route cần thiết
 * - /api/health : public
 * - còn lại: phải login (JWT)
 *
 * Và quan trọng:
 * - Chưa login / token sai => 401 JSON
 * - Login rồi nhưng không đủ quyền => 403 JSON
 */
@Configuration
@EnableMethodSecurity // để @PreAuthorize hoạt động
public class SecurityConfig {


    /**
     * PasswordEncoder: dùng để hash password lúc register và check lúc login.
     * BCrypt là chuẩn thông dụng.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /**
     * SecurityFilterChain: pipeline security chạy trước controller.
     * - disable csrf vì API stateless
     * - stateless session vì dùng JWT
     * - config route nào public/route nào cần login
     * - add JwtAuthFilter vào trước UsernamePasswordAuthenticationFilter
     * - custom handler trả JSON cho 401/403
     */
    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthFilter jwtAuthFilter,
            RestAuthEntryPoint restAuthEntryPoint,
            RestAccessDeniedHandler restAccessDeniedHandler
    ) throws Exception {

        return http
                // ❌ Không dùng CSRF vì API stateless
                .csrf(csrf -> csrf.disable())
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(formLogin -> formLogin.disable())
                // ❌ Không dùng session
                .sessionManagement(sm ->
                        sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                // ✅ CẤU HÌNH ROUTE PUBLIC / ROUTE CẦN LOGIN
                .authorizeHttpRequests(auth -> auth
                        // public API
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register-partner").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/hotels/search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/hotels/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/hotels/*/available-rooms").permitAll()
                        .requestMatchers("/error").permitAll()

                        // còn lại bắt buộc phải login
                        .anyRequest().authenticated()
                )

                // ✅ XỬ LÝ 401 / 403
                .exceptionHandling(ex -> ex
                        // 401: chưa login / token sai
                        .authenticationEntryPoint(restAuthEntryPoint)

                        // 403: đã login nhưng thiếu quyền
                        .accessDeniedHandler(restAccessDeniedHandler)
                )

                // ✅ Add JWT filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)

                .build();
    }
}
