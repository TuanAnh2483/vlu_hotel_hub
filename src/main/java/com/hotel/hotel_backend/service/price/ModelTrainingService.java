package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.entity.BookingItem;
import com.hotel.hotel_backend.entity.PriceFeedback;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.PriceFeedbackRepository;
import com.hotel.hotel_backend.repository.PricingModelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.service.search.HolidayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.DoubleSummaryStatistics;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * AI model training service.
 *
 * Improvements over baseline:
 *
 * 1. Rolling training window — default 60 days (down from 90) to reduce
 *    long-term bias and respond faster to recent market conditions.
 *
 * 2. Time-decay weighted feedback — newer feedback receives exponentially
 *    higher weight (λ = 0.025 → half-life ≈ 28 days).  Applied in:
 *    - Phase 1: weighted acceptance rate controls aggressiveness update
 *    - Phase 3: weighted gradient descent for logistic regression
 *
 * 3. Structured debug logging for training window, weight distribution,
 *    and final learned parameters.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ModelTrainingService {

    // ── Training constants ────────────────────────────────────────────────────

    private static final int    MIN_FEEDBACK      = 5;
    /** Rolling window for feedback data (days). Smaller = less historical bias. */
    private static final int    TRAINING_WINDOW   = 60;
    private static final int    OCC_WEEKS         = 8;
    private static final int    MIN_OCC_POINTS    = 3;

    /**
     * Time-decay lambda for feedback weighting.
     * weight = exp(-DECAY_LAMBDA * daysAgo)
     * λ=0.025 → half-life ≈ 28 days: 60-day-old feedback ≈ 22% weight vs today.
     */
    private static final double DECAY_LAMBDA      = 0.025;

    private final PricingModelRepository  modelRepository;
    private final PriceFeedbackRepository feedbackRepository;
    private final BookingItemRepository   bookingItemRepository;
    private final RoomRepository          roomRepository;
    private final HolidayService          holidayService;
    private final SeasonalPricingService  seasonalPricingService;

    // ── Scheduled training ────────────────────────────────────────────────────

    @Scheduled(cron = "0 0 2 * * *")
    public void trainAllRooms() {
        log.info("[AI Training] Bắt đầu huấn luyện nightly (window={}d)...", TRAINING_WINDOW);
        List<Room> rooms = roomRepository.findAll();
        int trained = 0;
        for (Room room : rooms) {
            try {
                if (trainForRoom(room.getId())) trained++;
            } catch (Exception e) {
                log.error("[AI Training] Lỗi phòng {}: {}", room.getId(), e.getMessage());
            }
        }
        log.info("[AI Training] Hoàn thành: {}/{} phòng đã cập nhật", trained, rooms.size());
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public boolean trainForRoom(Long roomId) {
        Room room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return false;

        PricingModel model = modelRepository.findById(roomId)
                .orElseGet(() -> {
                    PricingModel m = new PricingModel();
                    m.setRoomId(roomId);
                    return m;
                });

        phase2HistoricalOccupancy(model, roomId, room.getQuantity());

        // Rolling window: use TRAINING_WINDOW days instead of 90-day fixed window
        LocalDateTime windowStart = LocalDateTime.now().minusDays(TRAINING_WINDOW);
        List<PriceFeedback> feedbacks =
                feedbackRepository.findByRoomIdAndCreatedAtAfterOrderByCreatedAtDesc(roomId, windowStart);

        log.debug("[AI Training] room={} feedbackCount={} window={}d",
                roomId, feedbacks.size(), TRAINING_WINDOW);

        if (feedbacks.size() < MIN_FEEDBACK) {
            model.setHasSufficientData(false);
            model.setLastTrainedAt(LocalDateTime.now());
            modelRepository.save(model);
            log.debug("[AI Training] room={} insufficient feedback ({}<{}), skipping",
                    roomId, feedbacks.size(), MIN_FEEDBACK);
            return false;
        }

        phase1FeedbackLearning(model, feedbacks);
        phase3LogisticRegression(model, feedbacks, room.getPrice());

        model.setHasSufficientData(true);
        model.setTrainingDataPoints(feedbacks.size());
        model.setTrainingRound(model.getTrainingRound() + 1);
        model.setLastTrainedAt(LocalDateTime.now());
        modelRepository.save(model);

        log.info("[AI Training] room={} round={} acceptance={}% agg={} partnerAdj={} window={}d",
                roomId, model.getTrainingRound(),
                String.format("%.1f", model.getLastAcceptanceRate() * 100),
                String.format("%.3f", model.getPriceAggressiveness()),
                String.format("%.3f", model.getPartnerPriceAdjustment()),
                TRAINING_WINDOW);
        return true;
    }

    @Transactional(readOnly = true)
    public PricingModel getOrDefault(Long roomId) {
        return modelRepository.findById(roomId).orElseGet(() -> {
            PricingModel m = new PricingModel();
            m.setRoomId(roomId);
            return m;
        });
    }

    @Transactional(readOnly = true)
    public List<PricingModel> getAllModels() {
        return modelRepository.findAll();
    }

    // ── Phase 1: Weighted feedback learning ──────────────────────────────────

    /**
     * Phase 1: Học từ phản hồi partner (có trọng số thời gian).
     *
     * Outcomes được xử lý:
     *  - APPLIED        → chấp nhận đúng giá; ratio ≈ 1.0
     *  - APPLIED_PLUS5  → partner thấy giá thấp, tự tăng ~5%; ratio ≈ 1.05
     *                     → tín hiệu: mô hình đang đề xuất thấp hơn thực tế thị trường
     *  - APPLIED_MINUS5 → partner thấy giá cao, tự giảm ~5%; ratio ≈ 0.95
     *  - SKIPPED        → từ chối; không đóng góp vào ratio
     *
     * priceAggressiveness: điều chỉnh mức độ "táo bạo" của mô hình
     * partnerPriceAdjustment: trung bình tỉ lệ appliedPrice/suggestedPrice (partner preference)
     */
    private void phase1FeedbackLearning(PricingModel model, List<PriceFeedback> feedbacks) {
        LocalDate today = LocalDate.now();

        double weightedAccepted = 0.0;
        double totalWeight      = 0.0;
        double weightedRatioSum = 0.0;
        double weightedRatioW   = 0.0;

        for (PriceFeedback f : feedbacks) {
            double daysAgo = computeDaysAgo(f.getCreatedAt(), today);
            double w = decayWeight(daysAgo);
            totalWeight += w;

            boolean accepted = f.getOutcome().startsWith("APPLIED");
            if (accepted) {
                weightedAccepted += w;
            }

            // Tính ratio thực tế từ appliedPrice nếu có, hoặc ước tính từ outcome
            if (accepted && f.getSuggestedPrice() > 0) {
                double ratio;
                if (f.getAppliedPrice() != null && f.getAppliedPrice() > 0) {
                    ratio = (double) f.getAppliedPrice() / f.getSuggestedPrice();
                } else {
                    // Ước tính ratio từ outcome khi appliedPrice không được ghi lại
                    ratio = switch (f.getOutcome()) {
                        case "APPLIED_PLUS5"  -> 1.05; // partner tăng thêm ~5%
                        case "APPLIED_MINUS5" -> 0.95; // partner giảm ~5%
                        default               -> 1.00; // APPLIED = đúng giá
                    };
                }
                weightedRatioSum += ratio * w;
                weightedRatioW   += w;
            }
        }

        double acceptanceRate = totalWeight > 0 ? weightedAccepted / totalWeight : 0.0;
        model.setLastAcceptanceRate(acceptanceRate);

        // Cập nhật aggressiveness: dựa trên tỉ lệ chấp nhận
        double agg = model.getPriceAggressiveness();
        if (acceptanceRate < 0.40) {
            agg *= 0.95; // partner hay từ chối → thận trọng hơn
        } else if (acceptanceRate > 0.75) {
            agg *= 1.03; // partner hay chấp nhận → có thể tăng nhẹ
        }
        agg = Math.max(0.75, Math.min(1.25, agg));
        model.setPriceAggressiveness(agg);

        if (weightedRatioW > 0) {
            double observedRatio = weightedRatioSum / weightedRatioW;
            // APPLIED_PLUS5 nhiều → ratio > 1.0 → partnerAdj tăng → đề xuất cao hơn
            // APPLIED_MINUS5 nhiều → ratio < 1.0 → partnerAdj giảm → đề xuất thấp hơn
            double observed = Math.max(0.75, Math.min(1.10, observedRatio));
            double newAdj = 0.70 * model.getPartnerPriceAdjustment() + 0.30 * observed;
            model.setPartnerPriceAdjustment(newAdj);
        }

        log.debug("[Phase1] room={} weightedAcceptance={} agg={} partnerAdj={}",
                model.getRoomId(),
                String.format("%.2f", acceptanceRate),
                String.format("%.3f", agg),
                String.format("%.3f", model.getPartnerPriceAdjustment()));
    }

    // ── Phase 2: Historical occupancy from bookings ───────────────────────────

    private void phase2HistoricalOccupancy(PricingModel model, Long roomId, int totalRooms) {
        if (totalRooms <= 0) return;

        LocalDate today    = LocalDate.now();
        LocalDate histFrom = today.minusWeeks(OCC_WEEKS);

        List<BookingItem> items = bookingItemRepository.findCoveringRange(
                roomId, histFrom, today);
        if (items.isEmpty()) return;

        Map<LocalDate, Integer> occupiedByDate = new HashMap<>();
        for (BookingItem bi : items) {
            LocalDate checkIn  = bi.getBooking().getCheckIn();
            LocalDate checkOut = bi.getBooking().getCheckOut();
            for (LocalDate d = checkIn; d.isBefore(checkOut); d = d.plusDays(1)) {
                if (!d.isBefore(histFrom) && d.isBefore(today)) {
                    occupiedByDate.merge(d, bi.getQuantity(), Integer::sum);
                }
            }
        }
        if (occupiedByDate.isEmpty()) return;

        DoubleSummaryStatistics weekdayStats = occupiedByDate.entrySet().stream()
                .filter(e -> isWeekday(e.getKey()))
                .mapToDouble(e -> Math.min(1.0, (double) e.getValue() / totalRooms))
                .summaryStatistics();

        DoubleSummaryStatistics weekendStats = occupiedByDate.entrySet().stream()
                .filter(e -> isWeekend(e.getKey()))
                .mapToDouble(e -> Math.min(1.0, (double) e.getValue() / totalRooms))
                .summaryStatistics();

        if (weekdayStats.getCount() >= MIN_OCC_POINTS)
            model.setAvgWeekdayOcc(weekdayStats.getAverage());
        if (weekendStats.getCount() >= MIN_OCC_POINTS)
            model.setAvgWeekendOcc(weekendStats.getAverage());

        if (model.getAvgWeekdayOcc() != null && model.getAvgWeekendOcc() != null) {
            double wkdOcc  = model.getAvgWeekdayOcc();
            double wkdEnd  = model.getAvgWeekendOcc();
            double observedLift = wkdEnd - wkdOcc;
            if (observedLift > 0 && observedLift < 0.6) {
                double learnedBoost = 0.60 * observedLift + 0.40 * 0.18;
                model.setWeekendBoost(Math.max(0.05, Math.min(0.40, learnedBoost)));
            }
            if (wkdOcc > 0 && wkdOcc < 0.85) {
                model.setWeekdayBoost(Math.max(0.02, Math.min(0.15, wkdOcc * 0.10)));
            }
        }
    }

    // ── Phase 3: Weighted Logistic Regression ────────────────────────────────
    // Features (8): [bias, priceUplift, isWeekend, isHoliday,
    //                sin(dow), cos(dow), leadTimeNorm, seasonalDeviation]
    // Sample weights from time-decay: newer feedback → higher gradient contribution.

    private void phase3LogisticRegression(PricingModel model, List<PriceFeedback> feedbacks, long basePrice) {
        if (feedbacks.size() < MIN_FEEDBACK || basePrice <= 0) return;

        LocalDate today = LocalDate.now();

        List<double[]> X       = new ArrayList<>();
        List<Integer>  y       = new ArrayList<>();
        List<Double>   weights = new ArrayList<>();

        for (PriceFeedback fb : feedbacks) {
            X.add(buildFeatures(fb, basePrice));
            y.add(fb.getOutcome().startsWith("APPLIED") ? 1 : 0);
            double daysAgo = computeDaysAgo(fb.getCreatedAt(), today);
            weights.add(decayWeight(daysAgo));
        }

        int    n      = X.size();
        double lr     = 0.05;
        double lambda = 0.01;
        int    epochs = 300;

        // 8 weights: w0–w7
        double[] w = { model.getLrW0(), model.getLrW1(), model.getLrW2(),
                       model.getLrW3(), model.getLrW4(), model.getLrW5(),
                       model.getLrW6(), model.getLrW7() };

        double finalLoss = 1.0;
        double prevLoss  = Double.MAX_VALUE;
        int    noImprove = 0;

        double totalW = weights.stream().mapToDouble(Double::doubleValue).sum();

        for (int epoch = 0; epoch < epochs; epoch++) {
            double[] grad = new double[8];
            double   loss = 0.0;

            for (int i = 0; i < n; i++) {
                double wi  = weights.get(i);
                double p   = sigmoid(dot(w, X.get(i)));
                double err = p - y.get(i);
                double wScaled = wi / totalW * n;
                loss += wi * (-y.get(i) * Math.log(p + 1e-9)
                        - (1 - y.get(i)) * Math.log(1 - p + 1e-9));
                for (int j = 0; j < 8; j++) grad[j] += err * X.get(i)[j] * wScaled;
            }

            for (int j = 0; j < 8; j++) {
                double reg = (j > 0) ? lambda * w[j] : 0.0;
                w[j] -= lr * (grad[j] / n + reg);
            }

            finalLoss = loss / totalW;

            if (prevLoss - finalLoss < 1e-6) {
                if (++noImprove >= 10) {
                    log.debug("[LR] Early stopping epoch={} loss={}", epoch,
                            String.format("%.4f", finalLoss));
                    break;
                }
            } else {
                noImprove = 0;
            }
            prevLoss = finalLoss;
        }

        model.setLrW0(w[0]); model.setLrW1(w[1]); model.setLrW2(w[2]);
        model.setLrW3(w[3]); model.setLrW4(w[4]); model.setLrW5(w[5]);
        model.setLrW6(w[6]); model.setLrW7(w[7]);
        model.setLrTrainingSamples(n);
        model.setLrLastLoss(finalLoss);
        model.setLrReady(true);

        log.info("[LR] room={} samples={} loss={} features=8 window={}d",
                model.getRoomId(), n,
                String.format("%.4f", finalLoss), TRAINING_WINDOW);
    }

    // ── Price optimiser: argmax(price × P(accept)) ────────────────────────────

    /**
     * @param daysUntil     số ngày từ hôm nay đến ngày đặt phòng
     * @param seasonalFactor hệ số mùa vụ từ SeasonalPricingService (e.g. 1.18 cho Tết)
     */
    public Long optimizePrice(PricingModel model, long basePrice,
                              String dateIso, boolean isWeekend, boolean isHoliday,
                              int daysUntil, double seasonalFactor) {
        if (!model.isLrReady() || basePrice <= 0) return null;

        double[] w = { model.getLrW0(), model.getLrW1(), model.getLrW2(),
                       model.getLrW3(), model.getLrW4(), model.getLrW5(),
                       model.getLrW6(), model.getLrW7() };

        LocalDate date = LocalDate.parse(dateIso);
        int    dow    = date.getDayOfWeek().getValue();
        double dowSin = Math.sin(2 * Math.PI * dow / 7.0);
        double dowCos = Math.cos(2 * Math.PI * dow / 7.0);

        // Normalise lead time: 0 = đặt sát ngày, 1 = đặt trước 60 ngày
        double leadTimeNorm = Math.min(60, Math.max(0, daysUntil)) / 60.0;
        // Seasonal deviation vs neutral (1.0): Tết → +0.18, thấp điểm → -0.08
        double seasonalDev  = seasonalFactor - 1.0;

        double bestExpRev = 0;
        Long   bestPrice  = null;

        for (int pct = 75; pct <= 150; pct += 5) {
            long   candidate   = Math.round((double) basePrice * pct / 100.0 / 1000) * 1000L;
            double priceUplift = (double) candidate / basePrice - 1.0;
            double[] x = { 1.0, priceUplift,
                           isWeekend ? 1.0 : 0.0,
                           isHoliday ? 1.0 : 0.0,
                           dowSin, dowCos,
                           leadTimeNorm, seasonalDev };
            double pAccept = sigmoid(dot(w, x));
            double expRev  = candidate * pAccept;
            if (expRev > bestExpRev) { bestExpRev = expRev; bestPrice = candidate; }
        }
        return bestPrice;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Xây dựng vector đặc trưng 8 chiều từ một feedback:
     *   [bias, priceUplift, isWeekend, isHoliday, sin(dow), cos(dow),
     *    leadTimeNorm, seasonalDeviation]
     *
     * leadTimeNorm   : thời gian đặt trước chuẩn hóa (0 = sát ngày, 1 = 60 ngày trước)
     * seasonalDev    : độ lệch mùa vụ so với trung tính (Tết ≈ +0.18, thấp điểm ≈ −0.08)
     */
    private double[] buildFeatures(PriceFeedback fb, long basePrice) {
        double priceUplift = (double) fb.getSuggestedPrice() / basePrice - 1.0;
        LocalDate date = LocalDate.parse(fb.getDate());
        int     dow    = date.getDayOfWeek().getValue();
        boolean wkend  = dow >= 6;
        boolean hol    = holidayService.getHolidayMap().containsKey(fb.getDate());
        double  dowSin = Math.sin(2 * Math.PI * dow / 7.0);
        double  dowCos = Math.cos(2 * Math.PI * dow / 7.0);

        // Lead time: số ngày từ lúc tạo feedback đến ngày ở
        // (bằng cách dùng createdAt sẵn có, không cần field mới)
        long rawLead = 7; // mặc định nếu không có createdAt
        if (fb.getCreatedAt() != null) {
            rawLead = ChronoUnit.DAYS.between(fb.getCreatedAt().toLocalDate(), date);
            rawLead = Math.max(0, Math.min(60, rawLead));
        }
        double leadTimeNorm = rawLead / 60.0;

        // Seasonal deviation: hệ số mùa vụ − 1.0 để model thấy được biên độ
        double seasonalDev = seasonalPricingService.getSeasonalFactor(date, hol, wkend) - 1.0;

        return new double[]{ 1.0, priceUplift,
                             wkend ? 1.0 : 0.0, hol ? 1.0 : 0.0,
                             dowSin, dowCos,
                             leadTimeNorm, seasonalDev };
    }

    /**
     * Time-decay weight: exp(-λ × daysAgo).
     * Newer feedback has weight closer to 1.0; 28-day-old ≈ 0.50; 60-day-old ≈ 0.22.
     */
    private double decayWeight(double daysAgo) {
        return Math.exp(-DECAY_LAMBDA * Math.max(0, daysAgo));
    }

    private double computeDaysAgo(LocalDateTime createdAt, LocalDate today) {
        if (createdAt == null) return TRAINING_WINDOW; // treat unknown as oldest
        return ChronoUnit.DAYS.between(createdAt.toLocalDate(), today);
    }

    private static double sigmoid(double z) { return 1.0 / (1.0 + Math.exp(-z)); }

    private static double dot(double[] w, double[] x) {
        double s = 0;
        for (int i = 0; i < w.length; i++) s += w[i] * x[i];
        return s;
    }

    private boolean isWeekday(LocalDate d) {
        DayOfWeek dow = d.getDayOfWeek();
        return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
    }

    private boolean isWeekend(LocalDate d) {
        DayOfWeek dow = d.getDayOfWeek();
        return dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY;
    }
}
