package com.hotel.hotel_backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;

public record SetBasePricingRequest(

        @NotNull(message = "basePrice is required")
        @Min(value = 0, message = "basePrice must be >= 0")
        @Max(value = 100_000_000, message = "Giá thuê không được vượt quá 100.000.000 ₫/đêm")
        Long basePrice,

        @Min(value = 1, message = "minStay must be at least 1")
        Integer minStay
) {}