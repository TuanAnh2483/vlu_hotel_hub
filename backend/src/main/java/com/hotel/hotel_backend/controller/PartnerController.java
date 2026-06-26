package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.dto.request.AssignRoomUnitsRequest;
import com.hotel.hotel_backend.dto.request.CreateRoomRequest;
import com.hotel.hotel_backend.dto.request.CreateRoomUnitRequest;
import com.hotel.hotel_backend.dto.request.CreateHotelRequest;
import com.hotel.hotel_backend.dto.request.RoomUnitBlockRequest;
import com.hotel.hotel_backend.dto.request.PartnerAnalyticsSummaryRequest;
import com.hotel.hotel_backend.dto.request.PartnerBookingRefundRequest;
import com.hotel.hotel_backend.dto.request.PartnerBookingSearchRequest;
import com.hotel.hotel_backend.dto.request.PartnerReviewReplyRequest;
import com.hotel.hotel_backend.dto.request.PartnerReviewSearchRequest;
import com.hotel.hotel_backend.dto.request.PartnerRoomCalendarUpsertRequest;
import com.hotel.hotel_backend.dto.request.SetBasePricingRequest;
import com.hotel.hotel_backend.dto.request.SetCoverImageRequest;
import com.hotel.hotel_backend.dto.request.UpdateHotelRequest;
import com.hotel.hotel_backend.dto.request.UpdateRoomUnitRequest;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.HotelResponse;
import com.hotel.hotel_backend.dto.response.HotelReviewResponse;
import com.hotel.hotel_backend.dto.response.PartnerAnalyticsSummaryResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingDetailResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingPageResponse;
import com.hotel.hotel_backend.dto.response.PartnerMonthlyStatsResponse;
import com.hotel.hotel_backend.dto.response.PartnerRoomCalendarResponse;
import com.hotel.hotel_backend.dto.response.RefundRequestResponse;
import com.hotel.hotel_backend.dto.response.HotelRoomUnitResponse;
import com.hotel.hotel_backend.dto.response.RoomResponse;
import com.hotel.hotel_backend.dto.response.RoomUnitAssignmentResponse;
import com.hotel.hotel_backend.dto.response.RoomUnitResponse;
import com.hotel.hotel_backend.entity.RefundRequestStatus;
import com.hotel.hotel_backend.service.HotelService;
import com.hotel.hotel_backend.service.HotelReviewService;
import com.hotel.hotel_backend.service.ImageStorageRouterService;
import com.hotel.hotel_backend.service.PartnerBookingService;
import com.hotel.hotel_backend.service.PartnerImageUploadService;
import com.hotel.hotel_backend.service.PartnerRoomCalendarService;
import com.hotel.hotel_backend.service.RefundRequestService;
import com.hotel.hotel_backend.service.RoomService;
import com.hotel.hotel_backend.service.RoomUnitAssignmentService;
import com.hotel.hotel_backend.service.RoomUnitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;

@Tag(name = "Partner", description = "Manage hotels, rooms, calendar, bookings, reviews, revenue analytics")
@RestController
@RequestMapping({"/api/v1/partner", "/api/partner"})
@RequiredArgsConstructor
public class PartnerController {

    private final HotelService hotelService;
    private final RoomService roomService;
    private final RoomUnitService roomUnitService;
    private final RoomUnitAssignmentService roomUnitAssignmentService;
    private final PartnerBookingService partnerBookingService;
    private final PartnerRoomCalendarService partnerRoomCalendarService;
    private final HotelReviewService hotelReviewService;
    private final PartnerImageUploadService partnerImageUploadService;
    private final RefundRequestService refundRequestService;
    private final ImageStorageRouterService imageStorageRouterService;

    @GetMapping("/hotels")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<HotelResponse>> getMyHotels() {
        return ApiResponse.ok(hotelService.getMyHotels());
    }

    @GetMapping("/bookings")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingPageResponse> getMyBookings(@Valid @ModelAttribute PartnerBookingSearchRequest request) {
        return ApiResponse.ok(partnerBookingService.getPartnerBookings(request));
    }

