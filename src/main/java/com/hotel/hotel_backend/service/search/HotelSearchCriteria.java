package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;

import java.time.LocalDate;
import java.util.Set;

public record HotelSearchCriteria(
        String province,
        String district,
        LocalDate checkIn,
        LocalDate checkOut,
        Integer adults,
        Integer rooms,
        Integer page,
        Integer size,
        HotelSearchSort sort,
        Set<HotelType> hotelTypes,
        Set<RoomCategory> roomCategories,
        Set<BedType> bedTypes,
        Set<HotelAmenity> hotelAmenities,
        Set<RoomAmenity> roomAmenities
) {
}
