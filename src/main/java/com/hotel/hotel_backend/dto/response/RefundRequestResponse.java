package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.RefundRequestStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record RefundRequestResponse(
        Long id,
        Long bookingId,
        Long hotelId,
        String hotelName,
        String userEmail,
        Long amount,
        String reason,
        String note,
        RefundRequestStatus status,
        LocalDate checkIn,
        LocalDate checkOut,
        LocalDateTime requestedAt,
        LocalDateTime reviewedAt
) {
}
