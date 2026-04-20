package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    List<PaymentTransaction> findByBookingIdOrderByCreatedAtAsc(Long bookingId);

    Optional<PaymentTransaction> findByBookingIdAndClientRequestId(Long bookingId, String clientRequestId);
}
