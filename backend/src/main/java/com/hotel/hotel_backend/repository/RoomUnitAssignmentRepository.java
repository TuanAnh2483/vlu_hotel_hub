package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.RoomUnitAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface RoomUnitAssignmentRepository extends JpaRepository<RoomUnitAssignment, Long> {

    /**
     * Các assignment ĐANG hiệu lực (booking còn active hoặc bảo trì/khoá) chèn lên
     * khoảng nửa mở [startInclusive, endExclusive) của một phòng — dùng để chặn trùng.
     * Bỏ qua assignment của chính booking đang gán (excludeBookingId) để cho phép gán lại.
     */
    @Query("""
            SELECT a FROM RoomUnitAssignment a
            LEFT JOIN a.booking b
            WHERE a.roomUnit.id = :unitId
              AND a.startDate < :endExclusive
              AND a.endDate   > :startInclusive
              AND (:excludeBookingId IS NULL OR a.booking IS NULL OR a.booking.id <> :excludeBookingId)
              AND (a.booking IS NULL OR b.status IN :activeStatuses)
            ORDER BY a.startDate
            """)
    List<RoomUnitAssignment> findOverlapping(
            @Param("unitId") Long unitId,
            @Param("startInclusive") LocalDate startInclusive,
            @Param("endExclusive") LocalDate endExclusive,
            @Param("excludeBookingId") Long excludeBookingId,
            @Param("activeStatuses") Collection<BookingStatus> activeStatuses);

    /**
     * Mọi assignment phủ một ngày D ({@code startDate <= D < endDate}) cho toàn bộ
     * phòng của một cơ sở — dùng dựng trạng thái theo ngày ở trang Phòng.
     * Chỉ tính booking còn active; bảo trì/khoá luôn tính.
     */
    @Query("""
            SELECT a FROM RoomUnitAssignment a
            JOIN a.roomUnit u
            JOIN u.room r
            LEFT JOIN a.booking b
            WHERE r.hotel.id = :hotelId
              AND a.startDate <= :date
              AND a.endDate   >  :date
              AND (a.booking IS NULL OR b.status IN :activeStatuses)
            """)
    List<RoomUnitAssignment> findCoveringDateByHotel(
            @Param("hotelId") Long hotelId,
            @Param("date") LocalDate date,
            @Param("activeStatuses") Collection<BookingStatus> activeStatuses);

    @Query("""
            SELECT a FROM RoomUnitAssignment a
            JOIN FETCH a.roomUnit u
            JOIN FETCH u.room
            WHERE a.booking.id = :bookingId
            ORDER BY u.floor, u.roomNumber
            """)
    List<RoomUnitAssignment> findByBookingId(@Param("bookingId") Long bookingId);

    /**
     * Id của mọi booking ĐÃ được gán ít nhất một phòng vật lý, giới hạn theo partner sở hữu.
     * Dùng để đánh dấu nhanh "đã gán phòng" trên danh sách booking mà không phải gọi từng dòng.
     */
    @Query("""
            SELECT DISTINCT a.booking.id FROM RoomUnitAssignment a
            JOIN a.roomUnit u
            JOIN u.room r
            WHERE a.type = com.hotel.hotel_backend.entity.AssignmentType.BOOKING
              AND a.booking IS NOT NULL
              AND r.hotel.owner.id = :ownerId
            """)
    List<Long> findAssignedBookingIdsByOwner(@Param("ownerId") Long ownerId);

    void deleteByBookingId(Long bookingId);
}
