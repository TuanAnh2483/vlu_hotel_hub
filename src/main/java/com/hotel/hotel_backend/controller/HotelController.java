package com.hotel.hotel_backend.controller;


import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;
import com.hotel.hotel_backend.dto.request.HotelSearchRequest;
import com.hotel.hotel_backend.dto.request.HotelStayRequest;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.HotelAvailableRoomItemResponse;
import com.hotel.hotel_backend.dto.response.HotelDetailResponse;
import com.hotel.hotel_backend.dto.response.HotelSearchPageResponse;
import com.hotel.hotel_backend.service.search.HotelDetailService;
import com.hotel.hotel_backend.service.search.HotelSearchCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchSort;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/hotels")
@RequiredArgsConstructor

public class HotelController {
    private final HotelSearchUseCase hotelSearchUseCase;
    private final HotelDetailService hotelDetailService;

    @GetMapping("/search")
    public ApiResponse<HotelSearchPageResponse> search(@Valid @ModelAttribute HotelSearchRequest request) { ///@ModelAttribute giúp bind query param của GET
        HotelSearchCriteria criteria = new HotelSearchCriteria(
                request.getProvince(),
                request.getDistrict(),
                request.getCheckIn(),
                request.getCheckOut(),
                request.getAdults(),
                request.getRooms(),
                request.getPage(),
                request.getSize(),
                HotelSearchSort.fromValue(request.getSort()),
                toHotelTypeSet(request.getHotelTypes()),
                toRoomCategorySet(request.getRoomCategories()),
                toBedTypeSet(request.getBedTypes()),
                toHotelAmenitySet(request.getHotelAmenities()),
                toRoomAmenitySet(request.getRoomAmenities())
        );
        return ApiResponse.ok(hotelSearchUseCase.search(criteria));
    }

    @GetMapping("/{id}")
    public ApiResponse<HotelDetailResponse>getHotelById(@PathVariable("id") Long hotelId) {
        HotelDetailResponse hotel = hotelDetailService.getHotelDetail(hotelId);
        return ApiResponse.ok(hotel);
    }

    @GetMapping("/{id}/available-rooms")
    public ApiResponse<List<HotelAvailableRoomItemResponse>>getAvailableRooms(
            @PathVariable("id") Long hotelId,
            @Valid @ModelAttribute HotelStayRequest request
    )
    {
        HotelStayCriteria criteria = new HotelStayCriteria(
                request.getCheckIn(),
                request.getCheckOut(),
                request.getAdults(),
                request.getRooms(),
                Set.of(),
                Set.of(),
                Set.of()
        );
        return ApiResponse.ok(hotelDetailService.getAvailableRooms(hotelId, criteria));
    }

    private Set<HotelType> toHotelTypeSet(List<HotelType> hotelTypes) {
        if (hotelTypes == null || hotelTypes.isEmpty()) {
            return Set.of();
        }

        return new LinkedHashSet<>(hotelTypes);
    }

    private Set<RoomCategory> toRoomCategorySet(List<RoomCategory> roomCategories) {
        if (roomCategories == null || roomCategories.isEmpty()) {
            return Set.of();
        }

        return new LinkedHashSet<>(roomCategories);
    }

    private Set<BedType> toBedTypeSet(List<BedType> bedTypes) {
        if (bedTypes == null || bedTypes.isEmpty()) {
            return Set.of();
        }

        return new LinkedHashSet<>(bedTypes);
    }

    private Set<HotelAmenity> toHotelAmenitySet(List<HotelAmenity> amenities) {
        if (amenities == null || amenities.isEmpty()) {
            return Set.of();
        }

        return new LinkedHashSet<>(amenities);
    }

    private Set<RoomAmenity> toRoomAmenitySet(List<RoomAmenity> amenities) {
        if (amenities == null || amenities.isEmpty()) {
            return Set.of();
        }

        return new LinkedHashSet<>(amenities);
    }
}
