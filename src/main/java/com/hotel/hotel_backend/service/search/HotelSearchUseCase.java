package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.dto.response.HotelSearchPageResponse;

public interface HotelSearchUseCase {
    HotelSearchPageResponse search(HotelSearchCriteria criteria);
}
