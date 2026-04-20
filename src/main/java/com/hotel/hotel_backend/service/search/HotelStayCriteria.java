package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;

import java.time.LocalDate;
import java.util.Set;

public record HotelStayCriteria(
        LocalDate checkIn,
        LocalDate checkOut,
        Integer adults,
        Integer rooms,
        Set<RoomCategory> roomCategories,
        Set<BedType> bedTypes,
        Set<RoomAmenity> roomAmenities
)
{}
