package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.BookingStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record AdminBookingResponse(
        Long id,
        String userEmail,
        String hotelName,
        LocalDate checkIn,
        LocalDate checkOut,
        long nights,
        Long totalPrice,
        BookingStatus status,
        LocalDateTime createdAt
) {
}
