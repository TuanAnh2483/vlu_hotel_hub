package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.dto.response.MyBillingItemResponse;
import com.hotel.hotel_backend.entity.PaymentMethod;
import com.hotel.hotel_backend.entity.PaymentTransaction;
import com.hotel.hotel_backend.entity.PaymentTransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    List<PaymentTransaction> findByBookingIdOrderByCreatedAtAsc(Long bookingId);

    Optional<PaymentTransaction> findByBookingIdAndClientRequestId(Long bookingId, String clientRequestId);

    Optional<PaymentTransaction> findByPaymentCode(String paymentCode);

    Optional<PaymentTransaction> findByGatewayTransactionId(String gatewayTransactionId);

    Optional<PaymentTransaction> findTopByBookingIdAndMethodAndStatusOrderByCreatedAtDesc(
            Long bookingId,
            PaymentMethod method,
            PaymentTransactionStatus status
    );

    List<PaymentTransaction> findTop10ByStatusOrderByCreatedAtDesc(PaymentTransactionStatus status);

    @Query("""
            select distinct new com.hotel.hotel_backend.dto.response.MyBillingItemResponse(
                pt.id,
                b.id,
                h.name,
                case
                    when pt.amount < 0 then concat('Hoàn tiền booking #', cast(b.id as String), ' - ', h.name)
                    else concat('Thanh toán booking #', cast(b.id as String), ' - ', h.name)
                end,
                pt.amount,
                pt.status,
                pt.method,
                pt.createdAt
            )
            from PaymentTransaction pt
            join pt.booking b
            join b.items bi
            join bi.room r
            join r.hotel h
            where b.userId = :userId
            order by pt.createdAt desc
            """)
    List<MyBillingItemResponse> findCustomerBillingItems(@Param("userId") Long userId);

    @Query("""
            select distinct new com.hotel.hotel_backend.dto.response.MyBillingItemResponse(
                pt.id,
                b.id,
                h.name,
                case
                    when pt.amount < 0 then concat('Hoàn tiền booking #', cast(b.id as String), ' - ', h.name)
                    else concat('Doanh thu booking #', cast(b.id as String), ' - ', h.name)
                end,
                pt.amount,
                pt.status,
                pt.method,
                pt.createdAt
            )
            from PaymentTransaction pt
            join pt.booking b
            join b.items bi
            join bi.room r
            join r.hotel h
            where h.owner.id = :ownerId
            order by pt.createdAt desc
            """)
    List<MyBillingItemResponse> findPartnerBillingItems(@Param("ownerId") Long ownerId);
}
