package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.DailyRate;
import com.hotel.hotel_backend.entity.DailyRateId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface DailyRateRepository extends JpaRepository<DailyRate, DailyRateId> {

    List<DailyRate> findByIdRoomIdAndIdDateBetween(Long roomId, LocalDate from, LocalDate to);

    List<DailyRate> findByIdRoomIdInAndIdDateBetween(List<Long> roomIds, LocalDate from, LocalDate to);

    // Must delete DailyRate rows for a room before deleting the Room entity (no cascade on FK).
    @Modifying
    @Query("DELETE FROM DailyRate dr WHERE dr.id.roomId = :roomId")
    void deleteByIdRoomId(@Param("roomId") Long roomId);

    @Modifying
    @Query("DELETE FROM DailyRate dr WHERE dr.id.roomId IN :roomIds")
    void deleteByIdRoomIdIn(@Param("roomIds") List<Long> roomIds);

    boolean existsByIdRoomIdAndIsClosed(Long roomId, boolean isClosed);

    @Query("""
            SELECT CASE WHEN COUNT(dr) > 0 THEN true ELSE false END
            FROM DailyRate dr
            WHERE dr.id.roomId = :roomId
              AND dr.id.date >= :from
              AND dr.id.date <= :to
              AND dr.isClosed = true
            """)
    boolean existsClosedDateInRange(
            @Param("roomId") Long roomId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
