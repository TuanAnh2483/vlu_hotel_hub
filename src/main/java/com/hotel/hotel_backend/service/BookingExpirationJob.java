package com.hotel.hotel_backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingExpirationJob {

    private final BookingExpirationService bookingExpirationService;

    @Scheduled(fixedDelayString = "${app.booking.expiration.fixed-delay-ms:60000}")
    public void expirePendingBookings() {
        int expiredCount = bookingExpirationService.expireOverduePendingBookings();
        if (expiredCount > 0) {
            log.info("Expired {} pending payment bookings", expiredCount);
        }
    }
}
