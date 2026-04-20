package com.hotel.hotel_backend.dto.response;

import java.util.List;

public record PartnerBookingPageResponse(
        List<PartnerBookingSummaryResponse> items,
        Integer page,
        Integer size,
        Long totalItems,
        Integer totalPages,
        Boolean hasNext
) {}
