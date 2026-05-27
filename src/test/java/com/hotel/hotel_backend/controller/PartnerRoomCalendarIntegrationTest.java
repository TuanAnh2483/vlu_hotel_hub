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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PartnerRoomCalendarIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HotelRepository hotelRepository;

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private RoomUnitRepository roomUnitRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private HotelReviewRepository hotelReviewRepository;

    @Autowired
    private InventoryService inventoryService;

    private LocalDate from;
    private LocalDate to;

    @BeforeEach
    void setUp() {
        hotelReviewRepository.deleteAll();
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();

        from = LocalDate.now().plusDays(10);
        to = from.plusDays(1);
    }

    @Test
    void partnerShouldReadDefaultCalendarForOwnedRoom() throws Exception {
        String partnerToken = createToken("partner-calendar-default@test.com", UserType.PARTNER);
        User owner = userRepository.findByEmail("partner-calendar-default@test.com").orElseThrow();

        Hotel hotel = createHotel(owner, "Calendar Default Hotel");
        Room room = createRoom(hotel, "Calendar Default Room", 3);
        inventoryService.initInventory(room.getId(), from, to.plusDays(1), room.getQuantity());

        mockMvc.perform(get("/api/partner/rooms/{roomId}/calendar", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .param("from", from.toString())
                        .param("to", to.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.roomId").value(room.getId()))
                .andExpect(jsonPath("$.data.basePrice").value(1_000_000))
                .andExpect(jsonPath("$.data.defaultQuantity").value(3))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].date").value(from.toString()))
                .andExpect(jsonPath("$.data.items[0].price").value(1_000_000))
                .andExpect(jsonPath("$.data.items[0].closed").value(false))
                .andExpect(jsonPath("$.data.items[0].availableRooms").value(3))
                .andExpect(jsonPath("$.data.items[0].blockedRooms").value(0))
                .andExpect(jsonPath("$.data.items[0].sellableRooms").value(3))
                .andExpect(jsonPath("$.data.items[0].hasCustomRate").value(false))
                .andExpect(jsonPath("$.data.items[0].hasInventoryRow").value(true));
    }

    @Test
    void partnerShouldUpsertCalendarAndAffectPublicAvailability() throws Exception {
        String partnerToken = createToken("partner-calendar-upsert@test.com", UserType.PARTNER);
        User owner = userRepository.findByEmail("partner-calendar-upsert@test.com").orElseThrow();

        Hotel hotel = createHotel(owner, "Calendar Upsert Hotel");
        Room room = createRoom(hotel, "Calendar Upsert Room", 3);
        inventoryService.initInventory(room.getId(), from, to.plusDays(1), room.getQuantity());

        mockMvc.perform(put("/api/partner/rooms/{roomId}/calendar", room.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "startDate": "%s",
                                  "endDate": "%s",
                                  "price": 1500000,
                                  "minStay": 2,
                                  "closed": true,
                                  "availableRooms": 2
                                }
                                """.formatted(from, to)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].price").value(1_500_000))
                .andExpect(jsonPath("$.data.items[0].minStay").value(2))
                .andExpect(jsonPath("$.data.items[0].closed").value(true))
                .andExpect(jsonPath("$.data.items[0].availableRooms").value(2))
                .andExpect(jsonPath("$.data.items[0].hasCustomRate").value(true))
                .andExpect(jsonPath("$.data.items[1].closed").value(true));

        mockMvc.perform(get("/api/hotels/{hotelId}/available-rooms", hotel.getId())
                        .param("checkIn", from.toString())
                        .param("checkOut", to.plusDays(1).toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void partnerShouldNotReadCalendarOfAnotherPartnersRoom() throws Exception {
        String ownerToken = createToken("partner-calendar-owner@test.com", UserType.PARTNER);
        createToken("partner-calendar-other@test.com", UserType.PARTNER);

        User owner = userRepository.findByEmail("partner-calendar-owner@test.com").orElseThrow();
        User otherPartner = userRepository.findByEmail("partner-calendar-other@test.com").orElseThrow();

        Hotel hotel = createHotel(owner, "Calendar Private Hotel");
        Room room = createRoom(hotel, "Calendar Private Room", 2);
        inventoryService.initInventory(room.getId(), from, to.plusDays(1), room.getQuantity());

        mockMvc.perform(get("/api/partner/rooms/{roomId}/calendar", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(jwtService.generate(otherPartner)))
                        .param("from", from.toString())
                        .param("to", to.toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void partnerShouldRejectCalendarUpdateWhenAvailableRoomsDropBelowBlockedRooms() throws Exception {
        String partnerToken = createToken("partner-calendar-blocked@test.com", UserType.PARTNER);
        String customerToken = createToken("customer-calendar-blocked@test.com", UserType.CUSTOMER);
        User owner = userRepository.findByEmail("partner-calendar-blocked@test.com").orElseThrow();

        Hotel hotel = createHotel(owner, "Calendar Blocked Hotel");
        Room room = createRoom(hotel, "Calendar Blocked Room", 2);
        inventoryService.initInventory(room.getId(), from, to.plusDays(2), room.getQuantity());

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [
                                    {
                                      "roomId": %d,
                                      "quantity": 1
                                    }
                                  ],
                                  "contact": {
                                    "fullName": "Calendar Customer",
                                    "email": "customer-calendar-blocked@test.com",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(from, to.plusDays(1), room.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"));

        mockMvc.perform(put("/api/partner/rooms/{roomId}/calendar", room.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "startDate": "%s",
                                  "endDate": "%s",
                                  "availableRooms": 0
                                }
                                """.formatted(from, from)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    private String createToken(String email, UserType userType) {
        return jwtService.generate(createUser(email, userType));
    }

    private User createUser(String email, UserType userType) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setUserType(userType);
        user.setStatus(UserStatus.ACTIVE);
        return userRepository.save(user);
    }

    private Hotel createHotel(User owner, String name) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince("Bangkok");
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

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
