package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.CancellationPolicy;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đặc tả các bậc hoàn tiền — phải khớp với hiển thị ở frontend (CancellationPolicyInfo.jsx).
 * checkIn được tính tại 14:00 (CHECK_IN_HOUR).
 */
class RefundPolicyCalculatorTest {

    private static final long TOTAL = 1_600_000L;
    private final LocalDate checkIn = LocalDate.of(2026, 6, 27);

    private LocalDateTime at(LocalDate date, int hour) {
        return date.atTime(hour, 0);
    }

    // ── FLEXIBLE ──────────────────────────────────────────────────────────

    @Test
    void flexible_moreThan24hBefore_full() {
        // 2 ngày trước, 14:00 → còn ≥24h → hoàn 100%
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.FLEXIBLE, checkIn, at(checkIn.minusDays(2), 14), TOTAL))
                .isEqualTo(1_600_000L);
    }

    @Test
    void flexible_within24h_none() {
        // 12h trước giờ nhận phòng → <24h → hoàn 0
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.FLEXIBLE, checkIn, at(checkIn, 2), TOTAL))
                .isEqualTo(0L);
    }

    // ── MODERATE ──────────────────────────────────────────────────────────

    @Test
    void moderate_moreThan7DaysBefore_full() {
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.MODERATE, checkIn, at(checkIn.minusDays(10), 14), TOTAL))
                .isEqualTo(1_600_000L);
    }

    @Test
    void moderate_within7Days_half() {
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.MODERATE, checkIn, at(checkIn.minusDays(3), 14), TOTAL))
                .isEqualTo(800_000L);
    }

    @Test
    void moderate_afterCheckIn_none() {
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.MODERATE, checkIn, at(checkIn.plusDays(1), 14), TOTAL))
                .isEqualTo(0L);
    }

    // ── STRICT ────────────────────────────────────────────────────────────

    @Test
    void strict_alwaysNone() {
        assertThat(RefundPolicyCalculator.computeRefundAmount(
                CancellationPolicy.STRICT, checkIn, at(checkIn.minusDays(30), 14), TOTAL))
                .isEqualTo(0L);
    }

    @Test
    void nullPolicy_defaultsToModerate() {
        assertThat(RefundPolicyCalculator.computeRefundPercent(
                null, checkIn, at(checkIn.minusDays(3), 14)))
                .isEqualTo(50);
    }
}
