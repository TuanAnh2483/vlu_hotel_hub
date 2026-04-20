package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.CatalogOptionsResponse;
import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomAmenity;
import com.hotel.hotel_backend.entity.RoomCategory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    @GetMapping("/options")
    public ApiResponse<CatalogOptionsResponse> getOptions() {
        return ApiResponse.ok(new CatalogOptionsResponse(
                valuesOf(HotelType.values()),
                valuesOf(RoomCategory.values()),
                valuesOf(BedType.values()),
                valuesOf(HotelAmenity.values()),
                valuesOf(RoomAmenity.values())
        ));
    }

    private List<String> valuesOf(Enum<?>[] values) {
        return Arrays.stream(values)
                .map(Enum::name)
                .toList();
    }
}
