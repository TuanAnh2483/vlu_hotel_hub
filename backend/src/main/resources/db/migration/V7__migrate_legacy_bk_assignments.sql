-- =============================================================================
-- V7__migrate_legacy_bk_assignments.sql
-- Chuyển dữ liệu gán phòng kiểu CŨ (hack notes = 'bk:<bookingId>' trên room_units)
-- sang bảng room_unit_assignment theo khoảng ngày của booking.
--
-- Trước khi có V6, frontend gán phòng bằng cách ghi notes='bk:<id>' + đổi status
-- phòng sang RESERVED/OCCUPIED. Migration này:
--   1) Tạo assignment BOOKING cho mỗi phòng còn nhãn bk:, dùng check_in/check_out
--      của booking (chỉ với booking còn CONFIRMED/CHECKED_IN).
--   2) Reset trạng thái thủ công cũ trên các phòng đã gắn nhãn bk: về AVAILABLE,
--      xoá nhãn — vì trạng thái nay được SUY RA từ assignment.
-- An toàn khi không có dữ liệu cũ (no-op).
-- =============================================================================

INSERT INTO room_unit_assignment (room_unit_id, booking_id, type, start_date, end_date, guest_name, created_at)
SELECT ru.id,
       b.id,
       'BOOKING',
       b.check_in,
       b.check_out,
       ru.guest_name,
       now()
FROM room_units ru
JOIN bookings b
  ON b.id = CAST(substring(ru.notes FROM '^bk:([0-9]+)') AS BIGINT)
WHERE ru.notes ~ '^bk:[0-9]+'
  AND ru.status IN ('RESERVED', 'OCCUPIED')
  AND b.status  IN ('CONFIRMED', 'CHECKED_IN');

UPDATE room_units
SET status = 'AVAILABLE',
    notes = NULL,
    guest_name = NULL
WHERE notes ~ '^bk:[0-9]+'
  AND status IN ('RESERVED', 'OCCUPIED');
