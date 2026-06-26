package com.hotel.hotel_backend.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Gán danh sách phòng vật lý cho một booking. Khoảng ngày KHÔNG nhận từ client —
 * backend lấy thẳng check-in/check-out của booking để không bao giờ gán lệch ngày.
 * Danh sách thay thế toàn bộ assignment hiện có của booking (rỗng = gỡ hết).
 */
public record AssignRoomUnitsRequest(
        @NotNull(message = "Danh sách phòng là bắt buộc")
        List<Long> unitIds
) {}
