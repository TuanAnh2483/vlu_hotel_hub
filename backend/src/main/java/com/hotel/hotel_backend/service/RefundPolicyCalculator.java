package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.CancellationPolicy;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Tính số tiền hoàn theo chính sách hủy + thời điểm hủy, theo chuẩn các trang đặt phòng lớn.
 *
 * <p>Logic này phải KHỚP với phần hiển thị ở frontend (CancellationPolicyInfo.jsx) để số tiền
 * khách thấy trùng với số tiền admin/partner duyệt — tránh lệch giữa preview và thực tế.
 *
 * <ul>
 *   <li>FLEXIBLE : hủy ≥ 24h trước nhận phòng → 100%, muộn hơn → 0%</li>
 *   <li>MODERATE : hủy ≥ 7 ngày → 100%, trong vòng 7 ngày → 50%, sau giờ nhận phòng → 0%</li>
 *   <li>STRICT   : luôn 0%</li>
 * </ul>
 */
public final class RefundPolicyCalculator {

    // Giờ nhận phòng mặc định dùng để tính mốc thời gian (khớp CHECK_IN_HOUR ở frontend).
    private static final int CHECK_IN_HOUR = 14;

    private RefundPolicyCalculator() {
    }

    /** Số tiền được hoàn (làm tròn) theo chính sách và thời điểm hủy. */
    public static long computeRefundAmount(CancellationPolicy policy, LocalDate checkIn,
                                           LocalDateTime now, long totalPrice) {
        int pct = computeRefundPercent(policy, checkIn, now);
        return Math.round(totalPrice * pct / 100.0);
    }

    /** Phần trăm được hoàn: 100, 50 hoặc 0. */
    public static int computeRefundPercent(CancellationPolicy policy, LocalDate checkIn, LocalDateTime now) {
        CancellationPolicy p = policy != null ? policy : CancellationPolicy.MODERATE;
        if (p == CancellationPolicy.STRICT) {
            return 0;
        }
        if (checkIn == null) {
            // Thiếu dữ liệu ngày nhận phòng — fallback an toàn về hoàn đủ.
            return 100;
        }

        LocalDateTime checkInInstant = checkIn.atTime(CHECK_IN_HOUR, 0);
        return switch (p) {
            case FLEXIBLE -> !now.isAfter(checkInInstant.minusHours(24)) ? 100 : 0;
            case MODERATE -> {
                if (!now.isAfter(checkInInstant.minusDays(7))) {
                    yield 100;
                }
                yield now.isBefore(checkInInstant) ? 50 : 0;
            }
            default -> 0;
        };
    }
}
