package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingItem;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingExpirationService {

    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final DailyInventoryRepository dailyInventoryRepository;
    private final InventoryService inventoryService;
    // Self-proxy: can goi expireBookingById() QUA proxy de @Transactional(REQUIRES_NEW) co hieu luc.
    // ObjectProvider resolve lazily nen khong gay circular dependency luc khoi tao bean.
    private final ObjectProvider<BookingExpirationService> selfProvider;

    /**
     * Quet va expire moi booking PENDING_PAYMENT qua han. Moi booking duoc expire trong mot
     * transaction RIENG (REQUIRES_NEW) nen mot booking loi chi bi bo qua — khong rollback ca batch
     * va khong khien scheduled job lap vo han tren cung mot booking hong.
     *
     * @return so booking thuc su duoc expire
     */
    public int expireOverduePendingBookings() {
        BookingExpirationService self = selfProvider.getObject();
        int expired = 0;
        for (Long bookingId : findOverduePendingBookingIds()) {
            try {
                if (self.expireBookingById(bookingId)) {
                    expired++;
                }
            } catch (Exception e) {
                log.error("Failed to expire pending bookingId={}, skipping", bookingId, e);
            }
        }
        return expired;
    }

    /** Chi lay danh sach id booking qua han — viec expire tung cai chay o transaction rieng. */
    @Transactional(readOnly = true)
    public List<Long> findOverduePendingBookingIds() {
        return bookingRepository.findByStatusAndExpiresAtBefore(
                        BookingStatus.PENDING_PAYMENT,
                        LocalDateTime.now()
                )
                .stream()
                .map(Booking::getId)
                .toList();
    }

    /**
     * Expire mot booking trong transaction RIENG (REQUIRES_NEW) — phai goi qua self-proxy.
     * Cach ly nay dam bao mot booking loi khong rollback ca batch.
     *
     * @return true neu booking thuc su duoc expire trong lan goi nay
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean expireBookingById(Long bookingId) {
        return bookingRepository.findById(bookingId)
                .map(booking -> {
                    if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
                        return false;
                    }
                    expirePendingBooking(booking);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public Booking expirePendingBookingIfNeeded(Booking booking) {
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            return booking;
        }

        LocalDateTime expiresAt = booking.getExpiresAt();
        if (expiresAt == null || !expiresAt.isBefore(LocalDateTime.now())) {
            return booking;
        }

        return expirePendingBooking(booking);
    }

    public void releaseReservedInventory(Booking booking) {
        releaseInventoryForBooking(booking);
    }

    private Booking expirePendingBooking(Booking booking) {
        releaseInventoryForBooking(booking);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setExpiresAt(null);
        return bookingRepository.save(booking);
    }

    private void releaseInventoryForBooking(Booking booking) {
        List<BookingItem> items = bookingItemRepository.findByBookingId(booking.getId());
        if (items.isEmpty()) {
            log.warn("Skipping inventory release for bookingId={}: no items found", booking.getId());
            return;
        }

        long nights = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
        for (BookingItem item : items) {
            List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                    item.getRoom().getId(), booking.getCheckIn(), booking.getCheckOut().minusDays(1));
            if (inventories.size() != nights) {
                log.warn("Skipping inventory release for bookingId={}, roomId={}: incomplete inventory range",
                        booking.getId(), item.getRoom().getId());
                continue;
            }
            inventoryService.releaseInventory(
                    item.getRoom().getId(),
                    booking.getCheckIn(),
                    booking.getCheckOut(),
                    item.getQuantity()
            );
        }
    }
}
