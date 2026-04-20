package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingItem;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingExpirationService {

    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final InventoryService inventoryService;

    @Transactional
    public int expireOverduePendingBookings() {
        List<Booking> overdueBookings = bookingRepository.findByStatusAndExpiresAtBefore(
                BookingStatus.PENDING_PAYMENT,
                LocalDateTime.now()
        );

        overdueBookings.forEach(this::expirePendingBooking);
        return overdueBookings.size();
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
            throw new ApiException(ErrorCode.CONFLICT, "Booking items are missing");
        }

        for (BookingItem item : items) {
            inventoryService.releaseInventory(
                    item.getRoom().getId(),
                    booking.getCheckIn(),
                    booking.getCheckOut(),
                    item.getQuantity()
            );
        }
    }
}
