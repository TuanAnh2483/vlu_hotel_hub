package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.dto.request.AdminCreateUserRequest;
import com.hotel.hotel_backend.dto.request.AdminRejectPartnerRequest;
import com.hotel.hotel_backend.dto.request.AdminUpdateHotelRequest;
import com.hotel.hotel_backend.dto.response.AdminPartnerApplicationResponse;
import com.hotel.hotel_backend.dto.response.AdminBookingResponse;
import com.hotel.hotel_backend.dto.response.AdminHotelResponse;
import com.hotel.hotel_backend.dto.response.AdminRoomResponse;
import com.hotel.hotel_backend.dto.response.AdminReviewResponse;
import com.hotel.hotel_backend.dto.response.AdminStatsResponse;
import com.hotel.hotel_backend.dto.response.AdminSystemDataResponse;
import com.hotel.hotel_backend.dto.response.AdminUserResponse;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.GeocodeBackfillResponse;
import com.hotel.hotel_backend.dto.response.PartnerApplicationResponse;
import com.hotel.hotel_backend.dto.response.RefundRequestResponse;
import com.hotel.hotel_backend.entity.PartnerApplication;
import com.hotel.hotel_backend.entity.PartnerApplicationStatus;
import com.hotel.hotel_backend.entity.RefundRequestStatus;
import com.hotel.hotel_backend.security.JwtPrincipal;
import com.hotel.hotel_backend.service.AdminAuditLogService;
import com.hotel.hotel_backend.service.AdminOperationsService;
import com.hotel.hotel_backend.service.AdminPartnerService;
import com.hotel.hotel_backend.service.RefundRequestService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.hotel.hotel_backend.dto.response.ApiResponse.ok;

@Tag(name = "Admin", description = "System statistics, user/partner/hotel management, review moderation, refunds")
@RestController
@RequestMapping({"/api/v1/admin", "/api/admin"})
@RequiredArgsConstructor
public class AdminController {

    private final AdminPartnerService adminPartnerService;
    private final AdminOperationsService adminOperationsService;
    private final RefundRequestService refundRequestService;
    private final AdminAuditLogService auditLogService;

