package com.hotel.hotel_backend.dto.response;

import java.math.BigDecimal;

public record HotelDetailResponse (
        Long hotelId,
        String name,
        String address,
        String province,
        String district,
        String description,
        BigDecimal ratingAvg,
        Integer ratingCount
)
{


}
