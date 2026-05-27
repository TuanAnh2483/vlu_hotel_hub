package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelStatus;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HotelDeleteIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtService jwtService;

    @Autowired UserRepository userRepository;
    @Autowired HotelRepository hotelRepository;
    @Autowired RoomRepository roomRepository;
    @Autowired RoomUnitRepository roomUnitRepository;
    @Autowired DailyInventoryRepository dailyInventoryRepository;
    @Autowired DailyRateRepository dailyRateRepository;
    @Autowired BookingItemRepository bookingItemRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired PaymentTransactionRepository paymentTransactionRepository;
    @Autowired InventoryService inventoryService;

    @BeforeEach
    void setUp() {
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

    // ─── Case 1: Hard-delete ─────────────────────────────────────────────────

    @Test
    void deleteHotel_withNoBookings_shouldHardDeleteHotelRoomsAndInventory() throws Exception {
        // Arrange: tạo hotel + room qua API (room tạo qua API sẽ tự sinh daily_inventory)
        String token = bearer(createPartner("partner-del@test.com"));

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .content("""
                                {
                                  "name": "Hotel To Delete",
                                  "address": "Delete Street",
                                  "district": "District 1",
                                  "province": "Hà Nội",
                                  "hotelType": "HOTEL",
                                  "amenities": ["WIFI"]
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long hotelId = readId(hotelResult, "data", "id");

        MvcResult roomResult = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .content("""
                                {
                                  "name": "Standard Room",
                                  "capacity": 2,
                                  "quantity": 3,
                                  "price": 500000,
                                  "roomCategory": "STANDARD",
                                  "bedType": "DOUBLE",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long roomId = readId(roomResult, "data", "id");

        // Xác nhận inventory đã được tạo
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId,
                LocalDate.now(),
                LocalDate.now().plusDays(365)
        )).isNotEmpty();

        // Act: xóa hotel
        mockMvc.perform(delete("/api/partner/hotels/{id}", hotelId)
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk());

        // Assert: hotel, room, inventory đều bị xóa hoàn toàn
        assertThat(hotelRepository.findById(hotelId)).isEmpty();
        assertThat(roomRepository.findById(roomId)).isEmpty();
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId,
                LocalDate.now(),
                LocalDate.now().plusDays(365)
        )).isEmpty();
    }

    @Test
    void deleteHotel_withNoBookings_multipleRooms_shouldHardDeleteAll() throws Exception {
        // Arrange: 1 hotel, 2 rooms
        String token = bearer(createPartner("partner-multi-room@test.com"));

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .content("""
                                {
                                  "name": "Multi Room Hotel",
                                  "address": "Multi Street",
                                  "district": "District 2",
                                  "province": "Hà Nội",
                                  "hotelType": "HOTEL",
                                  "amenities": []
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long hotelId = readId(hotelResult, "data", "id");

        MvcResult room1Result = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .content("""
                                {"name":"Room A","capacity":2,"quantity":2,"price":400000,
                                 "roomCategory":"STANDARD","bedType":"SINGLE","amenities":[]}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult room2Result = mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, token)
                        .content("""
                                {"name":"Room B","capacity":4,"quantity":1,"price":800000,
                                 "roomCategory":"SUITE","bedType":"DOUBLE","amenities":[]}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long room1Id = readId(room1Result, "data", "id");
        long room2Id = readId(room2Result, "data", "id");

        // Act
        mockMvc.perform(delete("/api/partner/hotels/{id}", hotelId)
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk());

        // Assert: cả 2 rooms và inventory của chúng đều bị xóa
        assertThat(hotelRepository.findById(hotelId)).isEmpty();
        assertThat(roomRepository.findById(room1Id)).isEmpty();
        assertThat(roomRepository.findById(room2Id)).isEmpty();
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room1Id, LocalDate.now(), LocalDate.now().plusDays(365)
        )).isEmpty();
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room2Id, LocalDate.now(), LocalDate.now().plusDays(365)
        )).isEmpty();
    }

    // ─── Case 2: Soft-delete (có booking) ────────────────────────────────────

    @Test
    void deleteHotel_withBooking_shouldSoftDeleteHotelAndRooms() throws Exception {
        // Arrange: tạo hotel + room trực tiếp qua repository, thêm inventory thủ công,
        // sau đó tạo booking item để trigger soft-delete path
        User partner = createPartner("partner-soft@test.com");
        String token = bearer(partner);

        Hotel hotel = new Hotel();
        hotel.setOwner(partner);
        hotel.setName("Soft Delete Hotel");
        hotel.setAddress("Soft Street");
        hotel.setDistrict("District 3");
        hotel.setProvince("Hà Nội");
        hotel = hotelRepository.save(hotel);

        Room room = new Room();
        room.setHotel(hotel);
        room.setName("Booked Room");
        room.setCapacity(2);
        room.setQuantity(2);
        room.setPrice(600_000L);
        room = roomRepository.save(room);
        inventoryService.generateInventory(room);

        // Tạo booking item giả để simulate "có booking"
        createFakeBookingItem(partner, room);

        long hotelId = hotel.getId();
        long roomId = room.getId();

        // Act
        mockMvc.perform(delete("/api/partner/hotels/{id}", hotelId)
                        .header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk());

        // Assert: hotel và room chỉ bị soft-delete (status = INACTIVE), không bị xóa khỏi DB
        assertThat(hotelRepository.findById(hotelId)).isPresent();
        assertThat(hotelRepository.findById(hotelId).get().getStatus()).isEqualTo(HotelStatus.INACTIVE);
        assertThat(roomRepository.findById(roomId)).isPresent();
        assertThat(roomRepository.findById(roomId).get().getStatus()).isEqualTo(RoomStatus.INACTIVE);

        // Inventory vẫn còn (không bị xóa khi soft-delete)
        assertThat(dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId, LocalDate.now(), LocalDate.now().plusDays(365)
        )).isNotEmpty();
    }

    // ─── Case 3: Authorization ────────────────────────────────────────────────

    @Test
    void deleteHotel_byOtherPartner_shouldReturn403() throws Exception {
        // Arrange: partner A tạo hotel, partner B cố xóa
        User partnerA = createPartner("partner-a@test.com");
        User partnerB = createPartner("partner-b@test.com");

        Hotel hotel = new Hotel();
        hotel.setOwner(partnerA);
        hotel.setName("Partner A Hotel");
        hotel.setAddress("A Street");
        hotel.setDistrict("District 1");
        hotel.setProvince("Hà Nội");
        hotel = hotelRepository.save(hotel);

        String tokenB = bearer(partnerB);

        // Act & Assert
        mockMvc.perform(delete("/api/partner/hotels/{id}", hotel.getId())
                        .header(HttpHeaders.AUTHORIZATION, tokenB))
                .andExpect(status().isForbidden());

        // Hotel vẫn còn nguyên
        assertThat(hotelRepository.findById(hotel.getId())).isPresent();
    }

    @Test
    void deleteHotel_withoutToken_shouldReturn401() throws Exception {
        Hotel hotel = new Hotel();
        hotel.setOwner(createPartner("partner-noauth@test.com"));
        hotel.setName("No Auth Hotel");
        hotel.setAddress("X Street");
        hotel.setDistrict("District 1");
        hotel.setProvince("Hà Nội");
        hotel = hotelRepository.save(hotel);

        mockMvc.perform(delete("/api/partner/hotels/{id}", hotel.getId()))
                .andExpect(status().isUnauthorized());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User createPartner(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(UserType.PARTNER);
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private String bearer(User user) {
        return "Bearer " + jwtService.generate(user);
    }

    private long readId(MvcResult result, String parent, String field) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path(parent).path(field).asLong();
    }

    /**
     * Tạo một booking item trực tiếp qua repository để trigger nhánh soft-delete.
     * Booking có checkIn/checkOut; BookingItem chỉ cần room, booking, quantity, price.
     */
    private void createFakeBookingItem(User partner, Room room) {
        User customer = new User();
        customer.setEmail("customer-soft@test.com");
        customer.setPasswordHash("hash");
        customer.setUserType(UserType.CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer = userRepository.save(customer);

        com.hotel.hotel_backend.entity.Booking booking = new com.hotel.hotel_backend.entity.Booking();
        booking.setUserId(customer.getId());
        booking.setCheckIn(LocalDate.now().plusDays(10));
        booking.setCheckOut(LocalDate.now().plusDays(12));
        booking.setStatus(com.hotel.hotel_backend.entity.BookingStatus.CONFIRMED);
        booking.setTotalPrice(600_000L);
        booking = bookingRepository.save(booking);

        com.hotel.hotel_backend.entity.BookingItem item = new com.hotel.hotel_backend.entity.BookingItem();
        item.setBooking(booking);
        item.setRoom(room);
        item.setQuantity(1);
        item.setPrice(600_000L);
        bookingItemRepository.save(item);
    }
}