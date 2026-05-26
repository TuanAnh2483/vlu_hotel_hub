package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.CreateRefundRequest;
import com.hotel.hotel_backend.dto.response.RefundRequestResponse;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.RefundRequest;
import com.hotel.hotel_backend.entity.RefundRequestStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.RefundRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RefundRequestService {

    private final RefundRequestRepository refundRequestRepository;
    private final BookingRepository bookingRepository;
    private final SecurityService securityService;
    private final BookingRefundService bookingRefundService;

    public RefundRequestResponse createMyRefundRequest(Long userId, Long bookingId, CreateRefundRequest request) {
        User currentUser = securityService.getCurrentUser();
        Booking booking = bookingRepository.findByIdAndUserId(bookingId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Booking not found"));

        if (refundRequestRepository.findByBookingId(bookingId).isPresent()) {
            throw new ApiException(ErrorCode.CONFLICT, "Refund request already exists");
        }

        if (!bookingRefundService.hasSuccessfulCharge(bookingId)) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking has no successful payment to refund");
        }

        if (booking.getStatus() != BookingStatus.CANCELLED
                && booking.getStatus() != BookingStatus.CONFIRMED
                && booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking is not eligible for refund request");
        }

        if (booking.getStatus() == BookingStatus.REFUNDED) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking already refunded");
        }

        Hotel hotel = resolveHotelFromBooking(booking);

        RefundRequest refundRequest = new RefundRequest();
        refundRequest.setBooking(booking);
        refundRequest.setUser(currentUser);
        refundRequest.setHotel(hotel);
        refundRequest.setAmount(booking.getTotalPrice());
        refundRequest.setReason(request.reason().trim());
        refundRequest.setNote(normalizeOptionalText(request.note()));
        refundRequest.setStatus(RefundRequestStatus.PENDING);

        return toResponse(refundRequestRepository.save(refundRequest));
    }

    @Transactional(readOnly = true)
    public RefundRequestResponse getMyRefundRequest(Long userId, Long bookingId) {
        RefundRequest refundRequest = refundRequestRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Refund request not found"));

        if (!refundRequest.getUser().getId().equals(userId)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Refund request not found");
        }

        return toResponse(refundRequest);
    }

    @Transactional(readOnly = true)
    public List<RefundRequestResponse> getPartnerRefundRequests(Long hotelId, RefundRequestStatus status) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        return refundRequestRepository.findPartnerRequests(ownerId, hotelId, status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RefundRequestResponse> getAdminRefundRequests(RefundRequestStatus status) {
        return refundRequestRepository.findAdminRequests(status).stream()
                .map(this::toResponse)
                .toList();
    }

    public RefundRequestResponse approvePartnerRefundRequest(Long refundRequestId) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Refund request not found"));

        if (!refundRequest.getHotel().getOwner().getId().equals(ownerId)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Refund request not found");
        }

        return approve(refundRequest);
    }

    public RefundRequestResponse rejectPartnerRefundRequest(Long refundRequestId) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Refund request not found"));

        if (!refundRequest.getHotel().getOwner().getId().equals(ownerId)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Refund request not found");
        }

        return reject(refundRequest);
    }

    public RefundRequestResponse approveAdminRefundRequest(Long refundRequestId) {
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Refund request not found"));
        return approve(refundRequest);
    }

    public RefundRequestResponse rejectAdminRefundRequest(Long refundRequestId) {
        RefundRequest refundRequest = refundRequestRepository.findById(refundRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Refund request not found"));
        return reject(refundRequest);
    }

    private RefundRequestResponse approve(RefundRequest refundRequest) {
        assertPending(refundRequest);

        User reviewer = securityService.getCurrentUser();
        Booking refundedBooking = bookingRefundService.refundBooking(
                refundRequest.getBooking(),
                "refund-request-" + refundRequest.getId()
        );

        refundRequest.setBooking(refundedBooking);
        refundRequest.setStatus(RefundRequestStatus.APPROVED);
        refundRequest.setReviewedBy(reviewer);
        refundRequest.setReviewedAt(LocalDateTime.now());
        return toResponse(refundRequestRepository.save(refundRequest));
    }

    private RefundRequestResponse reject(RefundRequest refundRequest) {
        assertPending(refundRequest);

        refundRequest.setStatus(RefundRequestStatus.REJECTED);
        refundRequest.setReviewedBy(securityService.getCurrentUser());
        refundRequest.setReviewedAt(LocalDateTime.now());
        return toResponse(refundRequestRepository.save(refundRequest));
    }

    private void assertPending(RefundRequest refundRequest) {
        if (refundRequest.getStatus() != RefundRequestStatus.PENDING) {
            throw new ApiException(ErrorCode.CONFLICT, "Refund request already resolved");
        }
    }

    private Hotel resolveHotelFromBooking(Booking booking) {
        if (booking.getItems() == null || booking.getItems().isEmpty()) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking items are missing");
        }
        return booking.getItems().get(0).getRoom().getHotel();
    }

    private String normalizeOptionalText(String note) {
        if (note == null) {
            return null;
        }

        String normalized = note.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private RefundRequestResponse toResponse(RefundRequest refundRequest) {
        return new RefundRequestResponse(
                refundRequest.getId(),
                refundRequest.getBooking().getId(),
                refundRequest.getHotel().getId(),
                refundRequest.getHotel().getName(),
                refundRequest.getUser().getEmail(),
                refundRequest.getAmount(),
                refundRequest.getReason(),
                refundRequest.getNote(),
                refundRequest.getStatus(),
                refundRequest.getBooking().getCheckIn(),
                refundRequest.getBooking().getCheckOut(),
                refundRequest.getRequestedAt(),
                refundRequest.getReviewedAt()
        );
    }
}