    @GetMapping("/refunds")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RefundRequestResponse>> getMyRefundRequests(
            @RequestParam(required = false) Long hotelId,
            @RequestParam(required = false) RefundRequestStatus status
    ) {
        return ApiResponse.ok(refundRequestService.getPartnerRefundRequests(hotelId, status));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner muon xem cac review cua hotel minh
     * dang van hanh va loc theo rating/hasReply thi vao dau?
     */
    @GetMapping("/reviews")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<HotelReviewResponse>> getMyReviews(
            @Valid @ModelAttribute PartnerReviewSearchRequest request
    ) {
        return ApiResponse.ok(hotelReviewService.getPartnerReviews(request));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner muon nhin nhanh tong booking va
     * doanh thu theo bo loc hotel/check-in hien tai thi doc o dau?
     */
    @GetMapping("/analytics/summary")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerAnalyticsSummaryResponse> getAnalyticsSummary(
            @Valid @ModelAttribute PartnerAnalyticsSummaryRequest request
    ) {
        return ApiResponse.ok(partnerBookingService.getPartnerAnalytics(request));
    }

    /**
     * Thống kê doanh thu/booking theo từng tháng của một năm. Aggregate sẵn ở server để
     * tab Thống kê không phải kéo toàn bộ booking cả năm về client.
     */
    @GetMapping("/analytics/monthly")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerMonthlyStatsResponse> getMonthlyStats(
            @RequestParam(required = false) Long hotelId,
            @RequestParam int year
    ) {
        return ApiResponse.ok(partnerBookingService.getPartnerMonthlyStats(hotelId, year));
    }

    @GetMapping("/bookings/{bookingId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingDetailResponse> getMyBooking(@PathVariable Long bookingId) {
        return ApiResponse.ok(partnerBookingService.getPartnerBooking(bookingId));
    }

    @PostMapping("/bookings/{bookingId}/checkin")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingDetailResponse> checkinBooking(@PathVariable Long bookingId) {
        return ApiResponse.ok(partnerBookingService.checkinPartnerBooking(bookingId));
    }

    /**
     * Endpoint nay giai quyet cau hoi: khi stay da ket thuc, partner chot booking
     * sang COMPLETED o dau de lifecycle khop nghiep vu?
     */
    @PostMapping("/bookings/{bookingId}/complete")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingDetailResponse> completeBooking(@PathVariable Long bookingId) {
        return ApiResponse.ok(partnerBookingService.completePartnerBooking(bookingId));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner muon xu ly mock refund cho booking
     * da thanh toan va can idempotency thi goi API nao?
     */
    @PostMapping("/bookings/{bookingId}/refund")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingDetailResponse> refundBooking(
            @PathVariable Long bookingId,
            @Valid @RequestBody PartnerBookingRefundRequest request
    ) {
        return ApiResponse.ok(partnerBookingService.refundPartnerBooking(bookingId, request));
    }

    @PostMapping("/refunds/{refundRequestId}/approve")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RefundRequestResponse> approveRefundRequest(
            @PathVariable Long refundRequestId,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String transferNote = body != null ? body.get("transferNote") : null;
        return ApiResponse.ok(refundRequestService.approvePartnerRefundRequest(refundRequestId, transferNote));
    }

    @PostMapping("/refunds/{refundRequestId}/reject")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RefundRequestResponse> rejectRefundRequest(@PathVariable Long refundRequestId) {
        return ApiResponse.ok(refundRequestService.rejectPartnerRefundRequest(refundRequestId));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner muon tra loi review cua khach tren
     * hotel so huu thi goi API nao?
     */
    @PutMapping("/reviews/{reviewId}/reply")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelReviewResponse> replyToReview(
            @PathVariable Long reviewId,
            @Valid @RequestBody PartnerReviewReplyRequest request
    ) {
        return ApiResponse.ok(hotelReviewService.replyToReview(reviewId, request));
    }

    @PostMapping("/hotels")
    @PreAuthorize("hasRole('PARTNER')")
    public ResponseEntity<ApiResponse<HotelResponse>> createHotel(
            @Valid @RequestBody CreateHotelRequest request) {
        HotelResponse hotel = hotelService.create(request);
        URI location = URI.create("/api/v1/partner/hotels/" + hotel.id());
        return ResponseEntity.created(location).body(ApiResponse.ok(hotel));
    }

    @PutMapping("/hotels/{id}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> updateHotel(
            @PathVariable Long id,
            @Valid @RequestBody UpdateHotelRequest request) {
        return ApiResponse.ok(hotelService.update(id, request));
    }

    @DeleteMapping("/hotels/{id}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteHotel(@PathVariable Long id) {
        hotelService.delete(id);
        return ApiResponse.ok(null);
    }

    /**
     * Sets a base price (and optional minStay) across all rooms of a hotel
     * for a 1-year window from today. Designed for use by the AddPropertyWizard
     * final step so partners don't need to call upsertCalendar per room.
     */
    @PutMapping("/hotels/{id}/base-pricing")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> setHotelBasePricing(
            @PathVariable Long id,
            @Valid @RequestBody SetBasePricingRequest request
    ) {
        partnerRoomCalendarService.setHotelBasePricing(id, request.basePrice(), request.minStay());
        return ApiResponse.ok(null);
    }

    /**
     * Partner uploads real image files and the backend appends generated public URLs to the hotel gallery.
     */
    @PostMapping(value = "/hotels/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> uploadHotelImages(
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files
    ) {
        return ApiResponse.ok(partnerImageUploadService.uploadHotelImages(id, files));
    }

    @DeleteMapping("/hotels/{id}/images")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> deleteHotelImage(
            @PathVariable Long id,
            @RequestParam("imageUrl") String imageUrl
    ) {
        return ApiResponse.ok(partnerImageUploadService.deleteHotelImage(id, imageUrl));
    }

    @PutMapping("/hotels/{id}/cover-image")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> setHotelCoverImage(
            @PathVariable Long id,
            @Valid @RequestBody SetCoverImageRequest request
    ) {
        return ApiResponse.ok(partnerImageUploadService.setHotelCoverImage(id, request.imageUrl()));
    }

    @PostMapping("/hotels/{hotelId}/rooms")
    @PreAuthorize("hasRole('PARTNER')")
    public ResponseEntity<ApiResponse<RoomResponse>> createRoom(
            @PathVariable Long hotelId,
            @Valid @RequestBody CreateRoomRequest request) {
        RoomResponse room = roomService.create(hotelId, request);
        URI location = URI.create("/api/v1/partner/hotels/" + hotelId + "/rooms/" + room.id());
        return ResponseEntity.created(location).body(ApiResponse.ok(room));
    }

    @GetMapping("/hotels/{hotelId}/rooms")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RoomResponse>> getRooms(
            @PathVariable Long hotelId) {
        return ApiResponse.ok(roomService.getRoomsByHotel(hotelId));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner dang ban gia va ton kho thuc te cua
     * mot room theo tung ngay ra sao trong mot range?
     */
    @GetMapping("/rooms/{roomId}/calendar")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerRoomCalendarResponse> getRoomCalendar(
            @PathVariable Long roomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ApiResponse.ok(partnerRoomCalendarService.getCalendar(roomId, from, to));
    }

    /**
     * Endpoint nay giai quyet cau hoi: partner muon patch mot block ngay de sua
     * price, minStay, closed, availableRooms ma khong phai gui tung row thi lam sao?
     */
    @PutMapping("/rooms/{roomId}/calendar")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerRoomCalendarResponse> upsertRoomCalendar(
            @PathVariable Long roomId,
            @Valid @RequestBody PartnerRoomCalendarUpsertRequest request
    ) {
        return ApiResponse.ok(partnerRoomCalendarService.upsertCalendar(roomId, request));
    }

    @PutMapping("/rooms/{roomId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> updateRoom(
            @PathVariable Long roomId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.ok(roomService.update(roomId, request));
    }

    @DeleteMapping("/rooms/{roomId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteRoom(@PathVariable Long roomId) {
        roomService.delete(roomId);
        return ApiResponse.ok(null);
    }

    /**
     * Partner uploads real image files and the backend appends generated public URLs to the room gallery.
     */
    @PostMapping(value = "/rooms/{roomId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> uploadRoomImages(
            @PathVariable Long roomId,
            @RequestParam("files") List<MultipartFile> files
    ) {
        return ApiResponse.ok(partnerImageUploadService.uploadRoomImages(roomId, files));
    }

    @DeleteMapping("/rooms/{roomId}/images")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> deleteRoomImage(
            @PathVariable Long roomId,
            @RequestParam("imageUrl") String imageUrl
    ) {
        return ApiResponse.ok(partnerImageUploadService.deleteRoomImage(roomId, imageUrl));
    }

    @PutMapping("/rooms/{roomId}/cover-image")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> setRoomCoverImage(
            @PathVariable Long roomId,
            @Valid @RequestBody SetCoverImageRequest request
    ) {
        return ApiResponse.ok(partnerImageUploadService.setRoomCoverImage(roomId, request.imageUrl()));
    }

    // ── Room Units ─────────────────────────────────────────────────────────

    /**
     * Danh sách phòng vật lý của cơ sở kèm trạng thái suy ra cho NGÀY chỉ định
     * (mặc định hôm nay nếu không truyền {@code date}). Trống/đặt trước/có khách
     * tính từ các booking đang giữ phòng vào ngày đó; bảo trì/khoá theo khoảng ngày.
     */
    @GetMapping("/hotels/{hotelId}/room-units")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<HotelRoomUnitResponse>> getHotelRoomUnits(
            @PathVariable Long hotelId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ApiResponse.ok(roomUnitService.getUnitsByHotel(hotelId, date));
    }

    // ── Gán phòng vật lý cho booking (theo khoảng ngày của booking) ──────────

    @GetMapping("/bookings/{bookingId}/room-units")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RoomUnitAssignmentResponse>> getBookingRoomUnits(@PathVariable Long bookingId) {
        return ApiResponse.ok(roomUnitAssignmentService.getBookingAssignments(bookingId));
    }

    /** Id các booking đã gán phòng vật lý — để danh sách booking đánh dấu nhanh "đã gán". */
    @GetMapping("/bookings/assigned-room-units")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<Long>> getAssignedBookingIds() {
        return ApiResponse.ok(roomUnitAssignmentService.getAssignedBookingIds());
    }

    @PutMapping("/bookings/{bookingId}/room-units")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RoomUnitAssignmentResponse>> assignBookingRoomUnits(
            @PathVariable Long bookingId,
            @Valid @RequestBody AssignRoomUnitsRequest request
    ) {
        return ApiResponse.ok(roomUnitAssignmentService.assignBookingUnits(bookingId, request.unitIds()));
    }

    // ── Khoá phòng theo khoảng ngày (bảo trì / block) ────────────────────────

    @PostMapping("/rooms/{roomId}/units/{unitId}/blocks")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomUnitAssignmentResponse> createRoomUnitBlock(
            @PathVariable Long roomId,
            @PathVariable Long unitId,
            @Valid @RequestBody RoomUnitBlockRequest request
    ) {
        return ApiResponse.ok(roomUnitAssignmentService.createBlock(roomId, unitId, request));
    }

    @DeleteMapping("/rooms/{roomId}/units/{unitId}/blocks/{assignmentId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteRoomUnitBlock(
            @PathVariable Long roomId,
            @PathVariable Long unitId,
            @PathVariable Long assignmentId
    ) {
        roomUnitAssignmentService.deleteBlock(roomId, unitId, assignmentId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/rooms/{roomId}/units")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RoomUnitResponse>> getRoomUnits(@PathVariable Long roomId) {
        return ApiResponse.ok(roomUnitService.getUnits(roomId));
    }

    @PostMapping("/rooms/{roomId}/units")
    @PreAuthorize("hasRole('PARTNER')")
    public ResponseEntity<ApiResponse<RoomUnitResponse>> createRoomUnit(
            @PathVariable Long roomId,
            @Valid @RequestBody CreateRoomUnitRequest request
    ) {
        RoomUnitResponse unit = roomUnitService.create(roomId, request);
        URI location = URI.create("/api/v1/partner/rooms/" + roomId + "/units/" + unit.id());
        return ResponseEntity.created(location).body(ApiResponse.ok(unit));
    }

    @PutMapping("/rooms/{roomId}/units/{unitId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomUnitResponse> updateRoomUnit(
            @PathVariable Long roomId,
            @PathVariable Long unitId,
            @Valid @RequestBody UpdateRoomUnitRequest request
    ) {
        return ApiResponse.ok(roomUnitService.update(roomId, unitId, request));
    }

    @DeleteMapping("/rooms/{roomId}/units/{unitId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteRoomUnit(
            @PathVariable Long roomId,
            @PathVariable Long unitId
    ) {
        roomUnitService.delete(roomId, unitId);
        return ApiResponse.ok(null);
    }

    @PostMapping(value = "/rooms/{roomId}/units/{unitId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomUnitResponse> uploadRoomUnitImage(
            @PathVariable Long roomId,
            @PathVariable Long unitId,
            @RequestParam("file") MultipartFile file
    ) {
        List<String> urls = imageStorageRouterService.storeRoomImages(roomId, List.of(file));
        return ApiResponse.ok(roomUnitService.setCoverImage(roomId, unitId, urls.get(0)));
    }
}
