package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;

import java.util.Set;

public record HotelResponse(
        Long id,
        String name,
        String address,
        String district,
        String province,
        String description,
        HotelType hotelType,
        Set<HotelAmenity> amenities

) {}
