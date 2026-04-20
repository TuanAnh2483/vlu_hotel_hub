package com.hotel.hotel_backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record BookingPaymentRequest(
        @NotNull(message = "simulateSuccess is required")
        Boolean simulateSuccess,

        @NotBlank(message = "clientRequestId is required")
        String clientRequestId
) {}
