package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.DailyRate;
import com.hotel.hotel_backend.entity.DailyRateId;
import org.springframework.data.jpa.repository.JpaRepository;


import java.time.LocalDate;

import java.util.List;

public interface DailyRateRepository extends JpaRepository<DailyRate, DailyRateId> {
    List<DailyRate> findByIdRoomIdAndIdDateBetween(Long roomId, LocalDate from, LocalDate to);

    List<DailyRate> findByIdRoomIdInAndIdDateBetween(List<Long> roomIds, LocalDate from, LocalDate to);

}
