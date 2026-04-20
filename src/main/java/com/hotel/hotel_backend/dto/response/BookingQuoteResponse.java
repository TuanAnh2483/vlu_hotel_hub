package com.hotel.hotel_backend.dto.response;

import java.time.LocalDate;
import java.util.List;

public record BookingQuoteResponse(
        Long hotelId,
        String hotelName,
        LocalDate checkIn,
        LocalDate checkOut,
        Double totalPrice,
        List<BookingItemResponse> items
) {}
