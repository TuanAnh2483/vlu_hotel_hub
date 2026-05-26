package com.hotel.hotel_backend.service.impl;

import com.hotel.hotel_backend.dto.request.BookingContactRequest;
import com.hotel.hotel_backend.dto.request.BookingPaymentRequest;
import com.hotel.hotel_backend.dto.request.BookingQuoteRequest;
import com.hotel.hotel_backend.dto.request.BookingRoomRequest;
import com.hotel.hotel_backend.dto.request.CreateBookingRequest;
import com.hotel.hotel_backend.dto.response.BookingItemResponse;
import com.hotel.hotel_backend.dto.response.BookingPaymentTransactionResponse;
import com.hotel.hotel_backend.dto.response.BookingQuoteResponse;
import com.hotel.hotel_backend.dto.response.BookingResponse;
import com.hotel.hotel_backend.entity.*;
import com.hotel.hotel_backend.entity.BookingMode;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.mapper.BookingMapper;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.service.BookingExpirationService;
import com.hotel.hotel_backend.service.BookingService;
import com.hotel.hotel_backend.service.InventoryService;
import com.hotel.hotel_backend.service.search.HotelAvailabilityService;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

    private static final long PAYMENT_TTL_MINUTES = 15;
    // FIX TASK-2: max attempts for server-side optimistic-lock retry
    private static final int MAX_BOOKING_ATTEMPTS = 3;

    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final InventoryService inventoryService;
    private final RoomRepository roomRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final BookingMapper bookingMapper;
    private final HotelAvailabilityService hotelAvailabilityService;
    private final BookingExpirationService bookingExpirationService;

    // FIX TASK-2: Self-proxy injected lazily so @Transactional on createBookingOnce() is honoured.
    // Non-final → Lombok @RequiredArgsConstructor skips it; Spring injects the CGLIB proxy at first use.
    @Autowired @Lazy
    private BookingServiceImpl self;

    /**
     * Quote booking: check room có book được không và tính total price, chưa giữ chỗ.
     */
    @Override
    @Transactional(readOnly = true)
    public BookingQuoteResponse quoteBooking(BookingQuoteRequest request) {
        List<BookingRoomRequest> roomRequests = requireRoomRequests(request.getRoom());
        BookingPreparation preparation = prepareBooking(
                request.getCheckIn(),
                request.getCheckOut(),
                roomRequests
        );

        return toQuoteResponse(preparation, request.getCheckIn(), request.getCheckOut());
    }

    /**
     * FIX TASK-2: Retry wrapper — not transactional itself; each attempt is a fresh transaction
     * via self-proxy. On optimistic-lock conflict, backs off briefly and retries up to
     * MAX_BOOKING_ATTEMPTS times. After exhausting retries, maps to CONFLICT (HTTP 409).
     * GlobalExceptionHandler also catches any escaping ObjectOptimisticLockingFailureException
     * as a second safety net.
     */
    @Override
    public BookingResponse createBooking(Long userId, CreateBookingRequest bookingRequest) {
        for (int attempt = 1; attempt <= MAX_BOOKING_ATTEMPTS; attempt++) {
            try {
                return self.createBookingOnce(userId, bookingRequest);
            } catch (ObjectOptimisticLockingFailureException ex) {
                if (attempt == MAX_BOOKING_ATTEMPTS) {
                    throw new ApiException(ErrorCode.CONFLICT,
                            "Phòng vừa được người khác đặt, vui lòng thử lại");
                }
                try {
                    Thread.sleep(50L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new ApiException(ErrorCode.CONFLICT,
                            "Phòng vừa được người khác đặt, vui lòng thử lại");
                }
            }
        }
        throw new ApiException(ErrorCode.CONFLICT, "Phòng vừa được người khác đặt, vui lòng thử lại");
    }

    /**
     * Single transactional attempt: reserve inventory, create booking entity, persist contact/items.
     * Called exclusively via self-proxy so @Transactional is enforced through the Spring AOP chain.
     */
    @Transactional
    public BookingResponse createBookingOnce(Long userId, CreateBookingRequest bookingRequest) {
        validateUserId(userId);

        List<BookingRoomRequest> roomRequests = requireRoomRequests(bookingRequest.getRoom());
        BookingContactRequest bookingContactRequest = requirePrimaryContact(bookingRequest);
        BookingPreparation preparation = prepareBooking(
                bookingRequest.getCheckIn(),
                bookingRequest.getCheckOut(),
                roomRequests
        );
        reserveInventory(preparation.reservations(), bookingRequest.getCheckIn(), bookingRequest.getCheckOut());

        Booking booking = createBookingEntity(userId, bookingRequest);
        bookingRepository.save(booking);

        BookingContact contact = createBookingContact(bookingContactRequest, booking);
        booking.setContact(contact);

        long totalPrice = createBookingItems(booking, preparation.reservations());
        booking.setTotalPrice(totalPrice);

        bookingRepository.save(booking);

        return bookingMapper.toBookingResponse(booking);
    }

    /**
     * Lấy lịch sử booking của user theo thứ tự mới nhất trước.
     */
    @Override
    @Transactional
    public List<BookingResponse> getMyBookings(Long userId) {
        return bookingRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(bookingExpirationService::expirePendingBookingIfNeeded)
                .map(bookingMapper::toBookingResponse)
                .toList();
    }

    /**
     * Booking detail cho màn hình customer, luôn trả trạng thái mới nhất sau passive expiration.
     */
    @Override
    @Transactional
    public BookingResponse getMyBooking(Long userId, Long bookingId) {
        Booking booking = loadOwnedBooking(userId, bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);
        return bookingMapper.toBookingResponse(booking);
    }

    /**
     * Payment placeholder v1: success thì CONFIRMED, fail thì giữ nguyên PENDING_PAYMENT để retry.
     */
    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public BookingResponse payBooking(Long userId, Long bookingId, BookingPaymentRequest request) {
        Booking booking = loadOwnedBooking(userId, bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);
        PaymentTransaction existingTransaction = paymentTransactionRepository
                .findByBookingIdAndClientRequestId(bookingId, request.clientRequestId())
                .orElse(null);

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            if (canReplaySuccessfulPayment(existingTransaction)) {
                return replayPaymentResult(booking, existingTransaction);
            }

            if (existingTransaction == null) {
                recordPaymentAttempt(
                        booking,
                        request.clientRequestId(),
                        PaymentTransactionStatus.FAILED,
                        "Booking is not waiting for payment"
                );
            }
            throw new ApiException(ErrorCode.CONFLICT, "Booking is not waiting for payment");
        }

        if (existingTransaction != null) {
            return replayPaymentResult(booking, existingTransaction);
        }

        if (Boolean.FALSE.equals(request.simulateSuccess())) {
            recordPaymentAttempt(
                    booking,
                    request.clientRequestId(),
                    PaymentTransactionStatus.FAILED,
                    "Payment failed"
            );
            throw new ApiException(ErrorCode.CONFLICT, "Payment failed");
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setExpiresAt(null);
        Booking savedBooking = bookingRepository.save(booking);
        recordPaymentAttempt(
                savedBooking,
                request.clientRequestId(),
                PaymentTransactionStatus.SUCCESS,
                null
        );
        return bookingMapper.toBookingResponse(savedBooking);
    }

    /**
     * Payment history là read-model cho frontend, chỉ đọc transaction của booking thuộc owner hiện tại.
     */
    @Override
    @Transactional
    public List<BookingPaymentTransactionResponse> getMyBookingPayments(Long userId, Long bookingId) {
        Booking booking = loadOwnedBooking(userId, bookingId);
        bookingExpirationService.expirePendingBookingIfNeeded(booking);

        return paymentTransactionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId).stream()
                .map(this::toPaymentTransactionResponse)
                .toList();
    }

    /**
     * Hủy booking và release toàn bộ inventory đã reserve.
     */
    @Override
    @Transactional
    public BookingResponse cancelBooking(Long userId, Long bookingId) {
        Booking booking = loadOwnedBooking(userId, bookingId);
        booking = bookingExpirationService.expirePendingBookingIfNeeded(booking);

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            return bookingMapper.toBookingResponse(booking);
        }

        if (booking.getStatus() == BookingStatus.COMPLETED) {
            throw new ApiException(ErrorCode.CONFLICT, "Completed booking cannot be cancelled");
        }

        bookingExpirationService.releaseReservedInventory(booking);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setExpiresAt(null);

        return bookingMapper.toBookingResponse(bookingRepository.save(booking));
    }

    private void validateUserId(Long userId) {
        if (userId == null) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "User is required");
        }
    }

    private Booking loadOwnedBooking(Long userId, Long bookingId) {
        return bookingRepository.findByIdAndUserId(bookingId, userId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Booking not found"));
    }

    private List<BookingRoomRequest> requireRoomRequests(List<BookingRoomRequest> roomRequests) {
        if (roomRequests == null || roomRequests.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Room is required");
        }
        return roomRequests;
    }

    private BookingContactRequest requirePrimaryContact(CreateBookingRequest bookingRequest) {
        BookingContactRequest bookingContactRequest = bookingRequest.getContact();
        if (bookingContactRequest == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Contact is required");
        }

        return bookingContactRequest;
    }

    private BookingPreparation prepareBooking(
            LocalDate checkIn,
            LocalDate checkOut,
            List<BookingRoomRequest> roomRequests
    ) {
        // Quote và confirm dùng chung bước evaluate này để pricing luôn khớp availability service.
        List<RoomReservation> reservations = loadRoomReservations(roomRequests, checkIn, checkOut);
        ensureSingleHotel(reservations);
        return new BookingPreparation(resolveHotel(reservations), reservations);
    }

    private List<RoomReservation> loadRoomReservations(
            List<BookingRoomRequest> roomRequests,
            LocalDate checkIn,
            LocalDate checkOut
    ) {
        // Booking v1 chỉ nhận room cụ thể, nên filter stay-level khác để trống và reuse thẳng evaluator.
        HotelStayCriteria stayCriteria = new HotelStayCriteria(
                checkIn,
                checkOut,
                1,
                1,
                java.util.Set.of(),
                java.util.Set.of(),
                java.util.Set.of()
        );

        List<RoomReservation> reservations = new ArrayList<>(roomRequests.size());
        Map<Long, Room> roomsById = new LinkedHashMap<>();
        Map<Long, Integer> quantitiesByRoomId = new LinkedHashMap<>();
        for (BookingRoomRequest roomRequest : roomRequests) {
            Room room = roomRepository.findById(roomRequest.roomTypeId())
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Room not found"));

            if (room.getStatus() != RoomStatus.ACTIVE) {
                throw new ApiException(ErrorCode.CONFLICT, "Room is not available for booking");
            }

            roomsById.put(room.getId(), room);
            quantitiesByRoomId.merge(room.getId(), roomRequest.quantity(), Integer::sum);
        }

        Map<Long, HotelAvailabilityService.BookableRoomStay> bookableRooms =
                hotelAvailabilityService.findBookableRoomStays(new ArrayList<>(roomsById.values()), stayCriteria);

        for (Room room : roomsById.values()) {
            HotelAvailabilityService.BookableRoomStay bookableRoom = bookableRooms.get(room.getId());
            Integer requestedQuantity = quantitiesByRoomId.get(room.getId());
            if (bookableRoom == null) {
                throw new ApiException(ErrorCode.CONFLICT, "Room is not bookable for this stay");
            }
            if (requestedQuantity > bookableRoom.availableUnits()) {
                throw new ApiException(ErrorCode.CONFLICT, "Not enough rooms available");
            }

            reservations.add(new RoomReservation(room, requestedQuantity, bookableRoom.stayPrice()));
        }

        return reservations;
    }

    private void reserveInventory(List<RoomReservation> reservations, LocalDate checkIn, LocalDate checkOut) {
        // Chỉ reserve ở bước create/confirm. Quote không được block inventory.
        for (RoomReservation reservation : reservations) {
            inventoryService.reserveInventory(
                    reservation.room().getId(),
                    checkIn,
                    checkOut,
                    reservation.quantity()
            );
        }
    }

    private Booking createBookingEntity(Long userId, CreateBookingRequest bookingRequest) {
        Booking booking = new Booking();
        booking.setUserId(userId);
        booking.setCheckIn(bookingRequest.getCheckIn());
        booking.setCheckOut(bookingRequest.getCheckOut());
        booking.setTotalPrice(0L);
        // Sau confirm booking đã được giữ chỗ nhưng vẫn chờ bước pay placeholder.
        booking.setStatus(BookingStatus.PENDING_PAYMENT);
        booking.setExpiresAt(LocalDateTime.now().plusMinutes(PAYMENT_TTL_MINUTES));
        return booking;
    }

    private BookingContact createBookingContact(BookingContactRequest bookingContactRequest, Booking booking) {
        BookingContact contact = bookingMapper.toBookingContact(bookingContactRequest);
        contact.setName(bookingContactRequest.fullName());
        contact.setPhone(bookingContactRequest.phone());
        contact.setEmail(bookingContactRequest.email());
        contact.setBooking(booking);
        return contact;
    }

    private long createBookingItems(
            Booking booking,
            List<RoomReservation> reservations
    ) {
        long totalPrice = 0L;
        List<BookingItem> items = new ArrayList<>();

        for (RoomReservation reservation : reservations) {
            Room room = reservation.room();
            Integer quantity = reservation.quantity();

            BookingItem item = BookingItem.builder()
                    .booking(booking)
                    .room(room)
                    .quantity(quantity)
                    .price(reservation.stayPrice())
                    .build();

            items.add(item);
            totalPrice += item.getPrice() * item.getQuantity();
        }

        bookingItemRepository.saveAll(items);
        booking.setItems(items);

        return totalPrice;
    }

    private BookingQuoteResponse toQuoteResponse(BookingPreparation preparation, LocalDate checkIn, LocalDate checkOut) {
        // Quote response chỉ phản ánh giá và room đã evaluate, không tạo side effect nào trong DB.
        Hotel hotel = preparation.hotel();
        List<BookingItemResponse> items = preparation.reservations().stream()
                .map(reservation -> new BookingItemResponse(
                        reservation.room().getId(),
                        reservation.room().getName(),
                        reservation.quantity(),
                        reservation.stayPrice()
                ))
                .toList();

        long totalPrice = preparation.reservations().stream()
                .mapToLong(reservation -> reservation.stayPrice() * reservation.quantity())
                .sum();

        return new BookingQuoteResponse(
                hotel.getId(),
                hotel.getName(),
                checkIn,
                checkOut,
                totalPrice,
                items
        );
    }

    private Hotel resolveHotel(List<RoomReservation> reservations) {
        if (reservations.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Room is required");
        }
        return reservations.get(0).room().getHotel();
    }

    private void ensureSingleHotel(List<RoomReservation> reservations) {
        if (reservations.isEmpty()) {
            return;
        }

        Long hotelId = reservations.get(0).room().getHotel().getId();
        boolean mixedHotels = reservations.stream()
                .anyMatch(reservation -> !reservation.room().getHotel().getId().equals(hotelId));

        if (mixedHotels) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "All booked rooms must belong to the same hotel");
        }

        // ENTIRE hotels: chỉ được đặt 1 room duy nhất với quantity = 1.
        Hotel hotel = reservations.get(0).room().getHotel();
        if (hotel.getBookingMode() == BookingMode.ENTIRE) {
            if (reservations.size() > 1) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Cơ sở thuê nguyên căn chỉ cho phép đặt 1 đơn vị");
            }
            RoomReservation reservation = reservations.get(0);
            if (reservation.quantity() != 1) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Cơ sở thuê nguyên căn chỉ cho phép đặt số lượng 1");
            }
        }
    }

    private BookingResponse replayPaymentResult(Booking booking, PaymentTransaction existingTransaction) {
        if (existingTransaction.getStatus() == PaymentTransactionStatus.SUCCESS) {
            return bookingMapper.toBookingResponse(booking);
        }

        throw new ApiException(
                ErrorCode.CONFLICT,
                existingTransaction.getFailureReason() != null
                        ? existingTransaction.getFailureReason()
                        : "Payment failed"
        );
    }

    private boolean canReplaySuccessfulPayment(PaymentTransaction existingTransaction) {
        return existingTransaction != null && existingTransaction.getStatus() == PaymentTransactionStatus.SUCCESS;
    }

    private void recordPaymentAttempt(
            Booking booking,
            String clientRequestId,
            PaymentTransactionStatus status,
            String failureReason
    ) {
        PaymentTransaction paymentTransaction = PaymentTransaction.builder()
                .booking(booking)
                .method(PaymentMethod.SIMULATED)
                .status(status)
                .amount(booking.getTotalPrice())
                .providerReference("SIM-" + UUID.randomUUID())
                .failureReason(failureReason)
                .clientRequestId(clientRequestId)
                .build();
        paymentTransactionRepository.save(paymentTransaction);
    }

    private BookingPaymentTransactionResponse toPaymentTransactionResponse(PaymentTransaction paymentTransaction) {
        return new BookingPaymentTransactionResponse(
                paymentTransaction.getId(),
                paymentTransaction.getMethod().name(),
                paymentTransaction.getStatus().name(),
                paymentTransaction.getAmount(),
                paymentTransaction.getProviderReference(),
                paymentTransaction.getFailureReason(),
                paymentTransaction.getClientRequestId(),
                paymentTransaction.getCreatedAt()
        );
    }

    private static final class RoomReservation {
        private final Room room;
        private final Integer quantity;
        private final Long stayPrice;

        private RoomReservation(Room room, Integer quantity, Long stayPrice) {
            this.room = room;
            this.quantity = quantity;
            this.stayPrice = stayPrice;
        }

        private Room room() {
            return room;
        }

        private Integer quantity() {
            return quantity;
        }

        private Long stayPrice() {
            return stayPrice;
        }
    }

    private record BookingPreparation(
            Hotel hotel,
            List<RoomReservation> reservations
    ) {}
}
