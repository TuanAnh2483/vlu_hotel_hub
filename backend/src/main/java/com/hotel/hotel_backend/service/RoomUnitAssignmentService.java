package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.RoomUnitBlockRequest;
import com.hotel.hotel_backend.dto.response.RoomUnitAssignmentResponse;
import com.hotel.hotel_backend.entity.AssignmentType;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingItem;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomUnit;
import com.hotel.hotel_backend.entity.RoomUnitAssignment;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitAssignmentRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Gán phòng vật lý vào booking / khoá bảo trì THEO KHOẢNG NGÀY.
 *
 * <p>Quy ước ngày: nửa mở {@code [startDate, endDate)} — ngày check-out được nhả
 * ngay cho khách check-in cùng ngày. Booking lưu thẳng check-in/check-out; block
 * bảo trì nhận ngày inclusive từ partner và service cộng 1 ngày khi lưu.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RoomUnitAssignmentService {

    /** Booking ở các trạng thái này mới thực sự "giữ" phòng. */
    private static final Set<BookingStatus> ACTIVE_STATUSES =
            Set.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);

    private final RoomUnitAssignmentRepository assignmentRepository;
    private final RoomUnitRepository roomUnitRepository;
    private final RoomRepository roomRepository;
    private final BookingRepository bookingRepository;
    private final SecurityService securityService;
    private final InventoryService inventoryService;

    // ── Gán phòng cho booking ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RoomUnitAssignmentResponse> getBookingAssignments(Long bookingId) {
        loadOwnedBooking(bookingId); // chỉ để xác thực quyền sở hữu
        return assignmentRepository.findByBookingId(bookingId).stream()
                .map(this::toResponse)
                .toList();
    }

    /** Id các booking của partner hiện tại đã được gán ít nhất một phòng vật lý. */
    @Transactional(readOnly = true)
    public List<Long> getAssignedBookingIds() {
        long ownerId = securityService.getCurrentPrincipal().userId();
        return assignmentRepository.findAssignedBookingIdsByOwner(ownerId);
    }

    /**
     * Thay thế toàn bộ phòng đã gán của một booking bằng {@code unitIds}.
     * Khoảng ngày lấy thẳng từ booking; chặn nếu phòng đã bận khoảng ngày đó.
     */
    public List<RoomUnitAssignmentResponse> assignBookingUnits(Long bookingId, List<Long> unitIds) {
        Booking booking = loadOwnedBooking(bookingId);

        if (!ACTIVE_STATUSES.contains(booking.getStatus())) {
            throw new ApiException(ErrorCode.CONFLICT,
                    "Chỉ gán phòng cho booking đã xác nhận hoặc đang lưu trú.");
        }

        LocalDate start = booking.getCheckIn();
        LocalDate end = booking.getCheckOut();

        // Số phòng đã đặt theo từng loại phòng + hotelId của booking
        Map<Long, Integer> bookedQtyByRoom = new HashMap<>();
        Long hotelId = null;
        for (BookingItem item : booking.getItems()) {
            bookedQtyByRoom.merge(item.getRoom().getId(), item.getQuantity(), Integer::sum);
            if (hotelId == null) hotelId = item.getRoom().getHotel().getId();
        }

        List<Long> ids = unitIds == null ? List.of() : unitIds.stream().distinct().toList();

        // Nạp + kiểm tra từng phòng
        Map<Long, Integer> selectedQtyByRoom = new HashMap<>();
        List<RoomUnit> units = new ArrayList<>();
        for (Long uid : ids) {
            RoomUnit unit = roomUnitRepository.findById(uid)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng #" + uid));
            Long unitRoomId = unit.getRoom().getId();
            if (!unit.getRoom().getHotel().getId().equals(hotelId)) {
                throw new ApiException(ErrorCode.FORBIDDEN);
            }
            if (!bookedQtyByRoom.containsKey(unitRoomId)) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Phòng " + unitLabel(unit) + " không thuộc loại phòng có trong booking này.");
            }
            selectedQtyByRoom.merge(unitRoomId, 1, Integer::sum);
            units.add(unit);
        }

        // Không được gán nhiều phòng hơn số đã đặt cho mỗi loại
        for (Map.Entry<Long, Integer> e : selectedQtyByRoom.entrySet()) {
            int booked = bookedQtyByRoom.getOrDefault(e.getKey(), 0);
            if (e.getValue() > booked) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Số phòng gán (" + e.getValue() + ") vượt số phòng đã đặt (" + booked + ") cho một loại phòng.");
            }
        }

        // Chặn trùng ngày trên từng phòng (bỏ qua chính booking này)
        for (RoomUnit unit : units) {
            List<RoomUnitAssignment> conflicts = assignmentRepository.findOverlapping(
                    unit.getId(), start, end, bookingId, ACTIVE_STATUSES);
            if (!conflicts.isEmpty()) {
                RoomUnitAssignment c = conflicts.get(0);
                throw new ApiException(ErrorCode.CONFLICT,
                        "Phòng " + unitLabel(unit) + " đã bận từ "
                                + c.getStartDate() + " đến " + c.getEndDate().minusDays(1)
                                + ". Vui lòng chọn phòng khác.");
            }
        }

        // Thay thế: xoá assignment cũ của booking rồi tạo lại
        assignmentRepository.deleteByBookingId(bookingId);
        assignmentRepository.flush();

        String guestName = booking.getContact() != null ? booking.getContact().getName() : null;
        List<RoomUnitAssignment> created = new ArrayList<>();
        for (RoomUnit unit : units) {
            RoomUnitAssignment a = new RoomUnitAssignment();
            a.setRoomUnit(unit);
            a.setBooking(booking);
            a.setType(AssignmentType.BOOKING);
            a.setStartDate(start);
            a.setEndDate(end);
            a.setGuestName(guestName);
            created.add(assignmentRepository.save(a));
        }
        return created.stream().map(this::toResponse).toList();
    }

    /** Giải phóng toàn bộ phòng đã gán của một booking (gọi khi checkout / huỷ). */
    public void releaseBooking(Long bookingId) {
        assignmentRepository.deleteByBookingId(bookingId);
    }

    // ── Khoá bảo trì / block theo khoảng ngày ─────────────────────────────────

    public RoomUnitAssignmentResponse createBlock(Long roomId, Long unitId, RoomUnitBlockRequest request) {
        findOwnedRoom(roomId); // xác thực quyền
        RoomUnit unit = roomUnitRepository.findByIdAndRoomId(unitId, roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy phòng cụ thể"));

        AssignmentType type = request.type() != null ? request.type() : AssignmentType.MAINTENANCE;
        if (type == AssignmentType.BOOKING) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Loại khoá phải là MAINTENANCE hoặc BLOCK.");
        }
        if (request.endDate().isBefore(request.startDate())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
        }

        LocalDate start = request.startDate();
        LocalDate endExclusive = request.endDate().plusDays(1); // inclusive -> nửa mở

        List<RoomUnitAssignment> conflicts = assignmentRepository.findOverlapping(
                unit.getId(), start, endExclusive, null, ACTIVE_STATUSES);
        if (!conflicts.isEmpty()) {
            RoomUnitAssignment c = conflicts.get(0);
            throw new ApiException(ErrorCode.CONFLICT,
                    "Phòng " + unitLabel(unit) + " đã bận từ "
                            + c.getStartDate() + " đến " + c.getEndDate().minusDays(1) + ".");
        }

        RoomUnitAssignment a = new RoomUnitAssignment();
        a.setRoomUnit(unit);
        a.setBooking(null);
        a.setType(type);
        a.setStartDate(start);
        a.setEndDate(endExclusive);
        a.setNote(request.note());
        RoomUnitAssignmentResponse saved = toResponse(assignmentRepository.save(a));

        // Trừ kho bán của loại phòng để khách không đặt vượt số phòng thực còn.
        inventoryService.adjustBlockedRooms(roomId, start, endExclusive, +1);
        return saved;
    }

    public void deleteBlock(Long roomId, Long unitId, Long assignmentId) {
        findOwnedRoom(roomId); // xác thực quyền
        RoomUnitAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy bản ghi khoá phòng"));
        if (!a.getRoomUnit().getId().equals(unitId) || !a.getRoomUnit().getRoom().getId().equals(roomId)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bản ghi không thuộc phòng này.");
        }
        if (a.getType() == AssignmentType.BOOKING) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "Không thể gỡ assignment của booking ở đây — hãy huỷ/checkout booking.");
        }
        LocalDate start = a.getStartDate();
        LocalDate end = a.getEndDate();
        assignmentRepository.delete(a);

        // Hoàn lại kho bán đã trừ khi tạo block.
        inventoryService.adjustBlockedRooms(roomId, start, end, -1);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Booking loadOwnedBooking(Long bookingId) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        return bookingRepository.findPartnerBookingDetailById(ownerId, bookingId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy booking"));
    }

    private Room findOwnedRoom(Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Không tìm thấy loại phòng"));
        Long currentUserId = securityService.getCurrentPrincipal().userId();
        if (!room.getHotel().getOwner().getId().equals(currentUserId)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        return room;
    }

    private String unitLabel(RoomUnit unit) {
        return unit.getRoomNumber() != null && !unit.getRoomNumber().isBlank()
                ? unit.getRoomNumber()
                : "#" + unit.getId();
    }

    private RoomUnitAssignmentResponse toResponse(RoomUnitAssignment a) {
        RoomUnit unit = a.getRoomUnit();
        Room room = unit.getRoom();
        return new RoomUnitAssignmentResponse(
                a.getId(),
                unit.getId(),
                room.getId(),
                room.getName(),
                unit.getRoomNumber(),
                unit.getFloor(),
                a.getBooking() != null ? a.getBooking().getId() : null,
                a.getType(),
                a.getStartDate(),
                a.getEndDate(),
                a.getGuestName(),
                a.getNote()
        );
    }
}
