package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.HotelStatus;
import jakarta.validation.constraints.NotBlank;

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
        HotelStatus status
) {}
