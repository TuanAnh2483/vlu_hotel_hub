package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.PaymentMethod;
import com.hotel.hotel_backend.entity.PaymentTransactionStatus;

import java.time.LocalDateTime;

public record MyBillingItemResponse(
        Long id,
        Long bookingId,
        String hotelName,
        String description,
        Long amount,
        PaymentTransactionStatus status,
        PaymentMethod method,
        LocalDateTime createdAt
) {
}
