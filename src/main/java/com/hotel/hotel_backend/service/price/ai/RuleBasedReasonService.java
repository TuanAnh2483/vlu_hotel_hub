package com.hotel.hotel_backend.service.price.ai;

import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.entity.AiPricingResult;
import com.hotel.hotel_backend.service.price.SeasonalPricingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.roundK;

@Service
@RequiredArgsConstructor
@Slf4j
public class RuleBasedReasonService {

    private final SeasonalPricingService seasonalPricingService;

    /**
     * Merge AI results with rule-based fallback.
     * Days that Gemini already covered keep the AI result; missing days get a
     * context-aware rule-based reason.
     */
    public Map<String, AiPricingResult> mergeFallback(
            List<PricingSuggestion> pricing,
            Map<String, AiPricingResult> parsed
    ) {
        Map<String, AiPricingResult> result = new HashMap<>();
        for (PricingSuggestion p : pricing) {
            AiPricingResult ai = parsed.get(p.date());
            result.put(p.date(), ai != null ? ai : buildRule(p));
        }
        return result;
    }

    /**
     * Full rule-based table — used when Gemini is unavailable entirely.
     */
    public Map<String, AiPricingResult> buildFallback(List<PricingSuggestion> pricing) {
        Map<String, AiPricingResult> result = new HashMap<>();
        for (PricingSuggestion p : pricing) {
            result.put(p.date(), buildRule(p));
        }
        return result;
    }

    // ── Core builder ──────────────────────────────────────────────────────────

    private AiPricingResult buildRule(PricingSuggestion p) {
        String reason = buildReason(p);

        if (p.suggestedPrice() == null) {
            log.debug("[Fallback] date={} suggestedPrice=null, returning null result", p.date());
            return new AiPricingResult(null, null, null, reason, List.of(), false);
        }

        return new AiPricingResult(
                p.suggestedPrice(),
                roundK(p.suggestedPrice() * 0.92),
                roundK(p.suggestedPrice() * 1.08),
                reason,
                List.of(),
                false
        );
    }

    /**
     * Xây dựng lý do ngắn gọn bằng tiếng Việt, kết hợp nhiều tín hiệu.
     *
     * Ưu tiên:
     *  1. Ngày lễ (lớn > nhỏ) — tín hiệu quan trọng nhất
     *  2. Mùa vụ (Tết, hè, thấp điểm…)
     *  3. Cuối tuần
     *  4. Tốc độ đặt phòng (velocity)
     *  5. Đặt sát ngày + nhu cầu thấp
     *  6. Mức nhu cầu tổng quát (HIGH / MEDIUM / LOW)
     *
     * Mỗi lý do bao gồm con số thực tế (% công suất, velocity) để dễ
     * giải thích với ban giám khảo và người dùng.
     */
    private String buildReason(PricingSuggestion p) {
        int occ = (int) Math.round(p.occupancy() * 100); // % công suất dự báo

        // 1. Ngày lễ — ưu tiên cao nhất
        if (p.isHoliday()) {
            if ("MAJOR".equals(p.holidayTier())) {
                return p.velocity() >= 3
                        ? String.format("Ngày lễ lớn và đặt phòng tăng nhanh (%d booking/7 ngày) — công suất dự báo %d%%.", p.velocity(), occ)
                        : String.format("Ngày lễ lớn, nhu cầu cao — công suất dự báo %d%%.", occ);
            }
            return "HIGH".equals(p.demand())
                    ? String.format("Ngày lễ với công suất cao %d%% — tăng giá phù hợp.", occ)
                    : "Ngày lễ nhỏ, nhu cầu tăng nhẹ so với ngày thường.";
        }

        // 2. Mùa vụ
        String season = seasonalPricingService.getSeasonLabel(LocalDate.parse(p.date()));

        // 3. Cuối tuần kết hợp mùa vụ
        if (p.isWeekend()) {
            if (season != null && "HIGH".equals(p.demand()))
                return String.format("Cuối tuần %s — lấp đầy %d%%, tăng giá.", season.toLowerCase(), occ);
            if (season != null)
                return String.format("Cuối tuần trong %s — công suất %d%%.", season.toLowerCase(), occ);
            if ("HIGH".equals(p.demand()))
                return String.format("Cuối tuần với công suất dự báo cao %d%%.", occ);
            if ("LOW".equals(p.demand()))
                return String.format("Cuối tuần nhưng lấp đầy thấp %d%% — giảm nhẹ để kích cầu.", occ);
            return String.format("Cuối tuần, nhu cầu ổn định — công suất %d%%.", occ);
        }

        // 4. Ngày thường trong mùa cao/thấp điểm
        if (season != null) {
            if ("HIGH".equals(p.demand()))
                return String.format("%s — công suất cao %d%%, tăng giá.", season, occ);
            if ("LOW".equals(p.demand()))
                return String.format("%s — công suất chỉ %d%%, ưu tiên lấp đầy.", season, occ);
            return String.format("%s — công suất %d%%, giữ giá ổn định.", season, occ);
        }

        // 5. Tốc độ đặt phòng cao — tín hiệu nhu cầu tăng đột biến
        if (p.velocity() >= 3)
            return String.format("Đặt phòng tăng nhanh (%d booking/7 ngày) — nhu cầu tốt, tăng giá.", p.velocity());

        // 6. Gần ngày + nhu cầu thấp — ưu tiên lấp đầy hơn tối đa doanh thu
        if (p.daysUntil() <= 2 && "LOW".equals(p.demand()))
            return String.format("Còn %d ngày nữa, lấp đầy chỉ %d%% — giảm nhẹ để kích cầu.", p.daysUntil(), occ);

        // 7. Mức nhu cầu tổng quát
        return switch (p.demand()) {
            case "HIGH" -> String.format("Nhu cầu cao, công suất dự báo %d%% — tăng giá.", occ);
            case "LOW"  -> String.format("Nhu cầu thấp, công suất chỉ %d%% — giảm nhẹ để thu hút khách.", occ);
            default     -> String.format("Nhu cầu ổn định, công suất %d%% — giữ giá hiện tại.", occ);
        };
    }
}
