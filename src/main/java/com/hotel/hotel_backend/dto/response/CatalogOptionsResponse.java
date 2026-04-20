package com.hotel.hotel_backend.dto.response;

import java.util.List;

public record CatalogOptionsResponse(
        List<String> hotelTypes,
        List<String> roomCategories,
        List<String> bedTypes,
        List<String> hotelAmenities,
        List<String> roomAmenities
) {
}
