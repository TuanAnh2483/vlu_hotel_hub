package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelStatus;
import com.hotel.hotel_backend.entity.HotelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record UpdateHotelRequest(
        @NotBlank(message="null able")
        String name,
        @NotBlank(message="null able")
        String address,
        @NotBlank(message="null able")
        String province,
        @NotBlank(message="null able")
        String district,
        String description,
        @NotNull(message = "Hotel type is required")
        HotelType hotelType,
        Set<HotelAmenity> amenities,
        HotelStatus status
) {}
