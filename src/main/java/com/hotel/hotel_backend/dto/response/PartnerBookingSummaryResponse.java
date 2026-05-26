package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.BookingStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PartnerBookingSummaryResponse(
        Long bookingId,
        Long hotelId,
        String hotelName,
        String customerName,
        LocalDate checkIn,
        LocalDate checkOut,
        Long totalPrice,
        BookingStatus status,
        LocalDateTime createdAt,
        LocalDateTime expiresAt
) {}
