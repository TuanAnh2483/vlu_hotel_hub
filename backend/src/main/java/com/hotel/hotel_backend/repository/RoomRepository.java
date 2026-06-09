package com.hotel.hotel_backend.repository;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {

    // SELECT ... FOR UPDATE: serialises concurrent RoomUnit-creation requests
    // so only one passes the capacity check and inserts at a time.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);
    @EntityGraph(attributePaths = {"amenities", "customAmenities", "imageUrls"})
    List<Room> findByHotelId(Long hotelId);

    List<Room> findByHotelIdAndHotelOwnerId(Long hotelId, Long ownerId);

    Optional<Room> findByIdAndHotelOwnerId(Long roomId, Long ownerId);

    @Query("SELECT r FROM Room r JOIN FETCH r.hotel h WHERE r.id = :roomId AND h.owner.id = :ownerId")
    Optional<Room> findByIdAndHotelOwnerIdWithHotel(@Param("roomId") Long roomId, @Param("ownerId") Long ownerId);

    /** Load room với đầy đủ collections — dùng cho update/image operations */
    @EntityGraph(attributePaths = {"amenities", "customAmenities", "imageUrls"})
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdWithCollections(@Param("id") Long id);

    boolean existsByHotelId(Long hotelId);

    boolean existsByHotelIdAndStatus(Long hotelId, RoomStatus  roomStatus);

    @EntityGraph(attributePaths = {"amenities", "customAmenities", "imageUrls", "hotel"})
    List<Room> findByHotelIdInAndStatus(List<Long> hotelIds, RoomStatus roomStatus);

}
