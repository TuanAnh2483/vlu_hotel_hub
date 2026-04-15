package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.CreateHotelRequest;
import com.hotel.hotel_backend.dto.request.UpdateHotelRequest;
import com.hotel.hotel_backend.dto.response.HotelResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class HotelService {

    private final HotelRepository hotelRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final SecurityService securityService;

    public HotelResponse create(CreateHotelRequest request) {
        // Tạo khách sạn mới cho partner hiện tại.
        User owner = getCurrentUser();

        Hotel hotel = new Hotel();
        hotel.setName(request.name());
        hotel.setAddress(request.address());
        hotel.setDistrict(request.district());
        hotel.setProvince(request.province());
        hotel.setOwner(owner);
        hotel.setDescription(request.description());
        hotelRepository.save(hotel);

        return mapToResponse(hotel);
    }

    @Transactional(readOnly = true)
    public List<HotelResponse> getMyHotels() {
        // Lấy danh sách khách sạn của partner hiện tại.
        Long userId = getPrincipal().userId();

        return hotelRepository.findByOwnerId(userId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    public HotelResponse update(Long id, UpdateHotelRequest request) {
        // Cập nhật thông tin khách sạn thuộc sở hữu hiện tại.
        Hotel hotel = findOwnedHotel(id);

        hotel.setName(request.name());
        hotel.setAddress(request.address());
        hotel.setDistrict(request.district());
        hotel.setProvince(request.province());
        hotel.setDescription(request.description());

        return mapToResponse(hotel);
    }

    @Transactional
    public void delete(Long id) {
        // Xóa khách sạn nếu không có phòng liên kết.
        Hotel hotel = findOwnedHotel(id);

        if (roomRepository.existsByHotelId(id)) {
            throw new ApiException(ErrorCode.HOTEL_HAS_ROOMS);
        }

        hotelRepository.delete(hotel);
    }

    // ---------------- Helper methods ----------------

    private Hotel findOwnedHotel(Long id) {
        Hotel hotel = hotelRepository.findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!hotel.getOwner().getId().equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return hotel;
    }

    private JwtPrincipal getPrincipal() {
        return securityService.getCurrentPrincipal();
    }

    private User getCurrentUser() {
        return userRepository.findById(getPrincipal().userId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    private HotelResponse mapToResponse(Hotel hotel) {
        return new HotelResponse(
                hotel.getId(),
                hotel.getName(),
                hotel.getAddress(),
                hotel.getDistrict(),
                hotel.getProvince(),
                hotel.getDescription()
        );
    }
}
