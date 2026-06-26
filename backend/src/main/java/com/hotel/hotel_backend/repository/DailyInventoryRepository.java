package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyInventoryId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    // Bulk delete để bỏ qua optimistic locking (@Version). Derived delete sẽ load entity rồi
    // remove từng cái kèm "where version=?", dễ dính StaleObjectStateException khi job/booking
    // chỉnh inventory đồng thời lúc xóa hotel. Phải xóa trước Room (FK, no cascade).
    @Modifying
    @Query("DELETE FROM DailyInventory di WHERE di.id.roomId = :roomId")
    void deleteByIdRoomId(@Param("roomId") Long roomId);

    @Modifying
    @Query("DELETE FROM DailyInventory di WHERE di.id.roomId IN :roomIds")
    void deleteByIdRoomIdIn(@Param("roomIds") List<Long> roomIds);

    // TASK-1: Find stale rows where availableRooms drifted above Room.quantity.
    // Pageable keeps batch size bounded so the repair runner never OOMs on large datasets.
    @Query("SELECT di FROM DailyInventory di WHERE di.availableRooms > di.room.quantity")
    List<DailyInventory> findStaleRows(Pageable pageable);

    @Query("SELECT COUNT(di) FROM DailyInventory di WHERE di.availableRooms > di.room.quantity")
    long countStaleRows();

    /**
     * Cap availableRooms xuống newQuantity cho tất cả ngày từ hôm nay trở đi
     * mà availableRooms đang vượt quá newQuantity.
     * Dùng GREATEST(blocked_rooms, :newQty) để không vi phạm invariant blocked <= available.
     */
    @Modifying
    @Query("UPDATE DailyInventory di SET di.availableRooms = " +
           "CASE WHEN di.blockedRooms > :newQty THEN di.blockedRooms ELSE :newQty END " +
           "WHERE di.id.roomId = :roomId AND di.id.date >= :fromDate " +
           "AND di.availableRooms > :newQty")
    int capAvailableRooms(@Param("roomId") Long roomId,
                          @Param("fromDate") LocalDate fromDate,
                          @Param("newQty") int newQty);

    /**
     * Tăng availableRooms lên 1 cho tất cả ngày từ fromDate trở đi,
     * nhưng không vượt quá max (Room.quantity).
     * Dùng khi một phòng ra khỏi MAINTENANCE → trả lại 1 slot khả dụng.
     */
    @Modifying
    @Query("UPDATE DailyInventory di SET di.availableRooms = " +
           "CASE WHEN di.availableRooms + 1 > :max THEN :max ELSE di.availableRooms + 1 END " +
           "WHERE di.id.roomId = :roomId AND di.id.date >= :fromDate " +
           "AND di.availableRooms < :max")
    int incrementAvailableRoomsUpTo(@Param("roomId") Long roomId,
                                    @Param("fromDate") LocalDate fromDate,
                                    @Param("max") int max);

    /**
     * Tăng availableRooms thêm {@code delta} cho mọi ngày từ fromDate trở đi,
     * nhưng không vượt quá max (Room.quantity mới). Dùng khi partner TĂNG quantity
     * để pool bán được nở theo — vá đúng lỗ hổng "initInventory chỉ cap xuống".
     */
    @Modifying
    @Query("UPDATE DailyInventory di SET di.availableRooms = " +
           "CASE WHEN di.availableRooms + :delta > :max THEN :max ELSE di.availableRooms + :delta END " +
           "WHERE di.id.roomId = :roomId AND di.id.date >= :fromDate " +
           "AND di.availableRooms < :max")
    int raiseAvailableRoomsBy(@Param("roomId") Long roomId,
                              @Param("fromDate") LocalDate fromDate,
                              @Param("delta") int delta,
                              @Param("max") int max);
}

