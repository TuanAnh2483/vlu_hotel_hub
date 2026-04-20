package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.BookingContactRequest;
import com.hotel.hotel_backend.dto.request.BookingRoomRequest;
import com.hotel.hotel_backend.dto.request.CreateBookingRequest;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.exeption.ApiException;
import com.hotel.hotel_backend.exeption.ErrorCode;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import jakarta.persistence.OptimisticLockException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Tag("concurrency")
@Disabled("Temporarily turned off by request")
class BookingServiceConcurrencyTest {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    private Long customerId;
    private CreateBookingRequest request;

    @BeforeEach
    void setUp() {
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();

        User owner = new User();
        owner.setEmail("owner.concurrent@test.com");
        owner.setPasswordHash("hash-owner");
        owner.setUserType(UserType.PARTNER);
        owner = userRepository.save(owner);

        User customer = new User();
        customer.setEmail("customer.concurrent@test.com");
        customer.setPasswordHash("hash-customer");
        customer.setUserType(UserType.CUSTOMER);
        customer = userRepository.save(customer);
        customerId = customer.getId();

        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName("Concurrent Hotel");
        hotel.setAddress("Test Address");
        hotel.setProvince("Bangkok");
        hotel.setDistrict("District 1");
        hotel = hotelRepository.save(hotel);

        Room room = new Room();
        room.setHotel(hotel);
        room.setName("Standard Room");
        room.setPrice(1_000_000L);
        room.setCapacity(2);
        room.setQuantity(1);
        room = roomRepository.save(room);

        inventoryService.generateInventory(room);

        request = new CreateBookingRequest();
        request.setCheckIn(LocalDate.now().plusDays(1));
        request.setCheckOut(LocalDate.now().plusDays(2));
        request.setRoom(List.of(new BookingRoomRequest(room.getId(), 1)));
        request.setContact(new BookingContactRequest(
                "Concurrent Customer",
                "customer.concurrent@test.com",
                "0123456789"
        ));
    }

    @Test
    void shouldAllowOnlyOneBookingWhenRequestsRunConcurrently() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Future<Throwable> first = executor.submit(() -> runConcurrentCreateBooking(ready, start));
        Future<Throwable> second = executor.submit(() -> runConcurrentCreateBooking(ready, start));

        assertTrue(ready.await(5, TimeUnit.SECONDS));
        start.countDown();

        List<Throwable> errors = new ArrayList<>();
        Throwable firstError = first.get(15, TimeUnit.SECONDS);
        Throwable secondError = second.get(15, TimeUnit.SECONDS);
        if (firstError != null) {
            errors.add(firstError);
        }
        if (secondError != null) {
            errors.add(secondError);
        }

        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        int successCount = 2 - errors.size();
        assertEquals(1, successCount, "Exactly one booking should succeed");
        assertEquals(1, errors.size(), "Exactly one request should fail");
        assertEquals(1L, bookingRepository.count(), "Only one booking should be persisted");
        assertEquals(1L, bookingItemRepository.count(), "Only one booking item should be persisted");
        assertTrue(isConflictLike(errors.get(0)), "Failure should be conflict/optimistic lock");
    }

    private Throwable runConcurrentCreateBooking(CountDownLatch ready, CountDownLatch start) {
        try {
            ready.countDown();
            start.await(5, TimeUnit.SECONDS);
            bookingService.createBooking(customerId, request);
            return null;
        } catch (Throwable t) {
            return t;
        }
    }

    private boolean isConflictLike(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof ApiException apiException
                    && apiException.getCode() == ErrorCode.CONFLICT) {
                return true;
            }
            if (current instanceof OptimisticLockingFailureException
                    || current instanceof OptimisticLockException) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
