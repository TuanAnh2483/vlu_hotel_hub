package com.hotel.hotel_backend.service.price.util;

import com.hotel.hotel_backend.dto.OccupancyForecast;
import com.hotel.hotel_backend.entity.PricingModel;
import com.hotel.hotel_backend.service.price.ModelTrainingService;
import com.hotel.hotel_backend.service.price.SeasonalPricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

import static com.hotel.hotel_backend.service.price.util.PricingUtils.roundK;

@Component
@RequiredArgsConstructor
public class PricingFactorCalculator {

    private final ModelTrainingService  modelTrainingService;
    private final SeasonalPricingService seasonalPricingService;

    public Long calculateSuggestedPrice(
            Long currentPrice,
            Long basePrice,
            OccupancyForecast fc,
            PricingModel pricingModel
    ) {

        if (currentPrice == null || currentPrice <= 0) {
            return null;
        }

        // =================================================
        // demand factor
        // =================================================

        double demandFactor =
                (0.93 + fc.occupancy() * 0.25)
                        * pricingModel.getPriceAggressiveness();

        // =================================================
        // weekend factor
        // =================================================

        double weekendFactor =
                fc.weekend()
                        ? 1.08
                        : 1.0;

        // =================================================
        // holiday factor
        // =================================================

        double holidayFactor =
                fc.holiday()
                        ? (
                        "MAJOR".equals(fc.holidayTier())
                                ? 1.30
                                : 1.10
                )
                        : 1.0;

        // =================================================
        // suggested price
        // =================================================

        Long suggestedPrice =
                roundK(
                        currentPrice
                                * demandFactor
                                * weekendFactor
                                * holidayFactor
                                * pricingModel.getPartnerPriceAdjustment()
                );

        // =================================================
        // logistic regression optimization
        // =================================================

        if (pricingModel.isLrReady()) {

            double seasonalFactor = seasonalPricingService.getSeasonalFactor(
                    LocalDate.parse(fc.date()), fc.holiday(), fc.weekend());

            Long lrPrice =
                    modelTrainingService.optimizePrice(
                            pricingModel,
                            basePrice,
                            fc.date(),
                            fc.weekend(),
                            fc.holiday(),
                            fc.daysUntil(),
                            seasonalFactor
                    );

            if (lrPrice != null) {
                suggestedPrice = lrPrice;
            }
        }

        return suggestedPrice;
    }

    public Long calculateLowPrice(Long suggestedPrice) {

        if (suggestedPrice == null) {
            return null;
        }

        return roundK(suggestedPrice * 0.92);
    }

    public Long calculateHighPrice(Long suggestedPrice) {

        if (suggestedPrice == null) {
            return null;
        }

        return roundK(suggestedPrice * 1.08);
    }

    public double calculateDeltaPercent(
            Long currentPrice,
            Long suggestedPrice
    ) {

        if (currentPrice == null
                || currentPrice <= 0
                || suggestedPrice == null) {

            return 0.0;
        }

        return (
                (double) (
                        suggestedPrice - currentPrice
                ) / currentPrice
        ) * 100;
    }
}