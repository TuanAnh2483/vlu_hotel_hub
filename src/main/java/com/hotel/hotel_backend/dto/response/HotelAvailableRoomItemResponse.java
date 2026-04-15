package com.hotel.hotel_backend.dto.response;

public record HotelAvailableRoomItemResponse(
        Long roomId,
        String name,
        Integer capacity,
        Integer availableUnits,
        Long stayPrice    // total for stay
) {
}
