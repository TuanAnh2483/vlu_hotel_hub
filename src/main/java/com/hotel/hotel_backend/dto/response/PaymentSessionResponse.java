package com.hotel.hotel_backend.dto.response;

import java.time.LocalDateTime;

public record PaymentSessionResponse(
        Long paymentTransactionId,
        Long bookingId,
        String method,
        String status,
        Long amount,
        String paymentCode,
        String transferContent,
        String bankAccountNo,
        String bankAccountName,
        String bankName,
        String qrImageUrl,
        LocalDateTime expiresAt
) {}
