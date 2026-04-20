package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;

import java.util.Set;

public record RoomResponse(
        Long id,
        String name,
        Integer capacity,
        Integer quantity,
        Long price,
        Long hotelId,
        RoomCategory roomCategory,
        BedType bedType,
        Set<RoomAmenity> amenities
) {}
