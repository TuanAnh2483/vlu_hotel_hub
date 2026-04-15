package com.hotel.hotel_backend.service.search;

import java.time.LocalDate;

public record HotelStayCriteria(
        LocalDate checkIn,
        LocalDate checkOut,
        Integer adults,
        Integer rooms
)
{}
