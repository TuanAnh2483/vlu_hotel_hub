package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.PaymentMethod;
import com.hotel.hotel_backend.entity.PaymentTransaction;
import com.hotel.hotel_backend.entity.PaymentTransactionStatus;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomUnitAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingRefundService {

    private final BookingRepository bookingRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final BookingExpirationService bookingExpirationService;
    private final RoomUnitAssignmentRepository roomUnitAssignmentRepository;

    @Transactional
    public Booking refundBooking(Booking booking, String clientRequestId) {
        return refundBooking(booking, clientRequestId, null, null);
    }

    @Transactional
    public Booking refundBooking(Booking booking, String clientRequestId, String transferNote) {
        return refundBooking(booking, clientRequestId, transferNote, null);
    }

    /**
     * @param refundAmount số tiền hoàn cụ thể (theo chính sách hủy). Null → hoàn đủ totalPrice
     *                     (dùng cho hoàn tiền thủ công của partner, giữ nguyên hành vi cũ).
     */
    @Transactional
    public Booking refundBooking(Booking booking, String clientRequestId, String transferNote, Long refundAmount) {
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);

        PaymentTransaction existingTransaction = paymentTransactionRepository
                .findByBookingIdAndClientRequestId(booking.getId(), clientRequestId)
                .orElse(null);

        if (existingTransaction != null) {
            if (isSuccessfulRefund(existingTransaction)) {
                return booking;
            }
            throw new ApiException(ErrorCode.CONFLICT, "clientRequestId already used");
        }

        if (booking.getStatus() == BookingStatus.REFUNDED) {
            return booking;
        }

        if (!hasSuccessfulCharge(booking.getId())) {
            throw new ApiException(ErrorCode.CONFLICT, "Booking has no successful payment to refund");
        }

        switch (booking.getStatus()) {
            case CONFIRMED -> {
                if (!booking.getCheckIn().isAfter(LocalDate.now())) {
                    throw new ApiException(
                            ErrorCode.CONFLICT,
                            "Only future confirmed bookings can be refunded"
                    );
                }
                bookingExpirationService.releaseReservedInventory(booking);
            }
            case COMPLETED, CANCELLED -> {
                // Inventory already released: COMPLETED rooms were occupied and freed on checkout,
                // CANCELLED bookings had inventory released at cancellation time. No release needed.
            }
            default -> throw new ApiException(ErrorCode.CONFLICT, "Only paid bookings can be refunded");
        }

        booking.setStatus(BookingStatus.REFUNDED);
        booking.setExpiresAt(null);
        // Giải phóng phòng vật lý đã gán (nếu booking trước đó CONFIRMED và đã gán phòng).
        roomUnitAssignmentRepository.deleteByBookingId(booking.getId());
        Booking savedBooking = bookingRepository.save(booking);
        recordRefundTransaction(savedBooking, clientRequestId, transferNote, refundAmount);
        return savedBooking;
    }

    @Transactional(readOnly = true)
    public boolean hasSuccessfulCharge(Long bookingId) {
        return paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId).stream()
                .anyMatch(transaction -> transaction.getStatus() == PaymentTransactionStatus.SUCCESS
                        && transaction.getAmount() != null
                        && transaction.getAmount() > 0);
    }

    private boolean isSuccessfulRefund(PaymentTransaction paymentTransaction) {
        return paymentTransaction.getStatus() == PaymentTransactionStatus.SUCCESS
                && paymentTransaction.getAmount() != null
                && paymentTransaction.getAmount() < 0;
    }

    private void recordRefundTransaction(Booking booking, String clientRequestId, String transferNote, Long refundAmount) {
        long amount = (refundAmount != null) ? refundAmount : booking.getTotalPrice();
        String providerRef = (transferNote != null && !transferNote.isBlank())
                ? transferNote.trim()
                : "MANUAL-REFUND-" + UUID.randomUUID();
        PaymentTransaction refundTransaction = PaymentTransaction.builder()
                .booking(booking)
                .method(PaymentMethod.MANUAL_TRANSFER)
                .status(PaymentTransactionStatus.SUCCESS)
                .amount(-Math.abs(amount))
                .providerReference(providerRef)
                .clientRequestId(clientRequestId)
                .build();
        paymentTransactionRepository.save(refundTransaction);
    }
}
