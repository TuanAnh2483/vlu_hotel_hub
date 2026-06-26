package com.hotel.hotel_backend.entity;

/**
 * Loại chiếm dụng một phòng vật lý trong một khoảng ngày.
 * <ul>
 *   <li>{@code BOOKING} — gán phòng cho một booking (có {@code booking_id}).</li>
 *   <li>{@code MAINTENANCE} — phòng bảo trì trong khoảng ngày (không có booking).</li>
 *   <li>{@code BLOCK} — partner khoá phòng vì lý do khác (giữ chỗ, sự cố...).</li>
 * </ul>
 */
public enum AssignmentType {
    BOOKING,
    MAINTENANCE,
    BLOCK
}
