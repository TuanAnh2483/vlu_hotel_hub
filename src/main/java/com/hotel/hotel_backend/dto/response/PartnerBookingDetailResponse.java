package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.BookingStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PartnerBookingDetailResponse(
        Long bookingId,
        Long hotelId,
        String hotelName,
        Long customerId,
        LocalDate checkIn,
        LocalDate checkOut,
        Long totalPrice,
        BookingStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime expiresAt,
        List<BookingItemResponse> items,
        BookingContactResponse contact
) {}
