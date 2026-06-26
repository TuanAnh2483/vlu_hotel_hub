-- =============================================================================
-- V6__room_unit_assignment.sql
-- Gán phòng vật lý (room_unit) vào booking / bảo trì THEO KHOẢNG NGÀY.
--
-- Trước đây trạng thái phòng chỉ là 1 giá trị cố định trên room_units.status,
-- và việc "gán phòng cho booking" được hack bằng cách ghi notes = 'bk:<id>'.
-- Cách đó không theo ngày: 1 phòng chỉ giữ 1 trạng thái nên không thể vừa phục
-- vụ booking A (1–3/7) vừa booking B (5–8/7).
--
-- Bảng này lưu mỗi lần chiếm phòng dưới dạng khoảng [start_date, end_date)
-- (nửa mở — ngày trả phòng được nhả ngay cho khách check-in cùng ngày). Trạng
-- thái phòng cho một ngày D được SUY RA từ các dòng phủ ngày D, không lưu lặp.
-- =============================================================================

CREATE TABLE room_unit_assignment (
    id            BIGSERIAL    PRIMARY KEY,
    room_unit_id  BIGINT       NOT NULL,
    booking_id    BIGINT,
    type          VARCHAR(20)  NOT NULL DEFAULT 'BOOKING',
    start_date    DATE         NOT NULL,
    end_date      DATE         NOT NULL,
    guest_name    VARCHAR(200),
    note          VARCHAR(500),
    created_at    TIMESTAMPTZ,
    CONSTRAINT fk_rua_room_unit FOREIGN KEY (room_unit_id) REFERENCES room_units (id) ON DELETE CASCADE,
    CONSTRAINT fk_rua_booking   FOREIGN KEY (booking_id)   REFERENCES bookings (id)   ON DELETE CASCADE,
    CONSTRAINT chk_rua_type     CHECK (type IN ('BOOKING', 'MAINTENANCE', 'BLOCK')),
    CONSTRAINT chk_rua_dates    CHECK (end_date > start_date)
);

-- Tra cứu nhanh các assignment phủ một khoảng ngày của 1 phòng (overlap check + view theo ngày)
CREATE INDEX idx_rua_unit_dates ON room_unit_assignment (room_unit_id, start_date, end_date);

-- Lấy toàn bộ assignment của 1 booking (hiển thị/giải phóng khi checkout)
CREATE INDEX idx_rua_booking ON room_unit_assignment (booking_id);
