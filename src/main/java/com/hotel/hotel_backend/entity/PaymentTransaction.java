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
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_payment_transaction_booking_request",
                        columnNames = {"booking_id", "client_request_id"}
                ),
                @UniqueConstraint(
                        name = "uk_payment_transaction_payment_code",
                        columnNames = {"payment_code"}
                ),
                @UniqueConstraint(
                        name = "uk_payment_transaction_gateway_transaction",
                        columnNames = {"gateway_transaction_id"}
                )
        }
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
    private Long amount;

    @Column(name = "provider_reference", nullable = false, length = 100)
    private String providerReference;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "client_request_id", nullable = false, length = 100)
    private String clientRequestId;

    /*
     * Mã nội dung chuyển khoản riêng cho từng phiên thanh toán.
     *
     * Customer phải chuyển khoản đúng mã này. Khi SePay gửi webhook về,
     * backend dùng mã này để biết giao dịch ngân hàng thuộc booking nào.
     * Không dùng bookingId trực tiếp làm nội dung CK vì dễ bị trùng/replay
     * và khó phân biệt các lần retry payment sau này.
     */
    @Column(name = "payment_code", length = 50)
    private String paymentCode;

    @Column(name = "gateway", length = 50)
    private String gateway;

    /*
     * ID giao dịch từ SePay.
     *
     * SePay có thể retry webhook nếu request trước timeout hoặc lỗi mạng.
     * Lưu field này giúp backend nhận biết webhook trùng và không cộng tiền /
     * confirm booking nhiều lần cho cùng một giao dịch ngân hàng.
     */
    @Column(name = "gateway_transaction_id", length = 100)
    private String gatewayTransactionId;

    @Column(name = "gateway_reference_code", length = 100)
    private String gatewayReferenceCode;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "raw_payload", columnDefinition = "text")
    private String rawPayload;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
