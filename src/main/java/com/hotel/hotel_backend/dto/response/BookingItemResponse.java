package com.hotel.hotel_backend.dto.response;

public record BookingItemResponse(
        Long roomTypeId,
        String roomTypeName,
        Integer quantity,
        Long stayPrice
) {}
