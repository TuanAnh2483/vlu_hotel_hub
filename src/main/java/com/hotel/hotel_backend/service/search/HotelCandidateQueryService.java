package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelStatus;
import com.hotel.hotel_backend.repository.HotelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class HotelCandidateQueryService {

    private final HotelRepository hotelRepository;




    public List<Hotel> findCandidates(HotelSearchCriteria criteria) {
        List<Hotel> hotels;
        if (criteria.district() != null && !criteria.district().isBlank()) {
            hotels = hotelRepository.findByProvinceAndDistrictAndStatus(
                    criteria.province(),
                    criteria.district(),
                    HotelStatus.ACTIVE
            );
        } else {
            hotels = hotelRepository.findByProvinceAndStatus(
                    criteria.province(),
                    HotelStatus.ACTIVE
            );
        }

        return hotels.stream()
                .filter(hotel -> criteria.hotelTypes().isEmpty() || criteria.hotelTypes().contains(hotel.getHotelType()))
                .filter(hotel -> criteria.hotelAmenities().isEmpty() || hotel.getAmenities().containsAll(criteria.hotelAmenities()))
                .toList();
    }
}
