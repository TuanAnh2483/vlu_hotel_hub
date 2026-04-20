package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;

import jakarta.validation.constraints.Min;

import java.util.Set;

public record CreateRoomRequest(

        @NotBlank(message = "Room name is required")
        String name,

        @NotNull
        @Min(value = 1, message = "Capacity must be at least 1")
        Integer capacity,

        @NotNull
        @Min(value = 0, message = "Quantity must be >= 0")
        Integer quantity,

        @NotNull
        @Min(value = 0, message = "Price must be >= 0")
        Long price,

        @NotNull(message = "Room category is required")
        RoomCategory roomCategory,

        @NotNull(message = "Bed type is required")
        BedType bedType,

        Set<RoomAmenity> amenities
) {}
