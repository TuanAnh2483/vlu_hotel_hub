package com.hotel.hotel_backend.dto.response;

import java.time.LocalDateTime;

public record BookingPaymentTransactionResponse(
        Long paymentTransactionId,
        String method,
        String status,
        Long amount,
        String providerReference,
        String failureReason,
        String clientRequestId,
        LocalDateTime createdAt
) {}
