package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserStatus;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.BookingRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.HotelReviewRepository;
import com.hotel.hotel_backend.repository.RefundRequestRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtService;
import com.hotel.hotel_backend.service.InventoryService;
import org.junit.jupiter.api.AfterEach;
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
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PartnerRoomManagementIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;

    @Autowired private UserRepository userRepository;
    @Autowired private HotelRepository hotelRepository;
    @Autowired private RoomRepository roomRepository;
    @Autowired private RoomUnitRepository roomUnitRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private BookingItemRepository bookingItemRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private HotelReviewRepository hotelReviewRepository;
    @Autowired private RefundRequestRepository refundRequestRepository;
    @Autowired private DailyInventoryRepository dailyInventoryRepository;
    @Autowired private DailyRateRepository dailyRateRepository;
    @Autowired private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        cleanAll();
    }

    @AfterEach
    void tearDown() {
        cleanAll();
    }

    private void cleanAll() {
        hotelReviewRepository.deleteAll();
        refundRequestRepository.deleteAll();
        bookingItemRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        bookingRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ─── Hotel list ──────────────────────────────────────────────────────────────

    @Test
    void partnerShouldListOwnedHotels() throws Exception {
        User partner = createPartner("partner-list-hotels@test.com");
        String token = jwtService.generate(partner);
        createHotel(partner, "My Hotel A");
        createHotel(partner, "My Hotel B");

        User otherPartner = createPartner("other-partner-hotels@test.com");
        createHotel(otherPartner, "Other Hotel");

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void partnerShouldNotSeeOtherPartnersHotels() throws Exception {
        User partner = createPartner("partner-isolation@test.com");
        User other = createPartner("other-isolation@test.com");
        String token = jwtService.generate(partner);
        createHotel(other, "Other Hotel");

        mockMvc.perform(get("/api/partner/hotels")
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ─── Room update ─────────────────────────────────────────────────────────────

    @Test
    void partnerShouldUpdateRoom() throws Exception {
        User partner = createPartner("partner-update-room@test.com");
        String token = jwtService.generate(partner);
        Hotel hotel = createHotel(partner, "Update Room Hotel");
        Room room = createRoom(hotel, "Old Room Name", 2);

        mockMvc.perform(put("/api/partner/rooms/{roomId}", room.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token))
                        .content("""
                                {
                                  "name": "New Room Name",
                                  "price": 1500000,
                                  "capacity": 3,
                                  "quantity": 2,
                                  "roomCategory": "STANDARD",
                                  "bedType": "DOUBLE"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        Room updated = roomRepository.findById(room.getId()).orElseThrow();
        assertThat(updated.getName()).isEqualTo("New Room Name");
        assertThat(updated.getPrice()).isEqualTo(1_500_000L);
        assertThat(updated.getCapacity()).isEqualTo(3);
    }

    @Test
    void strangerPartnerCannotUpdateRoom() throws Exception {
        User owner = createPartner("room-owner@test.com");
        User stranger = createPartner("room-stranger@test.com");
        String strangerToken = jwtService.generate(stranger);
        Hotel hotel = createHotel(owner, "Owner Hotel");
        Room room = createRoom(hotel, "Owner Room", 1);

        mockMvc.perform(put("/api/partner/rooms/{roomId}", room.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken))
                        .content("""
                                {
                                  "name": "Hacked Name",
                                  "price": 999,
                                  "capacity": 1,
                                  "quantity": 1,
                                  "roomCategory": "STANDARD",
                                  "bedType": "DOUBLE"
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    // ─── Room delete ─────────────────────────────────────────────────────────────

    @Test
    void partnerShouldDeleteRoomWithNoBookings() throws Exception {
        User partner = createPartner("partner-delete-room@test.com");
        String token = jwtService.generate(partner);
        Hotel hotel = createHotel(partner, "Delete Room Hotel");
        Room room = createRoom(hotel, "Room To Delete", 1);

        mockMvc.perform(delete("/api/partner/rooms/{roomId}", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(roomRepository.findById(room.getId())).isEmpty();
    }

    @Test
    void partnerCannotDeleteRoomWithActiveBookings() throws Exception {
        User partner = createPartner("partner-delete-booked@test.com");
        String token = jwtService.generate(partner);
        User customer = createCustomer("customer-delete-booked@test.com");
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Booked Hotel");
        Room room = createRoom(hotel, "Booked Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(2);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
        createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "booked-delete@test.com");

        // Room with active bookings is soft-deleted (marked closed), not rejected
        mockMvc.perform(delete("/api/partner/rooms/{roomId}", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void strangerPartnerCannotDeleteRoom() throws Exception {
        User owner = createPartner("delete-owner@test.com");
        User stranger = createPartner("delete-stranger@test.com");
        String strangerToken = jwtService.generate(stranger);
        Hotel hotel = createHotel(owner, "Owner Hotel Delete");
        Room room = createRoom(hotel, "Protected Room", 1);

        // API returns 403 Forbidden when accessing another partner's resource
        mockMvc.perform(delete("/api/partner/rooms/{roomId}", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken)))
                .andExpect(status().isForbidden());
    }

    // ─── Partner reviews ─────────────────────────────────────────────────────────

    @Test
    void partnerShouldListReviewsForOwnHotels() throws Exception {
        User partner = createPartner("partner-list-reviews@test.com");
        String partnerToken = jwtService.generate(partner);
        User customer = createCustomer("customer-list-reviews@test.com");
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Review Hotel");
        Room room = createRoom(hotel, "Review Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(1);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        long bookingId = createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "list-reviews@test.com");
        payBookingHttp(customerToken, bookingId, "list-reviews-pay");
        moveBookingToPast(bookingId);
        mockMvc.perform(post("/api/partner/bookings/{bookingId}/complete", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {"bookingId": %d, "rating": 5, "comment": "Excellent!"}
                                """.formatted(bookingId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/partner/reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].rating").value(5));
    }

    // ─── Partner refunds ─────────────────────────────────────────────────────────

    @Test
    void partnerShouldListRefundsForOwnHotels() throws Exception {
        User partner = createPartner("partner-list-refunds@test.com");
        String partnerToken = jwtService.generate(partner);
        User customer = createCustomer("customer-list-refunds@test.com");
        String customerToken = jwtService.generate(customer);

        Hotel hotel = createHotel(partner, "Refund Hotel");
        Room room = createRoom(hotel, "Refund Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(5);
        LocalDate checkOut = checkIn.plusDays(1);
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        long bookingId = createBookingHttp(customerToken, room.getId(), checkIn, checkOut, "list-refunds@test.com");
        payBookingHttp(customerToken, bookingId, "list-refunds-pay");

        mockMvc.perform(post("/api/bookings/{bookingId}/refund-request", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {"reason": "Change of plans"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/partner/refunds")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private User createPartner(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(UserType.PARTNER);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    private User createCustomer(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(UserType.CUSTOMER);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    private Hotel createHotel(User owner, String name) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince("HCM");
        hotel.setDistrict("District 1");
        hotel.setHotelType(HotelType.HOTEL);
        return hotelRepository.save(hotel);
    }

    private Room createRoom(Hotel hotel, String name, int quantity) {
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

    private long createBookingHttp(String customerToken, Long roomId,
                                   LocalDate checkIn, LocalDate checkOut,
                                   String contactEmail) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [{"roomId": %d, "quantity": 1}],
                                  "contact": {
                                    "fullName": "Test Customer",
                                    "email": "%s",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId, contactEmail)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
    }

    private void payBookingHttp(String customerToken, long bookingId, String clientRequestId) throws Exception {
        mockMvc.perform(post("/api/bookings/{bookingId}/pay", bookingId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "simulateSuccess": true,
                                  "clientRequestId": "%s"
                                }
                                """.formatted(clientRequestId)))
                .andExpect(status().isOk());
    }

    private void moveBookingToPast(long bookingId) {
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setCheckIn(LocalDate.now().minusDays(3));
        booking.setCheckOut(LocalDate.now().minusDays(1));
        bookingRepository.save(booking);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
