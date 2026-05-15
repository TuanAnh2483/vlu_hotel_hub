package com.hotel.hotel_backend.service.price.ai;

import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.entity.AiPricingResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.roundK;

/**
 * Parses Gemini API responses and enforces price guardrails.
 *
 * Guardrail changes vs baseline:
 *
 * Absolute bounds (vs basePrice):
 *   was  50% – 250%
 *   now  65% – 175%   — more realistic for Vietnamese hotel operations
 *
 * Per-day anchor (vs rule-based suggestedPrice from PricingEngineService):
 *   If Gemini's price deviates more than ±30% from the already-clamped
 *   rule-based price, it is pulled back to the rule-based anchor.
 *   This ensures Gemini cannot bypass the soft clamp in PricingEngineService.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiResponseParser {

    private final ObjectMapper objectMapper;

    /** Absolute lower bound: 65% of basePrice (was 50%). */
    private static final double ABS_MIN_RATIO = 0.65;
    /** Absolute upper bound: 175% of basePrice (was 250%). */
    private static final double ABS_MAX_RATIO = 1.75;

    /**
     * Max allowed deviation of AI price from rule-based suggestedPrice.
     * If the rule-based engine already clamped the price, Gemini should
     * stay reasonably close to that anchor (±30%).
     */
    private static final double MAX_ANCHOR_DEVIATION = 0.30;

    public Map<String, AiPricingResult> parse(
            String response,
            List<PricingSuggestion> pricing,
            long basePrice
    ) {
        Map<String, AiPricingResult> result = new HashMap<>();

        long minAllowed = roundK(basePrice * ABS_MIN_RATIO);
        long maxAllowed = roundK(basePrice * ABS_MAX_RATIO);

        // Build date → rule-based suggestedPrice for per-day anchor check
        Map<String, Long> ruleBaseline = new HashMap<>();
        for (PricingSuggestion p : pricing) {
            if (p.suggestedPrice() != null) {
                ruleBaseline.put(p.date(), p.suggestedPrice());
            }
        }

        try {
            JsonNode root = objectMapper.readTree(response);
            String text = root.path("candidates").get(0)
                    .path("content").path("parts").get(0)
                    .path("text").asText();

            text = text.replace("```json", "").replace("```", "").trim();

            int start = text.indexOf('[');
            int end   = text.lastIndexOf(']');
            if (start < 0 || end <= start) {
                log.warn("[GeminiParser] No JSON array found in response");
                return result;
            }

            JsonNode array = objectMapper.readTree(text.substring(start, end + 1));

            for (JsonNode node : array) {
                String date  = node.path("date").asText(null);
                long   price = node.path("suggestedPrice").longValue();
                if (date == null || price <= 0) continue;

                price = roundK(price);

                // ── Absolute bounds ───────────────────────────────────────────
                if (price < minAllowed || price > maxAllowed) {
                    log.warn("[GeminiParser] date={} price={} outside absolute bounds [{},{}], clamping",
                            date, price, minAllowed, maxAllowed);
                    price = Math.max(minAllowed, Math.min(maxAllowed, price));
                }

                // ── Per-day anchor check ──────────────────────────────────────
                Long anchor = ruleBaseline.get(date);
                if (anchor != null && anchor > 0) {
                    double deviation = Math.abs((double)(price - anchor) / anchor);
                    if (deviation > MAX_ANCHOR_DEVIATION) {
                        long anchorMin = roundK(anchor * (1.0 - MAX_ANCHOR_DEVIATION));
                        long anchorMax = roundK(anchor * (1.0 + MAX_ANCHOR_DEVIATION));
                        long clamped   = Math.max(anchorMin, Math.min(anchorMax, price));
                        log.debug("[GeminiParser] date={} price={} deviates {}% from rule={}, pulling to {}",
                                date, price,
                                String.format("%.0f", deviation * 100),
                                anchor, clamped);
                        price = clamped;
                    }
                }

                // ── Price range ───────────────────────────────────────────────
                Long low  = node.path("priceLow").isNull()  ? null : node.path("priceLow").longValue();
                Long high = node.path("priceHigh").isNull() ? null : node.path("priceHigh").longValue();
                if (low  == null || low  <= 0) low  = roundK(price * 0.92);
                if (high == null || high <= 0) high = roundK(price * 1.08);
                low  = Math.max(Math.min(low,  price), minAllowed);
                high = Math.min(Math.max(high, price), maxAllowed);

                String reason = node.path("reason").asText(null);
                if (reason == null || reason.isBlank()) reason = "Giá tối ưu theo phân tích AI.";

                result.put(date, new AiPricingResult(price, low, high, reason, List.of(), true));
            }

        } catch (Exception e) {
            log.warn("[GeminiParser] Failed to parse response: {}", e.getMessage());
        }

        return result;
    }
}
