package com.hotel.hotel_backend.service.price.ai;

import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.entity.AiPricingResult;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.PriceFeedback;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.repository.PriceFeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;

@Service
@RequiredArgsConstructor
public class AiReasonService {

    private final GeminiClient           geminiClient;
    private final GeminiPromptBuilder    promptBuilder;
    private final GeminiResponseParser   responseParser;
    private final RuleBasedReasonService fallbackService;
    private final PriceFeedbackRepository feedbackRepository;

    // Cache key: roomId + first date + count (stable across calls for the same room+range)
    @Cacheable(
        value     = "geminiPricing",
        key       = "#room.id + '_' + #pricing.get(0).date() + '_' + #pricing.size()",
        condition = "!#pricing.isEmpty()",
        unless    = "#result.isEmpty()"
    )
    @Transactional(readOnly = true)
    public Map<String, AiPricingResult> generateReasons(
            Room room,
            List<PricingSuggestion> pricing,
            PricingModel model,
            List<Booking> allBookings
    ) {
        List<PriceFeedback> recentFeedback =
                feedbackRepository.findTop10ByRoomIdOrderByCreatedAtDesc(room.getId());

        int avgLeadDays = computeAvgLeadDays(allBookings);

        try {
            String prompt = promptBuilder.build(room, pricing, model, recentFeedback, avgLeadDays);
            String response = geminiClient.generate(prompt);
            Map<String, AiPricingResult> parsed =
                    responseParser.parse(response, pricing, room.getPrice());
            return fallbackService.mergeFallback(pricing, parsed);
        } catch (Exception e) {
            return fallbackService.buildFallback(pricing);
        }
    }

    private int computeAvgLeadDays(List<Booking> allBookings) {
        OptionalDouble avg = allBookings.stream()
                .filter(b -> b.getCreatedAt() != null)
                .mapToLong(b -> ChronoUnit.DAYS.between(b.getCreatedAt().toLocalDate(), b.getCheckIn()))
                .filter(v -> v >= 0)
                .average();
        return (int) Math.round(avg.orElse(7.0));
    }
}