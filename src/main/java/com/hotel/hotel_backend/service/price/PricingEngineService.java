package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.dto.OccupancyForecast;
import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.roundK;

/**
 * Core pricing engine: converts occupancy forecasts into suggested prices.
 *
 * Improvements over baseline:
 * 1. Seasonal factor from SeasonalPricingService (Tết, summer, golden week…)
 * 2. Soft clamp — weekday ±15%, weekend ±25%, holiday ±35% vs currentPrice
 * 3. Day-over-day smoothing — max ±20% jump between consecutive days
 * 4. Structured debug logging for every multiplier and clamp event
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PricingEngineService {

    private final ModelTrainingService   modelTrainingService;
    private final SeasonalPricingService seasonalPricingService;

    // ── Clamp limits (max % change vs currentPrice per day type) ─────────────
    private static final double CLAMP_WEEKDAY        = 0.15;
    private static final double CLAMP_WEEKEND        = 0.25;
    private static final double CLAMP_HOLIDAY_MINOR  = 0.25;
    private static final double CLAMP_HOLIDAY_MAJOR  = 0.35;

    // ── Day-over-day smoothing: max % change between consecutive days ─────────
    private static final double MAX_DAY_JUMP = 0.20;

    // ─────────────────────────────────────────────────────────────────────────

    public List<PricingSuggestion> generatePricing(
            Room room,
            List<OccupancyForecast> forecasts,
            PricingModel pricingModel,
            Map<LocalDate, Long> ratesByDate
    ) {
        List<PricingSuggestion> result = new ArrayList<>();

        long basePrice = room.getPrice();
        DateTimeFormatter ddMM = DateTimeFormatter.ofPattern("dd/MM");

        // Track previous day's price for day-over-day smoothing
        Long prevSuggestedPrice = null;

        for (OccupancyForecast fc : forecasts) {

            LocalDate date = LocalDate.parse(fc.date());

            long currentPrice = ratesByDate.getOrDefault(date, basePrice);

            // ── DEMAND FACTOR ─────────────────────────────────────────────────
            // occupancy [0,1] → factor grows with demand × partner aggressiveness
            double demandFactor = (0.93 + fc.occupancy() * 0.25)
                    * pricingModel.getPriceAggressiveness();

            // ── WEEKEND FACTOR ────────────────────────────────────────────────
            double weekendFactor = fc.weekend() ? 1.08 : 1.0;

            // ── HOLIDAY FACTOR ────────────────────────────────────────────────
            double holidayFactor = fc.holiday()
                    ? ("MAJOR".equals(fc.holidayTier()) ? 1.30 : 1.10)
                    : 1.0;

            // ── SEASONAL FACTOR ───────────────────────────────────────────────
            // Macro seasonal trend (Tết, summer peak, low season…).
            // When already a holiday, halve the seasonal influence to avoid
            // stacking the macro trend on top of the specific holiday factor.
            double rawSeasonalFactor = seasonalPricingService
                    .getSeasonalFactor(date, fc.holiday(), fc.weekend());
            double seasonalFactor = fc.holiday()
                    ? (1.0 + (rawSeasonalFactor - 1.0) * 0.5)
                    : rawSeasonalFactor;

            log.debug("[Pricing] date={} occ={} demand={} agg={} demandF={} weekendF={} holidayF={} seasonalF={}",
                    date,
                    String.format("%.2f", fc.occupancy()),
                    fc.demand(),
                    String.format("%.3f", pricingModel.getPriceAggressiveness()),
                    String.format("%.3f", demandFactor),
                    String.format("%.2f", weekendFactor),
                    String.format("%.2f", holidayFactor),
                    String.format("%.3f", seasonalFactor));

            // ── RULE-BASED PRICE ──────────────────────────────────────────────
            Long suggestedPrice = currentPrice > 0
                    ? roundK(currentPrice
                            * demandFactor
                            * weekendFactor
                            * holidayFactor
                            * pricingModel.getPartnerPriceAdjustment()
                            * seasonalFactor)
                    : null;

            // ── LOGISTIC REGRESSION OPTIMIZATION ─────────────────────────────
            // Override rule-based price when the LR model has been trained.
            // Seasonal factor is re-applied to the LR output to keep seasonal
            // awareness consistent across both paths.
            // daysUntil + rawSeasonalFactor được truyền để model LR dùng đúng context ngày.
            if (pricingModel.isLrReady() && currentPrice > 0) {
                Long lrPrice = modelTrainingService.optimizePrice(
                        pricingModel, basePrice, fc.date(), fc.weekend(), fc.holiday(),
                        fc.daysUntil(), rawSeasonalFactor);
                if (lrPrice != null) {
                    suggestedPrice = roundK(lrPrice * seasonalFactor);
                    log.debug("[Pricing] date={} LR override lrBase={} seasonalAdj={} final={}",
                            date, lrPrice, String.format("%.3f", seasonalFactor), suggestedPrice);
                }
            }

            // ── SOFT CLAMP ────────────────────────────────────────────────────
            // Prevent the AI / LR from suggesting prices that deviate too far
            // from the current market rate for this specific day type.
            if (suggestedPrice != null && currentPrice > 0) {
                double maxChangePct = resolveClampPct(fc);
                long clampMax = roundK(currentPrice * (1.0 + maxChangePct));
                long clampMin = roundK(currentPrice * (1.0 - maxChangePct));

                if (suggestedPrice > clampMax) {
                    log.debug("[Clamp] date={} price={} clamped DOWN to={} currentPrice={} limit=+{}%",
                            date, suggestedPrice, clampMax, currentPrice,
                            (int) (maxChangePct * 100));
                    suggestedPrice = clampMax;
                } else if (suggestedPrice < clampMin) {
                    log.debug("[Clamp] date={} price={} clamped UP to={} currentPrice={} limit=-{}%",
                            date, suggestedPrice, clampMin, currentPrice,
                            (int) (maxChangePct * 100));
                    suggestedPrice = clampMin;
                }
            }

            // ── DAY-OVER-DAY SMOOTHING ────────────────────────────────────────
            // Limit the price jump between two consecutive calendar days to avoid
            // jarring spikes in the partner's calendar view.
            if (suggestedPrice != null && prevSuggestedPrice != null) {
                long dayMax = roundK(prevSuggestedPrice * (1.0 + MAX_DAY_JUMP));
                long dayMin = roundK(prevSuggestedPrice * (1.0 - MAX_DAY_JUMP));

                if (suggestedPrice > dayMax) {
                    log.debug("[Smooth] date={} price={} smoothed DOWN to={} (max +{}%/day)",
                            date, suggestedPrice, dayMax, (int) (MAX_DAY_JUMP * 100));
                    suggestedPrice = dayMax;
                } else if (suggestedPrice < dayMin) {
                    log.debug("[Smooth] date={} price={} smoothed UP to={} (max -{}%/day)",
                            date, suggestedPrice, dayMin, (int) (MAX_DAY_JUMP * 100));
                    suggestedPrice = dayMin;
                }
            }

            prevSuggestedPrice = suggestedPrice;

            // ── PRICE RANGE ±8% ───────────────────────────────────────────────
            Long priceLow  = suggestedPrice != null ? roundK(suggestedPrice * 0.92) : null;
            Long priceHigh = suggestedPrice != null ? roundK(suggestedPrice * 1.08) : null;

            // ── DELTA % vs current ────────────────────────────────────────────
            double deltaPct = currentPrice > 0 && suggestedPrice != null
                    ? ((double) (suggestedPrice - currentPrice) / currentPrice) * 100
                    : 0.0;

            log.debug("[Pricing] date={} currentPrice={} finalSuggested={} delta={}%",
                    date, currentPrice, suggestedPrice, String.format("%.1f", deltaPct));

            result.add(PricingSuggestion.builder()
                    .date(fc.date())
                    .dayName(getDayName(date))
                    .displayDate(date.format(ddMM))
                    .occupancy(fc.occupancy())
                    .demand(fc.demand())
                    .isWeekend(fc.weekend())
                    .isHoliday(fc.holiday())
                    .holidayTier(fc.holidayTier())
                    .currentPrice(currentPrice)
                    .suggestedPrice(suggestedPrice)
                    .priceLow(priceLow)
                    .priceHigh(priceHigh)
                    .deltaPct(deltaPct)
                    .confidence(fc.confidence())
                    .activeBookings(fc.activeBookings())
                    .totalRooms(fc.totalRooms())
                    .velocity(fc.velocity())
                    .daysUntil(fc.daysUntil())
                    .build());
        }

        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Resolve the max allowed price change % based on the day type. */
    private double resolveClampPct(OccupancyForecast fc) {
        if (fc.holiday()) {
            return "MAJOR".equals(fc.holidayTier())
                    ? CLAMP_HOLIDAY_MAJOR
                    : CLAMP_HOLIDAY_MINOR;
        }
        return fc.weekend() ? CLAMP_WEEKEND : CLAMP_WEEKDAY;
    }

    private String getDayName(LocalDate d) {
        return switch (d.getDayOfWeek()) {
            case MONDAY    -> "Th 2";
            case TUESDAY   -> "Th 3";
            case WEDNESDAY -> "Th 4";
            case THURSDAY  -> "Th 5";
            case FRIDAY    -> "Th 6";
            case SATURDAY  -> "T7";
            case SUNDAY    -> "CN";
        };
    }
}
