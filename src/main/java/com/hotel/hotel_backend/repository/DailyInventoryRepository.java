package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyInventoryId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DailyInventoryRepository
        extends JpaRepository<DailyInventory, DailyInventoryId> {

    List<DailyInventory> findByIdRoomIdAndIdDateBetween(
            Long roomId,
            LocalDate start,
            LocalDate end
    );

    List<DailyInventory> findByIdRoomIdInAndIdDateBetween(
            List<Long> roomIds,
            LocalDate start,
            LocalDate end
    );
}

