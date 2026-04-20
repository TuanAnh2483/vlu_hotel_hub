package com.hotel.hotel_backend.controller;



import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.BookingPaymentTransactionResponse;
import com.hotel.hotel_backend.dto.request.BookingPaymentRequest;
import com.hotel.hotel_backend.dto.request.BookingQuoteRequest;
import com.hotel.hotel_backend.dto.response.BookingQuoteResponse;
import com.hotel.hotel_backend.dto.request.CreateBookingRequest;
import com.hotel.hotel_backend.dto.response.BookingResponse;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.security.JwtPrincipal;
import com.hotel.hotel_backend.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;


    /*
     * API tạo booking
     */
    @PostMapping("/quote")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingQuoteResponse> quoteBooking(@Valid @RequestBody BookingQuoteRequest request) {
        return ApiResponse.ok(bookingService.quoteBooking(request));
    }

    @PostMapping()
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingResponse> createBooking(@Valid @RequestBody CreateBookingRequest request,
                                 @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(bookingService.createBooking(requireUserId(principal), request));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<List<BookingResponse>> getMyBookings(@AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(bookingService.getMyBookings(requireUserId(principal)));
    }

    @GetMapping("/{bookingId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingResponse> getMyBooking(@PathVariable Long bookingId,
                                                     @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(bookingService.getMyBooking(requireUserId(principal), bookingId));
    }

    @PostMapping("/{bookingId}/pay")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingResponse> payBooking(@PathVariable Long bookingId,
                                                   @Valid @RequestBody BookingPaymentRequest request,
                                                   @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(bookingService.payBooking(requireUserId(principal), bookingId, request));
    }

    @GetMapping("/{bookingId}/payments")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<List<BookingPaymentTransactionResponse>> getMyBookingPayments(
            @PathVariable Long bookingId,
            @AuthenticationPrincipal JwtPrincipal principal
    ) {
        return ApiResponse.ok(bookingService.getMyBookingPayments(requireUserId(principal), bookingId));
    }

    @PostMapping("/{bookingId}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<BookingResponse> cancelBooking(@PathVariable Long bookingId,
                                 @AuthenticationPrincipal JwtPrincipal principal) {
        return ApiResponse.ok(bookingService.cancelBooking(requireUserId(principal), bookingId));
    }

    private Long requireUserId(JwtPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }
        return principal.userId();
         
    }
}
