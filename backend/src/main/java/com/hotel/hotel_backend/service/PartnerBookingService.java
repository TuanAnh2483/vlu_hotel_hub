package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.PartnerAnalyticsSummaryRequest;
import com.hotel.hotel_backend.dto.request.PartnerBookingRefundRequest;
import com.hotel.hotel_backend.dto.request.PartnerBookingSearchRequest;
import com.hotel.hotel_backend.dto.response.BookingContactResponse;
import com.hotel.hotel_backend.dto.response.BookingItemResponse;
import com.hotel.hotel_backend.dto.response.PartnerAnalyticsHotelSummaryResponse;
import com.hotel.hotel_backend.dto.response.PartnerAnalyticsSummaryResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingDetailResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingPageResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingSummaryResponse;
import com.hotel.hotel_backend.dto.response.PartnerMonthlyStatsResponse;
import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.RoomUnit;
import com.hotel.hotel_backend.entity.RoomUnitAssignment;
import com.hotel.hotel_backend.entity.RoomUnitStatus;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.RoomUnitAssignmentRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PartnerBookingService {

    private final BookingRepository bookingRepository;
    private final RoomUnitRepository roomUnitRepository;
    private final RoomUnitAssignmentRepository roomUnitAssignmentRepository;
    private final SecurityService securityService;
    private final BookingExpirationService bookingExpirationService;
    private final BookingRefundService bookingRefundService;
    private final UserNotificationService userNotificationService;

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
        Booking booking = loadOwnedBooking(bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);
        return toPartnerBookingDetail(booking);
    }

    @Transactional
    public PartnerBookingDetailResponse checkinPartnerBooking(Long bookingId) {
        Booking booking = loadOwnedBooking(bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);

        if (booking.getStatus() == BookingStatus.CHECKED_IN) {
            return toPartnerBookingDetail(booking);
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ApiException(ErrorCode.CONFLICT, "Only confirmed bookings can be checked in");
        }

        if (booking.getCheckIn().isAfter(LocalDate.now())) {
            throw new ApiException(ErrorCode.CONFLICT, "Cannot check in before the check-in date");
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        booking.setCheckedInAt(LocalDateTime.now());
        Booking savedBooking = bookingRepository.save(booking);
        return toPartnerBookingDetail(savedBooking);
    }

    @Transactional
    public PartnerBookingDetailResponse completePartnerBooking(Long bookingId) {
        Booking booking = loadOwnedBooking(bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            return toPartnerBookingDetail(booking);
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new ApiException(ErrorCode.CONFLICT, "Only confirmed or checked-in bookings can be completed");
        }

        if (booking.getCheckIn().isAfter(LocalDate.now())) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking cannot be completed before check-in date");
        }

        bookingExpirationService.releaseReservedInventory(booking);
        cleanupRoomUnitsOnCheckout(bookingId);
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setCheckedOutAt(LocalDateTime.now());
        Booking savedBooking = bookingRepository.save(booking);
        userNotificationService.createCheckoutReviewNotification(savedBooking);
        return toPartnerBookingDetail(savedBooking);
    }

    private void cleanupRoomUnitsOnCheckout(Long bookingId) {
        // Mô hình mới: phòng được gán qua room_unit_assignment theo khoảng ngày.
        // Khi checkout → đánh dấu phòng cần dọn (hôm nay) rồi giải phóng assignment.
        List<RoomUnitAssignment> assignments = roomUnitAssignmentRepository.findByBookingId(bookingId);
        if (!assignments.isEmpty()) {
            List<RoomUnit> assignedUnits = assignments.stream()
                    .map(RoomUnitAssignment::getRoomUnit)
                    .toList();
            for (RoomUnit unit : assignedUnits) {
                unit.setStatus(RoomUnitStatus.CLEANING);
                unit.setGuestName(null);
            }
            roomUnitRepository.saveAll(assignedUnits);
            roomUnitAssignmentRepository.deleteByBookingId(bookingId);
        }

        // Tương thích ngược: phòng còn gắn nhãn cũ notes = 'bk:<id>' (trước khi có bảng assignment).
        String bookingTag = "bk:" + bookingId + "%";
        List<RoomUnit> legacyUnits = roomUnitRepository.findByNotesStartingWithAndStatusIn(
                bookingTag,
                Set.of(RoomUnitStatus.OCCUPIED, RoomUnitStatus.RESERVED)
        );
        for (RoomUnit unit : legacyUnits) {
            unit.setStatus(RoomUnitStatus.CLEANING);
            unit.setGuestName(null);
            unit.setNotes(null);
        }
        if (!legacyUnits.isEmpty()) {
            roomUnitRepository.saveAll(legacyUnits);
        }
    }

    @Transactional
    public PartnerBookingDetailResponse refundPartnerBooking(Long bookingId, PartnerBookingRefundRequest request) {
        Booking booking = loadOwnedBooking(bookingId);
        Booking refundedBooking = bookingRefundService.refundBooking(booking, request.clientRequestId());
        return toPartnerBookingDetail(refundedBooking);
    }

    public PartnerAnalyticsSummaryResponse getPartnerAnalytics(PartnerAnalyticsSummaryRequest request) {
        bookingExpirationService.expireOverduePendingBookings();

        long ownerId = securityService.getCurrentPrincipal().userId();
        List<PartnerBookingSummaryResponse> rawBookings = bookingRepository.findPartnerBookingSummariesForAnalytics(
                ownerId,
                request.getHotelId(),
                request.getCheckInFrom(),
                request.getCheckInTo()
        );

        Map<Long, PartnerBookingSummaryResponse> bookingsById = new LinkedHashMap<>();
        for (PartnerBookingSummaryResponse booking : rawBookings) {
            bookingsById.putIfAbsent(booking.bookingId(), booking);
        }

        AnalyticsAccumulator overall = new AnalyticsAccumulator(null, "ALL");
        Map<Long, AnalyticsAccumulator> hotels = new LinkedHashMap<>();

        for (PartnerBookingSummaryResponse booking : bookingsById.values()) {
            overall.add(booking);
            hotels.computeIfAbsent(
                            booking.hotelId(),
                            ignored -> new AnalyticsAccumulator(booking.hotelId(), booking.hotelName())
                    )
                    .add(booking);
        }

        List<PartnerAnalyticsHotelSummaryResponse> hotelSummaries = hotels.values().stream()
                .map(AnalyticsAccumulator::toHotelResponse)
                .toList();

        return new PartnerAnalyticsSummaryResponse(
                request.getHotelId(),
                request.getCheckInFrom(),
                request.getCheckInTo(),
                overall.totalBookings,
                overall.pendingPaymentBookings,
                overall.confirmedBookings,
                overall.completedBookings,
                overall.refundedBookings,
                overall.cancelledBookings,
                overall.grossRevenue,
                overall.refundedAmount,
                overall.netRevenue(),
                hotelSummaries
        );
    }

    /**
     * Thống kê theo tháng cho tab Thống kê (StatsTab). Aggregate ngay ở server để frontend
     * không phải kéo toàn bộ booking cả năm về rồi tự cộng. Tái dùng query analytics có sẵn
     * (đã distinct để khử trùng do join items).
     */
    public PartnerMonthlyStatsResponse getPartnerMonthlyStats(Long hotelId, int year) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);

        List<PartnerBookingSummaryResponse> rawBookings = bookingRepository.findPartnerBookingSummariesForAnalytics(
                ownerId, hotelId, from, to);

        // Join items có thể nhân dòng — khử trùng theo bookingId (giống getPartnerAnalytics).
        Map<Long, PartnerBookingSummaryResponse> bookingsById = new LinkedHashMap<>();
        for (PartnerBookingSummaryResponse booking : rawBookings) {
            bookingsById.putIfAbsent(booking.bookingId(), booking);
        }

        long totalRevenue = 0L;
        long totalBookings = 0L;
        long confirmedBookings = 0L;
        long cancelledBookings = 0L;
        long[] monthRevenue = new long[12];
        long[] monthCount = new long[12];

        for (PartnerBookingSummaryResponse booking : bookingsById.values()) {
            totalBookings++;
            BookingStatus status = booking.status();
            long price = booking.totalPrice() != null ? booking.totalPrice() : 0L;

            if (status == BookingStatus.CONFIRMED || status == BookingStatus.COMPLETED) {
                confirmedBookings++;
            }
            if (status == BookingStatus.CANCELLED) {
                cancelledBookings++;
                continue; // revenue + bucket tháng loại CANCELLED
            }

            totalRevenue += price;
            // checkIn không null (query lọc theo check_in trong năm) → tháng luôn hợp lệ.
            int monthIndex = booking.checkIn().getMonthValue() - 1;
            monthRevenue[monthIndex] += price;
            monthCount[monthIndex]++;
        }

        List<PartnerMonthlyStatsResponse.MonthlyBucket> months = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            months.add(new PartnerMonthlyStatsResponse.MonthlyBucket(i + 1, monthRevenue[i], monthCount[i]));
        }

        return new PartnerMonthlyStatsResponse(
                year, totalRevenue, totalBookings, confirmedBookings, cancelledBookings, months);
    }

    private Booking loadOwnedBooking(Long bookingId) {
        long ownerId = securityService.getCurrentPrincipal().userId();
        return bookingRepository.findPartnerBookingDetailById(ownerId, bookingId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Booking not found"));
    }

    private PartnerBookingDetailResponse toPartnerBookingDetail(Booking booking) {
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
                booking.getGuests(),
                booking.getCreatedAt(),
                booking.getUpdatedAt(),
                booking.getExpiresAt(),
                booking.getCheckedInAt(),
                booking.getCheckedOutAt(),
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

    private static final class AnalyticsAccumulator {
        private final Long hotelId;
        private final String hotelName;
        private long totalBookings;
        private long pendingPaymentBookings;
        private long confirmedBookings;
        private long completedBookings;
        private long refundedBookings;
        private long cancelledBookings;
        private double grossRevenue;
        private double refundedAmount;

        private AnalyticsAccumulator(Long hotelId, String hotelName) {
            this.hotelId = hotelId;
            this.hotelName = hotelName;
        }

        private void add(PartnerBookingSummaryResponse booking) {
            totalBookings++;
            double amount = booking.totalPrice() != null ? booking.totalPrice() : 0.0;

            switch (booking.status()) {
                case PENDING_PAYMENT -> pendingPaymentBookings++;
                case CONFIRMED, CHECKED_IN -> {
                    confirmedBookings++;
                    grossRevenue += amount;
                }
                case COMPLETED -> {
                    completedBookings++;
                    grossRevenue += amount;
                }
                case REFUNDED -> {
                    refundedBookings++;
                    grossRevenue += amount;
                    refundedAmount += amount;
                }
                case CANCELLED -> cancelledBookings++;
            }
        }

        private double netRevenue() {
            return grossRevenue - refundedAmount;
        }

        private PartnerAnalyticsHotelSummaryResponse toHotelResponse() {
            return new PartnerAnalyticsHotelSummaryResponse(
                    hotelId,
                    hotelName,
                    totalBookings,
                    pendingPaymentBookings,
                    confirmedBookings,
                    completedBookings,
                    refundedBookings,
                    cancelledBookings,
                    grossRevenue,
                    refundedAmount,
                    netRevenue()
            );
        }
    }
}
