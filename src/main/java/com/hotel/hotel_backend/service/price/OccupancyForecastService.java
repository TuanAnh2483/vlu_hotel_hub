package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.dto.OccupancyForecast;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.service.search.HolidayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.computeConfidence;
import static com.hotel.hotel_backend.service.price.util.PricingUtils.getDemand;

/**
 * Forecasts daily occupancy for the pricing engine.
 *
 * Improvements over baseline:
 *
 * 1. Lower holiday occupancy floor — was 88%, now 75%.  The old value forced
 *    HIGH demand on every holiday regardless of actual bookings, which then
 *    stacked with the holiday price multiplier and produced extreme prices.
 *
 * 2. Capped learned boost — boost values learned from historical data are
 *    capped at 0.20 per day type to prevent runaway occupancy spikes.
 *
 * 3. Light EMA smoothing on non-holiday days — blends each day's occupancy
 *    with its neighbours (α=0.70) after the main pass to flatten isolated
 *    spikes without removing genuine demand signals.
 *
 * 4. Structured debug logging for every occupancy calculation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OccupancyForecastService {

    private final HolidayService holidayService;

    /** Max occupancy boost added from a learned model parameter (per day type). */
    private static final double MAX_LEARNED_BOOST = 0.20;

    /** Holiday occupancy floor (was 0.88 → now more conservative at 0.75). */
    private static final double HOLIDAY_OCC_FLOOR = 0.75;

    /** EMA alpha for smoothing: 0.70 = current day, 0.15 each neighbour. */
    private static final double EMA_ALPHA = 0.70;

    // ─────────────────────────────────────────────────────────────────────────

    public List<OccupancyForecast> forecast(
            Room room,
            List<Booking> allBookings,
            PricingModel pricingModel,
            LocalDate from,
            LocalDate to
    ) {
        List<Booking> active = allBookings.stream()
                .filter(b -> b.getStatus() != BookingStatus.CANCELLED)
                .toList();

        LocalDate     today        = LocalDate.now();
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        int           totalRooms   = room.getQuantity();

        long historicalCount = active.stream()
                .filter(b -> !b.getCheckIn().isAfter(today))
                .count();
        int historicalCountInt = (int) historicalCount;

        // ── Main pass: compute raw occupancy per day ──────────────────────────
        List<RawOccupancy> rawList = new ArrayList<>();

        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            final LocalDate d = date;

            int     dow       = d.getDayOfWeek().getValue();
            boolean isWeekend = dow >= 6;

            String  holidayTier = holidayService.getHolidayMap().get(d.toString());
            boolean isHoliday   = holidayTier != null;

            int activeBookings = (int) active.stream()
                    .filter(b -> !b.getCheckIn().isAfter(d) && b.getCheckOut().isAfter(d))
                    .count();

            int velocity = (int) allBookings.stream()
                    .filter(b -> b.getStatus() != BookingStatus.CANCELLED)
                    .filter(b -> !b.getCheckIn().isAfter(d) && b.getCheckOut().isAfter(d))
                    .filter(b -> b.getCreatedAt() != null && b.getCreatedAt().isAfter(sevenDaysAgo))
                    .count();

            int daysUntil = (int) ChronoUnit.DAYS.between(today, d);

            // Base occupancy from active bookings
            double baseOcc = totalRooms > 0 ? (double) activeBookings / totalRooms : 0.0;
            double occ     = baseOcc;

            // Blend with historical average for future dates (non-holiday)
            if (!isHoliday) {
                Double historicalOcc = isWeekend
                        ? pricingModel.getAvgWeekendOcc()
                        : pricingModel.getAvgWeekdayOcc();
                if (historicalOcc != null) {
                    double histWeight = Math.min(0.45, daysUntil / 30.0);
                    occ = (1 - histWeight) * baseOcc + histWeight * historicalOcc;
                }
            }

            // Apply learned boost — capped to prevent runaway occupancy spikes
            Double rawBoost = isHoliday
                    ? ("MAJOR".equals(holidayTier)
                            ? pricingModel.getMajorHolidayBoost()
                            : pricingModel.getMinorHolidayBoost())
                    : (isWeekend
                            ? pricingModel.getWeekendBoost()
                            : pricingModel.getWeekdayBoost());

            double cappedBoost = rawBoost != null
                    ? Math.min(rawBoost, MAX_LEARNED_BOOST)
                    : 0.0;
            occ = Math.min(occ + cappedBoost, 1.0);

            // Holiday occupancy floor — reduced from 0.88 to 0.75 to avoid
            // forcing extreme demand on every public holiday.
            if (isHoliday) {
                occ = Math.max(occ, HOLIDAY_OCC_FLOOR);
            }

            log.debug("[OccForecast] date={} type={} baseOcc={} boost={} occ={}",
                    d,
                    isHoliday ? "holiday(" + holidayTier + ")" : (isWeekend ? "weekend" : "weekday"),
                    String.format("%.2f", baseOcc),
                    String.format("%.2f", cappedBoost),
                    String.format("%.2f", occ));

            rawList.add(new RawOccupancy(d, occ, isWeekend, isHoliday, holidayTier,
                    activeBookings, velocity, daysUntil));
        }

        // ── EMA smoothing pass (non-holiday days only) ────────────────────────
        // Blends each day's occupancy with its immediate neighbours to flatten
        // isolated spikes without removing genuine multi-day demand signals.
        double[] smoothed = new double[rawList.size()];
        for (int i = 0; i < rawList.size(); i++) {
            RawOccupancy cur = rawList.get(i);
            // Keep holiday occupancy unsmoothed (real signal, not noise)
            if (cur.isHoliday) {
                smoothed[i] = cur.occ;
                continue;
            }
            double prev = i > 0 ? rawList.get(i - 1).occ : cur.occ;
            double next = i < rawList.size() - 1 ? rawList.get(i + 1).occ : cur.occ;
            smoothed[i] = EMA_ALPHA * cur.occ
                        + ((1.0 - EMA_ALPHA) / 2.0) * prev
                        + ((1.0 - EMA_ALPHA) / 2.0) * next;
            smoothed[i] = Math.min(1.0, Math.max(0.0, smoothed[i]));
        }

        // ── Build final OccupancyForecast list ────────────────────────────────
        List<OccupancyForecast> forecasts = new ArrayList<>();
        for (int i = 0; i < rawList.size(); i++) {
            RawOccupancy r   = rawList.get(i);
            double       occ = smoothed[i];
            String confidence = computeConfidence(historicalCountInt, r.daysUntil);

            forecasts.add(OccupancyForecast.builder()
                    .date(r.date.toString())
                    .occupancy(occ)
                    .demand(getDemand(occ))
                    .weekend(r.isWeekend)
                    .holiday(r.isHoliday)
                    .holidayTier(r.holidayTier)
                    .activeBookings(r.activeBookings)
                    .totalRooms(totalRooms)
                    .velocity(r.velocity)
                    .daysUntil(r.daysUntil)
                    .confidence(confidence)
                    .build());
        }
        return forecasts;
    }

    // ── Internal DTO for intermediate calculation ─────────────────────────────

    private record RawOccupancy(
            LocalDate date,
            double    occ,
            boolean   isWeekend,
            boolean   isHoliday,
            String    holidayTier,
            int       activeBookings,
            int       velocity,
            int       daysUntil
    ) {}
}
