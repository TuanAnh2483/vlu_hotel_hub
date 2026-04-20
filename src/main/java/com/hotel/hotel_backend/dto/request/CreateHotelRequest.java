package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record CreateHotelRequest(

        @NotBlank(message = "Name is required")
        String name,

        @NotBlank(message = "Address is required")
        String address,

        @NotBlank(message = "District is required")
        String district,

        @NotBlank(message = "Province is required")
        String province,

        String description,
        @NotNull(message = "Hotel type is required")
        HotelType hotelType,
        Set<HotelAmenity> amenities
) {}
