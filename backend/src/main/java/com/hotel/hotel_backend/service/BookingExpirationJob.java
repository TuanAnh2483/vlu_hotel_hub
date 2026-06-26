package com.hotel.hotel_backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Booking expiry — 2-layer mechanism (không dùng Redis TTL).
 *
 * <p><b>Layer 1 — Active scan (job này):</b><br>
 * Chạy mỗi 60 giây (cấu hình: {@code app.booking.expiration.fixed-delay-ms}).
 * Quét toàn bộ booking {@code PENDING_PAYMENT} có {@code expires_at < now()},
 * chuyển trạng thái sang {@code CANCELLED} và nhả lại inventory cho tất cả.
 * Đảm bảo phòng được giải phóng ngay cả khi không có user nào truy cập.
 *
 * <p><b>Layer 2 — Passive expiry (read path):</b><br>
 * Bất cứ khi nào một booking được đọc (getMyBooking, getMyBookings, createPaymentSession, ...),
 * {@link BookingExpirationService#expirePendingBookingIfNeeded} được gọi để
 * kiểm tra và expire ngay nếu quá hạn — không cần đợi đến lần job tiếp theo.
 * Giúp user thấy trạng thái chính xác tức thì khi reload trang.
 *
 * <p><b>Tại sao không dùng Redis TTL / message queue?</b><br>
 * Cách tiếp cận này đơn giản, không phụ thuộc thêm infrastructure,
 * và an toàn khi server restart (job chạy lại ngay sau khi khởi động).
 * Redis TTL sẽ phù hợp hơn nếu cần phản ứng sub-second hoặc có nhiều instance backend.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingExpirationJob {

    private final BookingExpirationService bookingExpirationService;

    @Scheduled(fixedDelayString = "${app.booking.expiration.fixed-delay-ms:60000}")
    public void expirePendingBookings() {
        // Orchestration + cach ly per-booking nam trong service; moi booking loi chi bi bo qua.
        int expiredCount = bookingExpirationService.expireOverduePendingBookings();
        if (expiredCount > 0) {
            log.info("Expired {} pending payment bookings", expiredCount);
        }
    }
}