    // ── Read-only endpoints (không cần audit log) ─────────────────────────────

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminStatsResponse> getStats() {
        return ok(adminOperationsService.getStats());
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminUserResponse>> getUsers() {
        return ok(adminOperationsService.getUsers());
    }

    @GetMapping("/hotels")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminHotelResponse>> getHotels() {
        return ok(adminOperationsService.getHotels());
    }

    @GetMapping("/hotels/{hotelId}/rooms")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminRoomResponse>> getHotelRooms(@PathVariable Long hotelId) {
        return ok(adminOperationsService.getHotelRooms(hotelId));
    }

    @PostMapping("/hotels/geocode-missing")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<GeocodeBackfillResponse> geocodeMissingHotels() {
        return ok(adminOperationsService.backfillMissingCoordinates());
    }


    @GetMapping("/bookings")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminBookingResponse>> getBookings() {
        return ok(adminOperationsService.getBookings());
    }

    @GetMapping("/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminReviewResponse>> getReviews() {
        return ok(adminOperationsService.getReviews());
    }

    @GetMapping("/refunds")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<RefundRequestResponse>> getRefundRequests(
            @RequestParam(required = false) RefundRequestStatus status
    ) {
        return ok(refundRequestService.getAdminRefundRequests(status));
    }

    @GetMapping("/system")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminSystemDataResponse> getSystemData() {
        return ok(adminOperationsService.getSystemData());
    }

    @GetMapping("/partner-applications")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<AdminPartnerApplicationResponse>> getPartnerApplications(
            @RequestParam(required = false) PartnerApplicationStatus status
    ) {
        return ok(adminPartnerService.getApplications(status)
                .stream()
                .map(this::toAdminPartnerApplicationResponse)
                .toList());
    }

    // ── Mutation endpoints — ghi audit log sau mỗi hành động ─────────────────

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminUserResponse> createUser(
            @Valid @RequestBody AdminCreateUserRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        AdminUserResponse result = adminOperationsService.createUser(request);
        auditLogService.log(principal.userId(), "CREATE_USER",
                "USER", result.id(), "email=" + request.email(), resolveIp(httpRequest));
        return ok(result);
    }

    @PostMapping("/users/{userId}/toggle-status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminUserResponse> toggleUserStatus(
            @PathVariable Long userId,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        AdminUserResponse result = adminOperationsService.toggleUserStatus(userId);
        auditLogService.log(principal.userId(), "TOGGLE_USER_STATUS",
                "USER", userId, "newStatus=" + result.status(), resolveIp(httpRequest));
        return ok(result);
    }

    @PutMapping("/hotels/{hotelId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminHotelResponse> updateHotel(
            @PathVariable Long hotelId,
            @Valid @RequestBody AdminUpdateHotelRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        AdminHotelResponse result = adminOperationsService.updateHotel(hotelId, request);
        auditLogService.log(principal.userId(), "UPDATE_HOTEL",
                "HOTEL", hotelId, "hotelType=" + request.hotelType(), resolveIp(httpRequest));
        return ok(result);
    }

    @DeleteMapping("/hotels/{hotelId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteHotel(
            @PathVariable Long hotelId,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        adminOperationsService.deleteHotel(hotelId);
        auditLogService.log(principal.userId(), "DELETE_HOTEL",
                "HOTEL", hotelId, null, resolveIp(httpRequest));
        return ok(null);
    }

    @DeleteMapping("/reviews/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteReview(
            @PathVariable Long reviewId,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        adminOperationsService.deleteReview(reviewId);
        auditLogService.log(principal.userId(), "DELETE_REVIEW",
                "REVIEW", reviewId, null, resolveIp(httpRequest));
        return ok(null);
    }

    @PostMapping("/refunds/{refundRequestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RefundRequestResponse> approveRefundRequest(
            @PathVariable Long refundRequestId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        String transferNote = body != null ? body.get("transferNote") : null;
        RefundRequestResponse result = refundRequestService.approveAdminRefundRequest(refundRequestId, transferNote);
        auditLogService.log(principal.userId(), "APPROVE_REFUND",
                "REFUND", refundRequestId, null, resolveIp(httpRequest));
        return ok(result);
    }

    @PostMapping("/refunds/{refundRequestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RefundRequestResponse> rejectRefundRequest(
            @PathVariable Long refundRequestId,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        RefundRequestResponse result = refundRequestService.rejectAdminRefundRequest(refundRequestId);
        auditLogService.log(principal.userId(), "REJECT_REFUND",
                "REFUND", refundRequestId, null, resolveIp(httpRequest));
        return ok(result);
    }

    @PostMapping("/partner-applications/{applicationId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PartnerApplicationResponse> approvePartnerApplication(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        PartnerApplicationResponse result =
                toPartnerApplicationResponse(adminPartnerService.approveApplication(applicationId));
        auditLogService.log(principal.userId(), "APPROVE_PARTNER",
                "PARTNER_APPLICATION", applicationId, null, resolveIp(httpRequest));
        return ok(result);
    }

    @PostMapping("/partner-applications/{applicationId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PartnerApplicationResponse> rejectPartnerApplication(
            @PathVariable Long applicationId,
            @Valid @RequestBody AdminRejectPartnerRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        PartnerApplicationResponse result =
                toPartnerApplicationResponse(adminPartnerService.rejectApplication(applicationId, request.reason()));
        auditLogService.log(principal.userId(), "REJECT_PARTNER",
                "PARTNER_APPLICATION", applicationId, "reason=" + request.reason(), resolveIp(httpRequest));
        return ok(result);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Lấy IP thực của client, ưu tiên X-Forwarded-For khi đứng sau reverse proxy */
    private String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private PartnerApplicationResponse toPartnerApplicationResponse(PartnerApplication application) {
        return new PartnerApplicationResponse(
                application.getId(),
                application.getStatus().name(),
                application.getBusinessName()
        );
    }

    private AdminPartnerApplicationResponse toAdminPartnerApplicationResponse(PartnerApplication application) {
        return new AdminPartnerApplicationResponse(
                application.getId(),
                application.getUser().getId(),
                application.getEmail(),
                application.getPhoneNumber(),
                application.getBusinessName(),
                application.getStatus().name(),
                application.getTaxCode(),
                application.getPropertyType() != null ? application.getPropertyType().name() : null
        );
    }
}
