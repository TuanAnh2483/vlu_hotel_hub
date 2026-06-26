package com.hotel.hotel_backend.dto.response;

import com.hotel.hotel_backend.entity.AssignmentType;

import java.time.LocalDate;

/**
 * Một lần chiếm dụng phòng vật lý theo khoảng ngày. {@code endDate} là ngày LOẠI TRỪ
 * (đêm cuối = endDate - 1). Dùng cho danh sách phòng đã gán của booking và quản lý bảo trì.
 */
public record RoomUnitAssignmentResponse(
        Long id,
        Long roomUnitId,
        Long roomId,
        String roomName,
        String roomNumber,
        Integer floor,
        Long bookingId,
        AssignmentType type,
        LocalDate startDate,
        LocalDate endDate,
        String guestName,
        String note
) {}
