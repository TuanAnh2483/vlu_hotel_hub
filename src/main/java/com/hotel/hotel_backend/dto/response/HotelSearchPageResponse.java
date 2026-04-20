package com.hotel.hotel_backend.dto.response;

import java.util.List;

public record HotelSearchPageResponse(
        List<HotelSearchItemResponse> items,
        Integer page,
        Integer size,
        Long totalItems,
        Integer totalPages,
        Boolean hasNext,
        String sort
) {
}
