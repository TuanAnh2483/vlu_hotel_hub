package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.dto.response.PartnerBookingSummaryResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Booking> findByIdAndUserId(Long id, Long userId);

    List<Booking> findByStatusAndExpiresAtBefore(BookingStatus status, LocalDateTime expiresAt);

    @Query(
            value = """
                    select distinct new com.hotel.hotel_backend.dto.response.PartnerBookingSummaryResponse(
                        b.id,
                        h.id,
                        h.name,
                        c.name,
                        b.checkIn,
                        b.checkOut,
                        b.totalPrice,
                        b.status,
                        b.createdAt,
                        b.expiresAt
                    )
                    from Booking b
                    join b.items bi
                    join bi.room r
                    join r.hotel h
                    left join b.contact c
                    where h.owner.id = :ownerId
                      and (:hotelId is null or h.id = :hotelId)
                      and (:status is null or b.status = :status)
                      and (:checkInFrom is null or b.checkIn >= :checkInFrom)
                      and (:checkInTo is null or b.checkIn <= :checkInTo)
                    order by b.createdAt desc
                    """,
            countQuery = """
                    select count(distinct b.id)
                    from Booking b
                    join b.items bi
                    join bi.room r
                    join r.hotel h
                    where h.owner.id = :ownerId
                      and (:hotelId is null or h.id = :hotelId)
                      and (:status is null or b.status = :status)
                      and (:checkInFrom is null or b.checkIn >= :checkInFrom)
                      and (:checkInTo is null or b.checkIn <= :checkInTo)
                    """
    )
    Page<PartnerBookingSummaryResponse> findPartnerBookingSummaries(
            @Param("ownerId") Long ownerId,
            @Param("hotelId") Long hotelId,
            @Param("status") BookingStatus status,
            @Param("checkInFrom") LocalDate checkInFrom,
            @Param("checkInTo") LocalDate checkInTo,
            Pageable pageable
    );

    @Query("""
            select distinct b
            from Booking b
            left join fetch b.contact c
            left join fetch b.items bi
            left join fetch bi.room r
            left join fetch r.hotel h
            where b.id = :bookingId
              and h.owner.id = :ownerId
            """)
    Optional<Booking> findPartnerBookingDetailById(@Param("ownerId") Long ownerId, @Param("bookingId") Long bookingId);

}
