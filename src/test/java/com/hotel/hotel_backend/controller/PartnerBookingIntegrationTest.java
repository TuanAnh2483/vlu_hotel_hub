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
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.PaymentTransactionRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PartnerBookingIntegrationTest {

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
    private BookingRepository bookingRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        bookingItemRepository.deleteAll();
        bookingRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void partnerShouldListOwnedBookingsWithFilters() throws Exception {
        User partnerOne = createUser("partner-bookings-1@test.com", UserType.PARTNER);
        User partnerTwo = createUser("partner-bookings-2@test.com", UserType.PARTNER);
        String partnerOneToken = jwtService.generate(partnerOne);
        String customerToken = jwtService.generate(createUser("customer-partner-list@test.com", UserType.CUSTOMER));

        Hotel partnerOneHotelA = createHotel(partnerOne, "Partner One Hotel A");
        Hotel partnerOneHotelB = createHotel(partnerOne, "Partner One Hotel B");
        Hotel partnerTwoHotel = createHotel(partnerTwo, "Partner Two Hotel");

        Room roomA = createRoom(partnerOneHotelA, "Partner One Room A", 2);
        Room roomB = createRoom(partnerOneHotelB, "Partner One Room B", 2);
        Room roomC = createRoom(partnerTwoHotel, "Partner Two Room", 2);

        LocalDate firstCheckIn = LocalDate.now().plusDays(1);
        LocalDate firstCheckOut = firstCheckIn.plusDays(2);
        LocalDate secondCheckIn = LocalDate.now().plusDays(5);
        LocalDate secondCheckOut = secondCheckIn.plusDays(2);

        initInventory(roomA, firstCheckIn, firstCheckOut);
        initInventory(roomB, secondCheckIn, secondCheckOut);
        initInventory(roomC, firstCheckIn, firstCheckOut);

        long bookingA = createBooking(customerToken, roomA.getId(), firstCheckIn, firstCheckOut, "customer-a@test.com");
        long bookingB = createBooking(customerToken, roomB.getId(), secondCheckIn, secondCheckOut, "customer-b@test.com");
        long bookingC = createBooking(customerToken, roomC.getId(), firstCheckIn, firstCheckOut, "customer-c@test.com");

        payBooking(customerToken, bookingB, "partner-booking-list-pay-1");

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalItems").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(partnerOneHotelB.getId()))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"))
                .andExpect(jsonPath("$.data.items[1].bookingId").value(bookingA))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(partnerOneHotelA.getId()))
                .andExpect(jsonPath("$.data.items[1].status").value("PENDING_PAYMENT"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("hotelId", String.valueOf(partnerOneHotelA.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingA))
                .andExpect(jsonPath("$.data.items[0].hotelName").value("Partner One Hotel A"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("status", "CONFIRMED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB))
                .andExpect(jsonPath("$.data.items[0].status").value("CONFIRMED"));

        mockMvc.perform(get("/api/partner/bookings")
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerOneToken))
                        .param("checkInFrom", secondCheckIn.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.items[0].bookingId").value(bookingB));

        assertThat(bookingRepository.findById(bookingC)).isPresent();
    }

    @Test
    void partnerShouldGetOwnedBookingDetail() throws Exception {
        User partner = createUser("partner-booking-detail@test.com", UserType.PARTNER);
        String partnerToken = jwtService.generate(partner);
        String customerToken = jwtService.generate(createUser("customer-partner-detail@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Partner Detail Hotel");
        Room room = createRoom(hotel, "Partner Detail Room", 2);
        LocalDate checkIn = LocalDate.now().plusDays(1);
        LocalDate checkOut = checkIn.plusDays(2);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "partner-detail-customer@test.com");

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.bookingId").value(bookingId))
                .andExpect(jsonPath("$.data.hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.hotelName").value("Partner Detail Hotel"))
                .andExpect(jsonPath("$.data.customerId").exists())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andExpect(jsonPath("$.data.totalPrice").value(2_000_000.0))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].roomTypeId").value(room.getId()))
                .andExpect(jsonPath("$.data.contact.fullName").value("Partner Detail Customer"))
                .andExpect(jsonPath("$.data.contact.email").value("partner-detail-customer@test.com"));
    }

    @Test
    void partnerBookingDetailShouldReturnNotFoundForOtherPartnersBooking() throws Exception {
        User ownerPartner = createUser("partner-booking-owner@test.com", UserType.PARTNER);
        User strangerPartner = createUser("partner-booking-stranger@test.com", UserType.PARTNER);
        String strangerToken = jwtService.generate(strangerPartner);
        String customerToken = jwtService.generate(createUser("customer-partner-other@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(ownerPartner, "Owner Partner Hotel");
        Room room = createRoom(hotel, "Owner Partner Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(2);
        LocalDate checkOut = checkIn.plusDays(2);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "partner-other-customer@test.com");

        mockMvc.perform(get("/api/partner/bookings/{bookingId}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
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

    private void initInventory(Room room, LocalDate checkIn, LocalDate checkOut) {
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
    }

    private long createBooking(String customerToken, Long roomId, LocalDate checkIn, LocalDate checkOut, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/bookings")
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
                                    "fullName": "Partner Detail Customer",
                                    "email": "%s",
                                    "phone": "0123456789"
                                  }
                                }
                                """.formatted(checkIn, checkOut, roomId, email)))
                .andExpect(status().isOk())
                .andReturn();

        return readBookingId(result);
    }

    private void payBooking(String customerToken, long bookingId, String clientRequestId) throws Exception {
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

    private long readBookingId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
