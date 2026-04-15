package com.hotel.hotel_backend.service;


import com.hotel.hotel_backend.dto.response.HotelSearchItemResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.mapper.HotelSearchMapper;
import com.hotel.hotel_backend.service.search.HotelAvailabilityService;
import com.hotel.hotel_backend.service.search.HotelCandidateQueryService;
import com.hotel.hotel_backend.service.search.HotelSearchCriteria;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class HotelSearchService implements HotelSearchUseCase {

    private final HotelCandidateQueryService hotelCandidateQueryService;
    private final HotelAvailabilityService hotelAvailabilityService;
    private final HotelSearchMapper hotelSearchMapper;


    @Override
    public List<HotelSearchItemResponse> search(HotelSearchCriteria criteria) {
        HotelStayCriteria stayCriteria = new HotelStayCriteria(
                criteria.checkIn(),
                criteria.checkOut(),
                criteria.adults(),
                criteria.rooms()
        );

        List<Hotel> candidateHotels = hotelCandidateQueryService.findCandidates(criteria);
        List<Hotel> availableHotels = hotelAvailabilityService.filterAvailableHotels(candidateHotels, stayCriteria);

        return availableHotels.stream()
                .map(hotel -> hotelSearchMapper.toItem(
                        hotel,
                        hotelAvailabilityService.findMinPriceForStay(hotel, stayCriteria)
                ))
                .toList();
    }


}


