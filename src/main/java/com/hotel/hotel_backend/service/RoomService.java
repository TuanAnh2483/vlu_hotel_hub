package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.CreateRoomRequest;
import com.hotel.hotel_backend.dto.response.RoomResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomService {

    private final RoomRepository roomRepository;
    private final HotelRepository hotelRepository;
    private final InventoryService inventoryService;
    private final SecurityService securityService;

    public RoomResponse create(Long hotelId, CreateRoomRequest request) {
        // Tạo phòng mới cho khách sạn thuộc sở hữu hiện tại.
        Hotel hotel = findOwnedHotel(hotelId);

        Room room = new Room();
        room.setName(request.name());
        room.setCapacity(request.capacity());
        room.setQuantity(request.quantity());
        room.setPrice(request.price());
        room.setHotel(hotel);
        room.setRoomCategory(request.roomCategory());
        room.setBedType(request.bedType());
        room.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));

        roomRepository.save(room);
        inventoryService.generateInventory(room);

        return mapToResponse(room);
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> getRoomsByHotel(Long hotelId) {
        // Lấy danh sách phòng của khách sạn thuộc sở hữu hiện tại.
        Hotel hotel = findOwnedHotel(hotelId);

        return roomRepository.findByHotelId(hotel.getId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    public RoomResponse update(Long roomId, CreateRoomRequest request) {
        // Cập nhật thông tin phòng thuộc sở hữu hiện tại.
        Room room = findOwnedRoom(roomId);

        room.setName(request.name());
        room.setCapacity(request.capacity());
        room.setQuantity(request.quantity());
        room.setPrice(request.price());
        room.setRoomCategory(request.roomCategory());
        room.setBedType(request.bedType());
        room.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));

        return mapToResponse(room);
    }

    public void delete(Long roomId) {
        // Xóa phòng thuộc sở hữu hiện tại.
        Room room = findOwnedRoom(roomId);
        roomRepository.delete(room);
    }

    // ---------------- Helper methods ----------------

    private Hotel findOwnedHotel(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!hotel.getOwner().getId().equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return hotel;
    }

    private Room findOwnedRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!room.getHotel().getOwner().getId()
                .equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return room;
    }

    private JwtPrincipal getPrincipal() {
        return securityService.getCurrentPrincipal();
    }

    private RoomResponse mapToResponse(Room room) {
        return new RoomResponse(
                room.getId(),
                room.getName(),
                room.getCapacity(),
                room.getQuantity(),
                room.getPrice(),
                room.getHotel().getId(),
                room.getRoomCategory(),
                room.getBedType(),
                room.getAmenities()
        );
    }
}
