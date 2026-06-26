package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.Room;

import java.time.LocalDate;

public interface InventoryService {

    /**
     * Khởi tạo tồn kho cho 1 room trong 365 ngày tới
     */
    void generateInventory(Room room);

    void initInventory(Long roomId,
                       LocalDate startDate,
                       LocalDate endDate,
                       int totalRooms);

    boolean checkAvailability(Long roomId,
                              LocalDate checkIn,
                              LocalDate checkOut,
                              int quantity);

    void reserveInventory(Long roomId,
                          LocalDate checkIn,
                          LocalDate checkOut,
                          int quantity);

    void releaseInventory(Long roomId,
                          LocalDate checkIn,
                          LocalDate checkOut,
                          int quantity);

    /**
     * Cap availableRooms xuống newQuantity (1 query UPDATE duy nhất).
     * Dùng khi giảm quantity thay vì gọi generateInventory().
     */
    void capInventory(Long roomId, int newQuantity);

    /**
     * Tăng availableRooms lên 1 cho các ngày từ hôm nay trở đi,
     * không vượt quá maxCapacity (Room.quantity).
     * Dùng khi một RoomUnit ra khỏi trạng thái MAINTENANCE.
     */
    void restoreOneUnit(Long roomId, int maxCapacity);

    /**
     * Tăng availableRooms thêm {@code delta} cho các ngày từ hôm nay trở đi (cap ở
     * {@code maxCapacity} = Room.quantity mới). Dùng khi partner TĂNG quantity để pool
     * bán được nở theo — vì {@link #initInventory} chỉ cap xuống, không nâng lên.
     */
    void raiseInventory(Long roomId, int delta, int maxCapacity);

    /**
     * Cộng dồn {@code delta} vào blockedRooms trên khoảng nửa mở
     * {@code [startInclusive, endExclusive)} (clamp về [0, availableRooms]).
     * Dùng khi khoá/gỡ bảo trì một phòng theo khoảng ngày để khách không
     * đặt vượt số phòng thực còn bán. Best-effort: bỏ qua ngày chưa có tồn kho,
     * không ném lỗi (khác reserveInventory).
     */
    void adjustBlockedRooms(Long roomId, LocalDate startInclusive, LocalDate endExclusive, int delta);
}
