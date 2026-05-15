package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.dto.response.PriceSuggestionItem;
import com.hotel.hotel_backend.entity.AiPricingResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.roundK;

/**
 * Merges rule-based pricing suggestions with AI (Gemini) results.
 *
 * AI deviation guard:
 * If the AI-suggested price deviates more than ±30% from the
 * rule-based price (which is already soft-clamped in PricingEngineService),
 * the AI result is discarded and the rule-based price is used instead.
 * This is a last-resort backstop — GeminiResponseParser handles the primary
 * per-day anchor check; this guard catches anything that slips through.
 */
@Component
@Slf4j
public class PriceSuggestionMapper {

    private static final double MAX_AI_DEVIATION = 0.30;

    public List<PriceSuggestionItem> toItems(
            List<PricingSuggestion> pricing,
            Map<String, AiPricingResult> aiResults
    ) {
        return pricing.stream()
                .map(p -> buildItem(p, aiResults.get(p.date())))
                .toList();
    }

    private PriceSuggestionItem buildItem(PricingSuggestion p, AiPricingResult ai) {

        Long   finalPrice   = p.suggestedPrice();
        Long   finalLow     = p.priceLow();
        Long   finalHigh    = p.priceHigh();
        String reason       = "Giá đề xuất theo phân tích nhu cầu tự động.";
        List<String> factors = List.of();
        boolean aiGenerated = false;

        // Use AI result when available
        if (ai != null && ai.suggestedPrice() != null) {
            long aiPrice = ai.suggestedPrice();

            // AI deviation guard: discard if too far from rule-based anchor
            if (p.suggestedPrice() != null && p.suggestedPrice() > 0) {
                double deviation = Math.abs((double)(aiPrice - p.suggestedPrice()) / p.suggestedPrice());
                if (deviation > MAX_AI_DEVIATION) {
                    log.debug("[Mapper] date={} AI price={} deviates {}% from rule={}, discarding AI",
                            p.date(), aiPrice,
                            String.format("%.0f", deviation * 100),
                            p.suggestedPrice());
                    // Fall through with rule-based values (already set above)
                } else {
                    finalPrice   = aiPrice;
                    finalLow     = ai.priceLow()  != null ? ai.priceLow()  : roundK(aiPrice * 0.92);
                    finalHigh    = ai.priceHigh() != null ? ai.priceHigh() : roundK(aiPrice * 1.08);
                    reason       = ai.reason()    != null ? ai.reason()    : reason;
                    factors      = ai.factors();
                    aiGenerated  = ai.aiGenerated();
                }
            } else {
                // No rule-based anchor available — accept AI directly
                finalPrice   = aiPrice;
                finalLow     = ai.priceLow()  != null ? ai.priceLow()  : (finalPrice != null ? roundK(finalPrice * 0.92) : null);
                finalHigh    = ai.priceHigh() != null ? ai.priceHigh() : (finalPrice != null ? roundK(finalPrice * 1.08) : null);
                reason       = ai.reason()    != null ? ai.reason()    : reason;
                factors      = ai.factors();
                aiGenerated  = ai.aiGenerated();
            }
        }

        double finalDeltaPct = p.currentPrice() > 0 && finalPrice != null
                ? ((double)(finalPrice - p.currentPrice()) / p.currentPrice()) * 100
                : 0.0;

        return new PriceSuggestionItem(
                p.date(),
                p.dayName(),
                p.displayDate(),
                p.occupancy(),
                p.demand(),
                p.isWeekend(),
                p.isHoliday(),
                p.holidayTier(),
                p.currentPrice(),
                finalPrice,
                finalLow,
                finalHigh,
                finalDeltaPct,
                p.confidence(),
                reason,
                factors,
                p.activeBookings(),
                p.totalRooms(),
                aiGenerated,
                p.velocity(),
                p.daysUntil()
        );
    }
}
