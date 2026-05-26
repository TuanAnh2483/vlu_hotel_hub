package com.hotel.hotel_backend.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record BookingResponse (
        Long bookingId,
        String hotelName,
        LocalDate checkIn,
        LocalDate checkOut,
        Long totalPrice,
        String status,
        LocalDateTime expiresAt,
        List<BookingItemResponse> items,
        BookingContactResponse contact
){}

