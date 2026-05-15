package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.service.search.HolidayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * Seasonal pricing adjustment for Vietnamese hotel market.
 *
 * Returns a smooth multiplier between 0.90 and 1.20 based on:
 * - Month-based peak / off-peak seasons
 * - Tết / Lunar New Year window (per-year accurate dates ± 10 days)
 * - 30/4–1/5 golden week (Apr 27 – May 5)
 * - Summer travel peak (Jun 15 – Aug 31)
 * - School holiday shoulders (Jun 1–14, Aug 16–Sep 10)
 * - Low season (Oct–Nov)
 * - Long-weekend bridge days (Friday/Monday only when next to a real holiday)
 *
 * Improvements vs baseline:
 * 1. Tết dates are year-specific (not the fixed Jan 15–Feb 20 range).
 * 2. Bridge-day boost only fires when there is an actual holiday within 3 days.
 * 3. HolidayService (DB-backed) is used so the bridge check reflects admin-managed
 *    holidays rather than hard-coded assumptions.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeasonalPricingService {

    private final HolidayService holidayService;

    private static final double MIN_SEASONAL = 0.90;
    private static final double MAX_SEASONAL = 1.20;

    // Long-weekend bridge boost (Fri/Mon adjacent to a real holiday)
    private static final double BRIDGE_BOOST = 1.06;

    // ── Tết: ngày mùng 1 Tết Âm lịch theo từng năm Dương lịch ──────────────
    // Cập nhật bảng này mỗi năm hoặc tích hợp thư viện Âm lịch khi cần.
    private static final Map<Integer, MonthDay> TET_DATES = Map.of(
        2024, MonthDay.of(2, 10),
        2025, MonthDay.of(1, 29),
        2026, MonthDay.of(2, 17),
        2027, MonthDay.of(2,  6),
        2028, MonthDay.of(1, 26),
        2029, MonthDay.of(2, 13)
    );

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns seasonal demand multiplier for a given date.
     *
     * @param date      the pricing date
     * @param isHoliday whether this day is already a public holiday
     * @param isWeekend whether this day is a weekend
     */
    public double getSeasonalFactor(LocalDate date, boolean isHoliday, boolean isWeekend) {
        double factor = getBaseSeasonalFactor(date);

        // Bridge-day boost: chỉ áp dụng cho Fri/Mon có ngày lễ thực sự trong vòng 3 ngày
        if (!isHoliday && !isWeekend && isLongWeekendBridge(date)) {
            factor *= BRIDGE_BOOST;
            log.debug("[Seasonal] Bridge day boost date={} factor={}", date,
                    String.format("%.3f", factor));
        }

        double clamped = Math.max(MIN_SEASONAL, Math.min(MAX_SEASONAL, factor));
        log.debug("[Seasonal] date={} season='{}' raw={} clamped={}",
                date, getSeasonLabel(date),
                String.format("%.3f", factor), String.format("%.3f", clamped));
        return clamped;
    }

    /**
     * Human-readable label for the current season (null = bình thường).
     */
    public String getSeasonLabel(LocalDate date) {
        if (isTetSeason(date))     return "Mùa Tết";
        if (isGoldenWeek(date))    return "Tuần lễ vàng 30/4-1/5";
        if (isSummerPeak(date))    return "Hè cao điểm";
        if (isSchoolHoliday(date)) return "Đầu/cuối mùa hè";
        if (isLowSeason(date))     return "Mùa thấp điểm";
        return null;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private double getBaseSeasonalFactor(LocalDate d) {
        if (isTetSeason(d))     return 1.18;  // Tết: nhu cầu rất cao
        if (isGoldenWeek(d))    return 1.15;  // 30/4–1/5
        if (isSummerPeak(d))    return 1.12;  // Hè cao điểm Jun–Aug
        if (isSchoolHoliday(d)) return 1.05;  // Đầu/cuối hè
        if (isLowSeason(d))     return 0.92;  // Tháng 10–11 thấp điểm
        return 1.0;
    }

    /**
     * Tết season: ±10 ngày quanh mùng 1 Tết theo bảng TET_DATES.
     * Nếu năm chưa có trong bảng → dùng vùng xấp xỉ Jan 20 – Feb 25.
     */
    private boolean isTetSeason(LocalDate d) {
        MonthDay tet = TET_DATES.get(d.getYear());
        if (tet == null) {
            // Fallback bảo toàn: vùng Tết gần đúng cho mọi năm
            MonthDay md = MonthDay.from(d);
            return !md.isBefore(MonthDay.of(1, 20)) && !md.isAfter(MonthDay.of(2, 25));
        }
        LocalDate tetDate = tet.atYear(d.getYear());
        long delta = ChronoUnit.DAYS.between(tetDate, d);
        // 10 ngày trước (chuẩn bị) đến 7 ngày sau (nghỉ lễ)
        return delta >= -10 && delta <= 7;
    }

    /** Golden week 30/4–1/5: Apr 27 – May 5. */
    private boolean isGoldenWeek(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        return !md.isBefore(MonthDay.of(4, 27)) && !md.isAfter(MonthDay.of(5, 5));
    }

    /** Hè cao điểm: Jun 15 – Aug 31. */
    private boolean isSummerPeak(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        return !md.isBefore(MonthDay.of(6, 15)) && !md.isAfter(MonthDay.of(8, 31));
    }

    /**
     * Vai trò trung gian của mùa hè:
     * - Đầu hè: Jun 1–14
     * - Cuối hè / đầu năm học: Aug 16–Sep 10
     */
    private boolean isSchoolHoliday(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        boolean earlyJune    = !md.isBefore(MonthDay.of(6, 1))  && !md.isAfter(MonthDay.of(6, 14));
        boolean backToSchool = !md.isBefore(MonthDay.of(8, 16)) && !md.isAfter(MonthDay.of(9, 10));
        return earlyJune || backToSchool;
    }

    /** Thấp điểm: tháng 10 và 11. */
    private boolean isLowSeason(LocalDate d) {
        int m = d.getMonthValue();
        return m == 10 || m == 11;
    }

    /**
     * Bridge day: Thứ 6 hoặc Thứ 2 nằm sát ngày lễ thực sự (trong DB) trong vòng 3 ngày.
     *
     * Khắc phục lỗi cũ: trước đây mọi Thứ 6/Thứ 2 đều được boost +6%,
     * kể cả tuần hoàn toàn bình thường.
     */
    private boolean isLongWeekendBridge(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        if (dow != DayOfWeek.FRIDAY && dow != DayOfWeek.MONDAY) return false;

        // Kiểm tra có ngày lễ nào trong vòng ±3 ngày không (tránh đếm chính ngày date)
        Map<String, String> holidays = holidayService.getHolidayMap();
        for (int delta = 1; delta <= 3; delta++) {
            if (holidays.containsKey(date.plusDays(delta).toString())
                    || holidays.containsKey(date.minusDays(delta).toString())) {
                return true;
            }
        }
        return false;
    }
}
