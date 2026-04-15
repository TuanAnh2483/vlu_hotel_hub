package com.hotel.hotel_backend.controller;


import com.hotel.hotel_backend.dto.request.HotelSearchRequest;
import com.hotel.hotel_backend.dto.request.HotelStayRequest;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.HotelAvailableRoomItemResponse;
import com.hotel.hotel_backend.dto.response.HotelDetailResponse;
import com.hotel.hotel_backend.dto.response.HotelSearchItemResponse;
import com.hotel.hotel_backend.service.search.HotelDetailService;
import com.hotel.hotel_backend.service.search.HotelSearchCriteria;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hotels")
@RequiredArgsConstructor

public class HotelController {
    private final HotelSearchUseCase hotelSearchUseCase;
    private final HotelDetailService hotelDetailService;

    @GetMapping("/search")
    public ApiResponse<List<HotelSearchItemResponse>> search(@Valid @ModelAttribute HotelSearchRequest request) { ///@ModelAttribute giúp bind query param của GET
        HotelSearchCriteria criteria = new HotelSearchCriteria(
                request.getProvince(),
                request.getDistrict(),
                request.getCheckIn(),
                request.getCheckOut(),
                request.getAdults(),
                request.getRooms()
        );

        return ApiResponse.ok(hotelSearchUseCase.search(criteria));
    }

    @GetMapping("/{id}")
    public ApiResponse<HotelDetailResponse> getHotelById(@PathVariable("id") Long hotelId) {
        HotelDetailResponse hotel = hotelDetailService.getHotelDetail(hotelId);
        return ApiResponse.ok(hotel);
    }

    @GetMapping("/{id}/available-rooms")
    public ApiResponse<List<HotelAvailableRoomItemResponse>> getAvailableRooms(
            @PathVariable("id") Long hotelId,
            @Valid @ModelAttribute HotelStayRequest request
    ) {
        HotelStayCriteria criteria = new HotelStayCriteria(
                request.getCheckIn(),
                request.getCheckOut(),
                request.getAdults(),
                request.getRooms()
        );

        return ApiResponse.ok(hotelDetailService.getAvailableRooms(hotelId, criteria));
    }
}
