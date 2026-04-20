package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.PartnerBookingSearchRequest;
import com.hotel.hotel_backend.dto.response.PartnerBookingDetailResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingPageResponse;
import com.hotel.hotel_backend.dto.response.BookingContactResponse;
import com.hotel.hotel_backend.dto.response.BookingItemResponse;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PartnerBookingService {

    private final BookingRepository bookingRepository;
    private final SecurityService securityService;
    private final BookingExpirationService bookingExpirationService;

    public PartnerBookingPageResponse getPartnerBookings(PartnerBookingSearchRequest request) {
        // V1 ưu tiên consistency của dashboard: expire booking pending quá hạn trước khi query list.
        bookingExpirationService.expireOverduePendingBookings();

        long ownerId = securityService.getCurrentPrincipal().userId();
        PageRequest pageRequest = PageRequest.of(request.getPage() - 1, request.getSize());
        Page<com.hotel.hotel_backend.dto.response.PartnerBookingSummaryResponse> page =
                bookingRepository.findPartnerBookingSummaries(
                        ownerId,
                        request.getHotelId(),
                        request.getStatus(),
                        request.getCheckInFrom(),
                        request.getCheckInTo(),
                        pageRequest
                );

        return new PartnerBookingPageResponse(
                page.getContent(),
                request.getPage(),
                request.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext()
        );
    }

    public PartnerBookingDetailResponse getPartnerBooking(Long bookingId) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        Booking booking = bookingRepository.findPartnerBookingDetailById(ownerId, bookingId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Booking not found"));

        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);

        if (booking.getItems().isEmpty()) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking items are missing");
        }

        Hotel hotel = booking.getItems().get(0).getRoom().getHotel();
        BookingContactResponse contactResponse = null;
        if (booking.getContact() != null) {
            contactResponse = new BookingContactResponse(
                    booking.getContact().getName(),
                    booking.getContact().getEmail(),
                    booking.getContact().getPhone()
            );
        }

        return new PartnerBookingDetailResponse(
                booking.getId(),
                hotel.getId(),
                hotel.getName(),
                booking.getUserId(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                booking.getTotalPrice(),
                booking.getStatus(),
                booking.getCreatedAt(),
                booking.getUpdatedAt(),
                booking.getExpiresAt(),
                booking.getItems().stream()
                        .map(item -> new BookingItemResponse(
                                item.getRoom().getId(),
                                item.getRoom().getName(),
                                item.getQuantity(),
                                item.getPrice()
                        ))
                        .toList(),
                contactResponse
        );
    }
}
