package com.hotel.hotel_backend.service.price;

import com.hotel.hotel_backend.dto.OccupancyForecast;
import com.hotel.hotel_backend.dto.PricingSuggestion;
import com.hotel.hotel_backend.dto.response.PriceSuggestionItem;
import com.hotel.hotel_backend.dto.response.PriceSuggestionResponse;
import com.hotel.hotel_backend.dto.response.RevenueAnalyticsResponse;
import com.hotel.hotel_backend.dto.response.TrainResultResponse;
import com.hotel.hotel_backend.entity.AiPricingResult;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.DailyRate;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.service.SecurityService;
import com.hotel.hotel_backend.service.price.ai.AiReasonService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class PriceSuggestionService {

    // =====================================================
    // repositories
    // =====================================================

    private final RoomRepository roomRepository;
    private final DailyRateRepository dailyRateRepository;
    private final BookingRepository bookingRepository;

    // =====================================================
    // security
    // =====================================================

    private final SecurityService securityService;

    // =====================================================
    // validators
    // =====================================================

    private final PricingValidator pricingValidator;

    // =====================================================
    // pricing services
    // =====================================================

    private final OccupancyForecastService occupancyForecastService;
    private final PricingEngineService pricingEngineService;
    private final AiReasonService aiReasonService;
    private final PriceFeedbackService feedbackService;
    private final RevenueAnalyticsService revenueAnalyticsService;
    private final ModelTrainingService modelTrainingService;

    // =====================================================
    // mapper
    // =====================================================

    private final PriceSuggestionMapper priceSuggestionMapper;

    // =====================================================
    // MAIN API
    // =====================================================

    public PriceSuggestionResponse getSuggestions(
            Long roomId,
            LocalDate from,
            LocalDate to
    ) {

        // =================================================
        // validate input
        // =================================================

        log.debug("[PriceSuggestion] roomId={} from={} to={}", roomId, from, to);

        pricingValidator.validateDateRange(
                from,
                to
        );

        // =================================================
        // current owner
        // =================================================

        long ownerId =
                securityService
                        .getCurrentPrincipal()
                        .userId();

        // =================================================
        // load room (JOIN FETCH hotel to avoid lazy-load NPE)
        // =================================================

        Room room =
                roomRepository
                        .findByIdAndHotelOwnerIdWithHotel(
                                roomId,
                                ownerId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        ErrorCode.NOT_FOUND,
                                        "Room not found"
                                )
                        );

        pricingValidator.validateRoom(room);

        // =================================================
        // load current rates
        // =================================================

        Map<LocalDate, Long> ratesByDate =
                loadRates(
                        roomId,
                        from,
                        to
                );

        // =================================================
        // load bookings + pricing model
        // =================================================

        List<Booking> allBookings =
                bookingRepository.findPartnerBookingsForAnalytics(
                        ownerId,
                        room.getHotel().getId(),
                        LocalDate.now().minusDays(90),
                        to
                );

        PricingModel pricingModel =
                modelTrainingService.getOrDefault(roomId);

        log.debug("[PriceSuggestion] roomId={} model: round={} hasSufficientData={} agg={} acceptance={}%",
                roomId, pricingModel.getTrainingRound(), pricingModel.isHasSufficientData(),
                String.format("%.3f", pricingModel.getPriceAggressiveness()),
                String.format("%.1f", pricingModel.getLastAcceptanceRate() * 100));

        // =================================================
        // occupancy forecast
        // =================================================

        List<OccupancyForecast> forecasts =
                occupancyForecastService.forecast(
                        room,
                        allBookings,
                        pricingModel,
                        from,
                        to
                );

        // =================================================
        // pricing engine
        // =================================================

        List<PricingSuggestion> pricing =
                pricingEngineService.generatePricing(
                        room,
                        forecasts,
                        pricingModel,
                        ratesByDate
                );

        log.debug("[PriceSuggestion] roomId={} forecasts={} bookings={}",
                roomId, forecasts.size(), allBookings.size());

        // =================================================
        // AI reasoning
        // =================================================

        Map<String, AiPricingResult> aiResults =
                aiReasonService.generateReasons(
                        room,
                        pricing,
                        pricingModel,
                        allBookings
                );

        // =================================================
        // build response items
        // =================================================

        List<PriceSuggestionItem> items =
                priceSuggestionMapper.toItems(
                        pricing,
                        aiResults
                );

        long aiCount = items.stream().filter(PriceSuggestionItem::aiGenerated).count();
        log.info("[PriceSuggestion] roomId={} items={} aiGenerated={} from={} to={}",
                roomId, items.size(), aiCount, from, to);

        // =================================================
        // final response
        // =================================================

        return new PriceSuggestionResponse(
                room.getId(),
                room.getName(),
                room.getHotel().getId(),
                room.getPrice(),
                items,
                pricingModel.getTrainingRound(),
                pricingModel.getTrainingDataPoints(),
                pricingModel.getPriceAggressiveness(),
                pricingModel.getLastAcceptanceRate(),
                pricingModel.isHasSufficientData(),
                pricingModel.getLastTrainedAt()
        );
    }

    // =====================================================
    // FEEDBACK
    // =====================================================

    @Transactional
    public void recordFeedback(
            Long roomId,
            String date,
            Long suggested,
            Long appliedPrice,
            String outcome
    ) {

        long ownerId =
                securityService
                        .getCurrentPrincipal()
                        .userId();

        Room room =
                roomRepository
                        .findByIdAndHotelOwnerId(
                                roomId,
                                ownerId
                        )
                        .orElseThrow(() ->
                                new ApiException(
                                        ErrorCode.NOT_FOUND,
                                        "Room not found"
                                )
                        );

        pricingValidator.validateRoom(room);

        feedbackService.record(
                room.getId(),
                date,
                suggested,
                appliedPrice,
                outcome,
                ownerId
        );
    }

    // =====================================================
    // TRAINING
    // =====================================================

    @Transactional
    public TrainResultResponse triggerTraining(Long roomId) {

        long ownerId =
                securityService
                        .getCurrentPrincipal()
                        .userId();

        roomRepository
                .findByIdAndHotelOwnerId(roomId, ownerId)
                .orElseThrow(() ->
                        new ApiException(ErrorCode.NOT_FOUND, "Room not found"));

        PricingModel existing = modelTrainingService.getOrDefault(roomId);
        if (existing.getLastTrainedAt() != null
                && existing.getLastTrainedAt().isAfter(LocalDateTime.now().minusHours(1))) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "Vui lòng chờ ít nhất 1 giờ giữa các lần huấn luyện thủ công");
        }

        modelTrainingService.trainForRoom(roomId);

        PricingModel model = modelTrainingService.getOrDefault(roomId);

        return new TrainResultResponse(
                model.isHasSufficientData(),
                model.getTrainingRound(),
                model.getTrainingDataPoints(),
                model.getPriceAggressiveness(),
                model.getLastAcceptanceRate(),
                model.getLastTrainedAt()
        );
    }

    // =====================================================
    // ANALYTICS
    // =====================================================

    public RevenueAnalyticsResponse getRevenueAnalytics(
            Long roomId
    ) {

        return revenueAnalyticsService
                .getAnalytics(roomId);
    }

    // =====================================================
    // helpers
    // =====================================================

    private Map<LocalDate, Long> loadRates(
            Long roomId,
            LocalDate from,
            LocalDate to
    ) {

        return dailyRateRepository
                .findByIdRoomIdAndIdDateBetween(
                        roomId,
                        from,
                        to
                )
                .stream()
                .collect(Collectors.toMap(
                        r -> r.getId().date(),
                        DailyRate::getPrice
                ));
    }
}