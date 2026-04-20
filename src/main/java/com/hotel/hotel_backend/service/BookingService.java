package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.BookingPaymentRequest;
import com.hotel.hotel_backend.dto.request.BookingQuoteRequest;
import com.hotel.hotel_backend.dto.request.CreateBookingRequest;
import com.hotel.hotel_backend.dto.response.BookingPaymentTransactionResponse;
import com.hotel.hotel_backend.dto.response.BookingQuoteResponse;
import com.hotel.hotel_backend.dto.response.BookingResponse;

import java.util.List;

public interface BookingService {
    /**
     * Quote lại booking theo stay hiện tại, chưa giữ inventory và chưa tạo booking.
     */
    BookingQuoteResponse quoteBooking(BookingQuoteRequest request);

    /**
     * Confirm booking, giữ inventory và tạo booking ở trạng thái PENDING_PAYMENT.
     */
    BookingResponse createBooking(Long userId, CreateBookingRequest  request);

    /**
     * Lấy danh sách booking của user hiện tại.
     */
    List<BookingResponse> getMyBookings(Long userId);

    /**
     * Lấy chi tiết một booking thuộc user hiện tại.
     */
    BookingResponse getMyBooking(Long userId, Long bookingId);

    /**
     * Placeholder payment v1: chỉ cho phép pay booking đang ở PENDING_PAYMENT.
     */
    BookingResponse payBooking(Long userId, Long bookingId, BookingPaymentRequest request);

    /**
     * Trả timeline payment attempts của booking thuộc user hiện tại.
     */
    List<BookingPaymentTransactionResponse> getMyBookingPayments(Long userId, Long bookingId);

    /**
     * Hủy booking và nhả inventory nếu booking chưa hoàn tất.
     */
    BookingResponse cancelBooking(Long userId, Long bookingId);
}
