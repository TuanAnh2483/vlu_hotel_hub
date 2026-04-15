package com.hotel.hotel_backend.dto.response;

public record HotelResponse(
        Long id,
        String name,
        String address,
        String district,
        String province,
        String description

) {}

