package com.hotel.hotel_backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Một lần chiếm dụng phòng vật lý ({@link RoomUnit}) trong khoảng ngày
 * nửa mở {@code [startDate, endDate)} — ngày trả phòng được nhả ngay.
 *
 * <p>Trạng thái hiển thị của phòng cho một ngày D được SUY RA từ các bản ghi
 * phủ ngày D (xem RoomUnitService), không lưu trùng vào {@code room_units.status}.
 */
@Getter
@Setter
@Entity
@Table(name = "room_unit_assignment", indexes = {
        @Index(name = "idx_rua_unit_dates", columnList = "room_unit_id, start_date, end_date"),
        @Index(name = "idx_rua_booking", columnList = "booking_id")
})
public class RoomUnitAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_unit_id", nullable = false)
    private RoomUnit roomUnit;

    /** Null khi type = MAINTENANCE/BLOCK (chiếm dụng do partner, không gắn booking). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private AssignmentType type = AssignmentType.BOOKING;

    /** Ngày bắt đầu chiếm phòng (với booking = check-in). */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** Ngày kết thúc (LOẠI TRỪ — với booking = check-out, đêm cuối là endDate-1). */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "guest_name", length = 200)
    private String guestName;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
