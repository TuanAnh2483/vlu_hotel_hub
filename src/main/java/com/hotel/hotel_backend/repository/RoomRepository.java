package com.hotel.hotel_backend.repository;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;

public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByHotelId(Long hotelId);

    boolean existsByHotelId(Long hotelId);

    boolean existsByHotelIdAndStatus(Long hotelId, RoomStatus  roomStatus);

    @EntityGraph(attributePaths = "amenities")
    List<Room>findByHotelIdInAndStatus(List<Long> hotelIds, RoomStatus  roomStatus);

    List<Room> status(RoomStatus status);

    List<Long> hotelId(Long hotelId);
}
