package com.hotel.hotel_backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "payment_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_payment_transaction_booking_request",
                columnNames = {"booking_id", "client_request_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentTransactionStatus status;

    @Column(nullable = false)
    private Double amount;

    @Column(name = "provider_reference", nullable = false, length = 100)
    private String providerReference;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "client_request_id", nullable = false, length = 100)
    private String clientRequestId;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
