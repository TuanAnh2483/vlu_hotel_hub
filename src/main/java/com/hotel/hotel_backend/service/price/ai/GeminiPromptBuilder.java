package com.hotel.hotel_backend.service.price.ai;

import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.entity.PriceFeedback;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.service.price.SeasonalPricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Builds the Vietnamese-language prompt sent to Google Gemini.
 *
 * Improvements over baseline:
 * - Seasonal context (Tết, summer peak, golden week, low season) is injected
 *   so Gemini's reasoning reflects actual hotel demand patterns in Vietnam.
 * - Lead-time interpretation guide added (last-minute vs. advance bookings).
 * - Pricing guidelines are more conservative and operationally realistic.
 * - Per-day data includes seasonal label when applicable.
 * - Reasoning instruction steers away from marketing language toward
 *   concrete operational factors (occupancy, velocity, season, lead time).
 */
@Service
@RequiredArgsConstructor
public class GeminiPromptBuilder {

    private final SeasonalPricingService seasonalPricingService;

    public String build(
            Room room,
            List<PricingSuggestion> pricing,
            PricingModel model,
            List<PriceFeedback> recentFeedback,
            int avgLeadDays
    ) {
        StringBuilder sb = new StringBuilder();

        sb.append("Bạn là hệ thống quản lý doanh thu khách sạn tại Việt Nam.\n");
        sb.append("Nhiệm vụ: đề xuất giá phòng tối ưu cho từng ngày dưới đây.\n");
        sb.append("Lý do phải ngắn gọn, thực tế, dựa trên dữ liệu — không dùng ngôn ngữ tiếp thị.\n\n");

        // ── Room info ─────────────────────────────────────────────────────────
        sb.append("Thông tin phòng:\n");
        sb.append("- Tên: ").append(room.getName()).append("\n");
        sb.append("- Giá nền: ").append(String.format("%,d", room.getPrice())).append(" VND\n");
        sb.append("- Khách đặt trước trung bình: ").append(avgLeadDays).append(" ngày\n");

        // Lead-time interpretation
        if (avgLeadDays <= 3) {
            sb.append("  → Khách chủ yếu đặt sát ngày: cân nhắc giảm nhẹ khi lấp đầy thấp.\n");
        } else if (avgLeadDays <= 14) {
            sb.append("  → Khách thường đặt trước 1–2 tuần: giá cần cân bằng giữa lấp đầy và doanh thu.\n");
        } else {
            sb.append("  → Khách đặt sớm: có thể giữ giá cao hơn vì nhu cầu ổn định.\n");
        }
        sb.append("\n");

        // ── Seasonal context ──────────────────────────────────────────────────
        boolean hasSeasonalContext = false;
        for (PricingSuggestion p : pricing) {
            String label = seasonalPricingService.getSeasonLabel(LocalDate.parse(p.date()));
            if (label != null) { hasSeasonalContext = true; break; }
        }
        if (hasSeasonalContext) {
            sb.append("Bối cảnh mùa vụ (áp dụng cho các ngày bên dưới):\n");
            for (PricingSuggestion p : pricing) {
                String label = seasonalPricingService.getSeasonLabel(LocalDate.parse(p.date()));
                if (label != null) {
                    sb.append("- ").append(p.date()).append(": ").append(label).append("\n");
                }
            }
            sb.append("→ Điều chỉnh reasoning để phản ánh xu hướng mùa vụ thực tế.\n\n");
        }

        // ── Model context ─────────────────────────────────────────────────────
        if (model.getTrainingRound() > 0) {
            sb.append("Dữ liệu học máy cho phòng này:\n");
            sb.append("- Vòng huấn luyện: ").append(model.getTrainingRound()).append("\n");
            sb.append("- Tỉ lệ partner chấp nhận đề xuất: ")
                    .append(String.format("%.0f%%", model.getLastAcceptanceRate() * 100)).append("\n");
            sb.append("- Hệ số giá học được: ")
                    .append(String.format("%.2f", model.getPriceAggressiveness()))
                    .append(" (1.0=trung lập, <1=thận trọng, >1=đẩy cao hơn)\n");
            if (model.getAvgWeekdayOcc() != null)
                sb.append("- Công suất TB ngày thường (8 tuần): ")
                        .append(String.format("%.0f%%", model.getAvgWeekdayOcc() * 100)).append("\n");
            if (model.getAvgWeekendOcc() != null)
                sb.append("- Công suất TB cuối tuần (8 tuần): ")
                        .append(String.format("%.0f%%", model.getAvgWeekendOcc() * 100)).append("\n");
            sb.append("→ Ưu tiên dữ liệu học máy khi đề xuất giá.\n\n");
        }

        // ── Pricing guidelines ────────────────────────────────────────────────
        sb.append("Nguyên tắc định giá (ổn định, thực tế, dễ vận hành):\n");
        sb.append("- Công suất ≥85%: tăng 8–15% so với giá hiện tại (tối đa 15% ngày thường)\n");
        sb.append("- Công suất 60–84%: tăng 3–8%\n");
        sb.append("- Công suất <60%: giảm 3–10% để kích cầu\n");
        sb.append("- Cuối tuần: cộng thêm 5–12% (tối đa 25% so với giá hiện tại)\n");
        sb.append("- Ngày lễ nhỏ: cộng thêm 8–20%; Ngày lễ lớn/Tết: cộng thêm 15–35%\n");
        sb.append("- velocity ≥3 booking/7 ngày: tăng thêm 3–7%\n");
        sb.append("- daysUntil ≤2 và velocity=0: xem xét giảm 3–8%\n");
        sb.append("- Mùa thấp điểm (Oct–Nov): tránh tăng giá, ưu tiên lấp đầy\n");
        sb.append("- KHÔNG tăng quá 35% so với giá hiện tại trong bất kỳ trường hợp nào\n");
        sb.append("- Giá PHẢI là bội số của 1.000 VND\n\n");

        // ── Recent partner feedback ───────────────────────────────────────────
        if (recentFeedback != null && !recentFeedback.isEmpty()) {
            sb.append("Quyết định gần đây của partner (10 lần gần nhất):\n");
            for (PriceFeedback f : recentFeedback) {
                sb.append("- ").append(f.getDate())
                        .append(": đề xuất ").append(String.format("%,d", f.getSuggestedPrice())).append("đ");
                if (f.getAppliedPrice() != null)
                    sb.append(" → áp dụng ").append(String.format("%,d", f.getAppliedPrice())).append("đ");
                sb.append(" [").append(f.getOutcome()).append("]\n");
            }
            sb.append("Nếu partner hay SKIPPED → đề xuất thận trọng hơn.\n");
            sb.append("Nếu hay APPLIED_MINUS5 → giảm đề xuất ~5%.\n\n");
        }

        // ── Per-day data ──────────────────────────────────────────────────────
        sb.append("Dữ liệu từng ngày:\n");
        for (PricingSuggestion p : pricing) {
            sb.append("- date=").append(p.date())
                    .append(" currentPrice=").append(String.format("%,d", p.currentPrice())).append("VND")
                    .append(" occupancy=").append(String.format("%.0f%%", p.occupancy() * 100))
                    .append(" demand=").append(p.demand())
                    .append(" velocity=").append(p.velocity())
                    .append(" daysUntil=").append(p.daysUntil());
            if (p.isWeekend()) sb.append(" weekend=true");
            if (p.isHoliday()) sb.append(" holiday=").append(p.holidayTier());
            String seasonLabel = seasonalPricingService.getSeasonLabel(LocalDate.parse(p.date()));
            if (seasonLabel != null) sb.append(" season=").append(seasonLabel);
            if (p.suggestedPrice() != null)
                sb.append(" baseline=").append(String.format("%,d", p.suggestedPrice())).append("VND");
            sb.append("\n");
        }

        // ── Output format ─────────────────────────────────────────────────────
        sb.append("\nChỉ trả về JSON array hợp lệ (KHÔNG có text thêm, KHÔNG markdown):\n");
        sb.append("[{\"date\":\"YYYY-MM-DD\",\"suggestedPrice\":1500000,");
        sb.append("\"priceLow\":1380000,\"priceHigh\":1620000,");
        sb.append("\"reason\":\"lý do ngắn ≤12 từ, đề cập: công suất/mùa vụ/ngày lễ/xu hướng\"}]");

        return sb.toString();
    }
}
