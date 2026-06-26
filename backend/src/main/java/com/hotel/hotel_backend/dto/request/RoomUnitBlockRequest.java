package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.AssignmentType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * Khoá một phòng vật lý (bảo trì / giữ chỗ) trong khoảng ngày INCLUSIVE
 * {@code [startDate, endDate]} — service tự cộng 1 ngày để lưu nửa mở.
 */
public record RoomUnitBlockRequest(
        @NotNull(message = "Ngày bắt đầu là bắt buộc")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate startDate,

        @NotNull(message = "Ngày kết thúc là bắt buộc")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate endDate,

        /** MAINTENANCE (bảo trì) hoặc BLOCK (khoá khác). Mặc định MAINTENANCE. */
        AssignmentType type,

        @Size(max = 500, message = "Ghi chú không được vượt quá 500 ký tự")
        String note
) {}
