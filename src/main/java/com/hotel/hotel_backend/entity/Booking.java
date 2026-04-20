package com.hotel.hotel_backend.entity;


import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {
    // ID của booking
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ID user đặt phòng (customer_id trong DB)
    @Column(name = "user_id", nullable = false)
    private Long userId;

    // ngày checkin
    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    // ngày checkout
    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;
    @Column(name = "total_price", nullable = false)
    private Double totalPrice;

    // trạng thái booking
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status;
    // Tao contact
    @JsonManagedReference
    @OneToOne(mappedBy = "booking", cascade = CascadeType.ALL)
    private BookingContact contact;

    @Default
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingItem> items = new ArrayList<>();

    @Default
    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PaymentTransaction> paymentTransactions = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    void prePersist() {
        var now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
