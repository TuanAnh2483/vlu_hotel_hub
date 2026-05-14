package com.hotel.hotel_backend.service.price;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;

/**
 * Seasonal pricing adjustment for Vietnamese hotel market.
 *
 * Returns a smooth multiplier between 0.90 and 1.20 based on:
 * - Month-based peak / off-peak seasons
 * - Tết / Lunar New Year window (Jan 15 – Feb 20)
 * - 30/4–1/5 golden week (Apr 27 – May 5)
 * - Summer travel peak (Jun 15 – Aug 31)
 * - School holiday shoulders (Jun 1–14, Aug 16–Sep 10)
 * - Low season (Oct–Nov)
 * - Long-weekend bridge days (Friday / Monday near holiday clusters)
 *
 * Design principles:
 * - Factor is intentionally conservative (capped at ±20%)
 * - When a day is already marked as a public holiday, seasonal influence
 *   is halved in PricingEngineService to avoid double-counting.
 * - Seasonal factor acts as a macro trend on top of daily demand signals.
 */
@Service
@Slf4j
public class SeasonalPricingService {

    private static final double MIN_SEASONAL = 0.90;
    private static final double MAX_SEASONAL = 1.20;

    // Long-weekend bridge boost (applied only to non-holiday Fri/Mon)
    private static final double BRIDGE_BOOST = 1.06;

    /**
     * Returns seasonal demand multiplier for a given date.
     *
     * @param date      the pricing date
     * @param isHoliday whether this day is already a public holiday
     * @param isWeekend whether this day is a weekend
     */
    public double getSeasonalFactor(LocalDate date, boolean isHoliday, boolean isWeekend) {
        double factor = getBaseSeasonalFactor(date);

        // Long-weekend bridge boost only for non-holiday weekday Fri/Mon
        if (!isHoliday && !isWeekend && isLongWeekendBridge(date)) {
            factor *= BRIDGE_BOOST;
            log.debug("[Seasonal] Bridge day boost applied date={} factor={}", date,
                    String.format("%.3f", factor));
        }

        double clamped = Math.max(MIN_SEASONAL, Math.min(MAX_SEASONAL, factor));
        if (log.isDebugEnabled()) {
            log.debug("[Seasonal] date={} season='{}' factor={} clamped={}",
                    date, getSeasonLabel(date),
                    String.format("%.3f", factor), String.format("%.3f", clamped));
        }
        return clamped;
    }

    /**
     * Human-readable label for the current season (may return null for normal season).
     */
    public String getSeasonLabel(LocalDate date) {
        if (isTetSeason(date))      return "Mùa Tết";
        if (isGoldenWeek(date))     return "Tuần lễ vàng 30/4-1/5";
        if (isSummerPeak(date))     return "Hè cao điểm";
        if (isSchoolHoliday(date))  return "Đầu/cuối mùa hè";
        if (isLowSeason(date))      return "Mùa thấp điểm";
        return null;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private double getBaseSeasonalFactor(LocalDate d) {
        if (isTetSeason(d))      return 1.18;  // Tết: very high demand
        if (isGoldenWeek(d))     return 1.15;  // 30/4–1/5 golden week
        if (isSummerPeak(d))     return 1.12;  // Summer peak Jun–Aug
        if (isSchoolHoliday(d))  return 1.05;  // Shoulder: school holiday
        if (isLowSeason(d))      return 0.92;  // Oct–Nov: low season
        return 1.0;
    }

    /** Tết season: Jan 15 – Feb 20 (covers Tết demand buildup across years). */
    private boolean isTetSeason(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        return !md.isBefore(MonthDay.of(1, 15)) && !md.isAfter(MonthDay.of(2, 20));
    }

    /** Golden week around 30/4–1/5: Apr 27 – May 5. */
    private boolean isGoldenWeek(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        return !md.isBefore(MonthDay.of(4, 27)) && !md.isAfter(MonthDay.of(5, 5));
    }

    /** Summer travel peak: Jun 15 – Aug 31. */
    private boolean isSummerPeak(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        return !md.isBefore(MonthDay.of(6, 15)) && !md.isAfter(MonthDay.of(8, 31));
    }

    /**
     * School holiday shoulder periods:
     * - Early summer: Jun 1–14 (ramp-up before full peak)
     * - Back-to-school: Aug 16–Sep 10
     */
    private boolean isSchoolHoliday(LocalDate d) {
        MonthDay md = MonthDay.from(d);
        boolean earlyJune    = !md.isBefore(MonthDay.of(6, 1))  && !md.isAfter(MonthDay.of(6, 14));
        boolean backToSchool = !md.isBefore(MonthDay.of(8, 16)) && !md.isAfter(MonthDay.of(9, 10));
        return earlyJune || backToSchool;
    }

    /** Low season: October and November. */
    private boolean isLowSeason(LocalDate d) {
        int m = d.getMonthValue();
        return m == 10 || m == 11;
    }

    /**
     * Long-weekend bridge: a Friday or Monday that sits next to a holiday cluster.
     * Conservative heuristic — only applies when isHoliday=false (checked by caller).
     */
    private boolean isLongWeekendBridge(LocalDate d) {
        DayOfWeek dow = d.getDayOfWeek();
        return dow == DayOfWeek.FRIDAY || dow == DayOfWeek.MONDAY;
    }
}
