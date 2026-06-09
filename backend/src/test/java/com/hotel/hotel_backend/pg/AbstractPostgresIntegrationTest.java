package com.hotel.hotel_backend.pg;

import com.hotel.hotel_backend.entity.*;
import com.hotel.hotel_backend.repository.*;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Base class for integration tests that run against a real PostgreSQL container.
 * All subclasses share a single container instance started once for the JVM run.
 * Spring's context cache ensures one ApplicationContext is reused across all subclasses.
 * Tests are skipped automatically when Docker is not available.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractPostgresIntegrationTest {

    private static final boolean DOCKER_AVAILABLE;
    static PostgreSQLContainer<?> POSTGRES;

    static {
        boolean available;
        try {
            available = DockerClientFactory.instance().isDockerAvailable();
        } catch (Exception e) {
            available = false;
        }
        DOCKER_AVAILABLE = available;
        if (DOCKER_AVAILABLE) {
            POSTGRES = new PostgreSQLContainer<>("postgres:16")
                    .withDatabaseName("hotel_test")
                    .withUsername("pgtest")
                    .withPassword("pgtest");
            POSTGRES.start();
        }
    }

    @BeforeAll
    static void checkDocker() {
        assumeTrue(DOCKER_AVAILABLE, "Docker is not available — skipping PostgreSQL integration tests");
    }

    @DynamicPropertySource
    static void overrideDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected JwtService jwtService;

    @Autowired protected UserRepository userRepository;
    @Autowired protected HotelRepository hotelRepository;
    @Autowired protected RoomRepository roomRepository;
    @Autowired protected RoomUnitRepository roomUnitRepository;
    @Autowired protected BookingRepository bookingRepository;
    @Autowired protected BookingItemRepository bookingItemRepository;
    @Autowired protected DailyInventoryRepository dailyInventoryRepository;
    @Autowired protected DailyRateRepository dailyRateRepository;
    @Autowired protected PaymentTransactionRepository paymentTransactionRepository;
    @Autowired protected InventoryService inventoryService;

    protected final LocalDate checkIn = LocalDate.now().plusDays(1);
    protected final LocalDate checkOut = checkIn.plusDays(2);

    protected User seedUser(String email, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    protected String tokenFor(String email, UserType userType) {
        return jwtService.generate(seedUser(email, userType));
    }

    protected Hotel seedHotel(User owner, String name) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " Address, District 1");
        hotel.setProvince("Ho Chi Minh City");
        hotel.setDistrict("District 1");
        hotel.setHotelType(HotelType.HOTEL);
        return hotelRepository.save(hotel);
    }

    protected Room seedRoom(Hotel hotel, String name, int quantity) {
        Room room = new Room();
        room.setHotel(hotel);
        room.setName(name);
        room.setPrice(1_000_000L);
        room.setCapacity(2);
        room.setQuantity(quantity);
        room.setRoomCategory(RoomCategory.STANDARD);
        room.setBedType(BedType.DOUBLE);
        return roomRepository.save(room);
    }

    protected void seedInventoryAndRates(Room room, long pricePerNight) {
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
        for (LocalDate d = checkIn; d.isBefore(checkOut); d = d.plusDays(1)) {
            DailyRate rate = new DailyRate();
            rate.setId(new DailyRateId(room.getId(), d));
            rate.setRoom(room);
            rate.setPrice(pricePerNight);
            rate.setMinStay(1);
            rate.setClosed(false);
            dailyRateRepository.save(rate);
        }
    }

    protected void clearAll() {
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    protected String bearer(String token) {
        return "Bearer " + token;
    }
}
