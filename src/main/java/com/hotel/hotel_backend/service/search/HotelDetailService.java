package com.hotel.hotel_backend.service.search;

import com.hotel.hotel_backend.dto.response.HotelAvailableRoomItemResponse;
import com.hotel.hotel_backend.dto.response.HotelDetailResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.HotelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;



@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HotelDetailService {

    private final HotelRepository hotelRepository;
    private final HotelAvailabilityService hotelAvailabilityService;

    // Tim theo Id ko co nem loi ra
    private Hotel findHotel(Long hotelId) {
        return hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    public HotelDetailResponse getHotelDetail(Long hotelId) {
        Hotel hotel = findHotel(hotelId);
        return toDetailResponse(hotel);
    }

    public List<HotelAvailableRoomItemResponse> getAvailableRooms(Long hotelId, HotelStayCriteria criteria) {
        Hotel hotel = findHotel(hotelId);
        return hotelAvailabilityService.findAvailableRoomItems(hotel, criteria);
    }


    private HotelDetailResponse toDetailResponse(Hotel hotel) {
        return new HotelDetailResponse(
                hotel.getId(),
                hotel.getName(),
                hotel.getAddress(),
                hotel.getProvince(),
                hotel.getDistrict(),
                hotel.getDescription(),
                hotel.getRatingAvg(),
                hotel.getRatingCount()
        );

    }
}
