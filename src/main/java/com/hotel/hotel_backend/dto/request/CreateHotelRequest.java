package com.hotel.hotel_backend.dto.request;

import jakarta.validation.constraints.NotBlank;


public record CreateHotelRequest(

        @NotBlank(message = "Name is required")
        String name,

        @NotBlank(message = "Address is required")
        String address,

        @NotBlank(message = "District is required")
        String district,

        @NotBlank(message = "Province is required")
        String province,

        String description
) {}
