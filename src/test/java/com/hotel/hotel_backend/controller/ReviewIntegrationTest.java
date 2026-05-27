package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelReview;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReviewIntegrationTest {

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
    private HotelReviewRepository hotelReviewRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private InventoryService inventoryService;

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
    }

    @Test
    void customerShouldCreateUpdateDeleteReviewAndRefreshHotelRating() throws Exception {
        User partner = createUser("partner-review-crud@test.com", UserType.PARTNER);
        String customerToken = jwtService.generate(createUser("customer-review-crud@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Review CRUD Hotel");
        Room room = createRoom(hotel, "Review CRUD Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(3);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "review-crud@test.com");
        payBooking(customerToken, bookingId, "review-crud-pay");
        markBookingCompleted(bookingId);

        MvcResult createResult = mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 5,
                                  "comment": "Great stay"
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(5))
                .andExpect(jsonPath("$.data.comment").value("Great stay"))
                .andReturn();

        long reviewId = readReviewId(createResult);
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingAvg())
                .isEqualByComparingTo("5.00");
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingCount()).isEqualTo(1);

        mockMvc.perform(put("/api/reviews/{reviewId}", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "rating": 4,
                                  "comment": "Actually good"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(4))
                .andExpect(jsonPath("$.data.comment").value("Actually good"));

        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingAvg())
                .isEqualByComparingTo("4.00");
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingCount()).isEqualTo(1);

        mockMvc.perform(delete("/api/reviews/{reviewId}", reviewId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(hotelReviewRepository.findById(reviewId)).isEmpty();
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingAvg())
                .isEqualByComparingTo("0");
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingCount()).isEqualTo(0);
    }

    @Test
    void customerShouldRejectReviewWhenBookingIsNotCompleted() throws Exception {
        User partner = createUser("partner-review-conflict@test.com", UserType.PARTNER);
        String customerToken = jwtService.generate(createUser("customer-review-conflict@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Review Conflict Hotel");
        Room room = createRoom(hotel, "Review Conflict Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(4);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "review-conflict@test.com");
        payBooking(customerToken, bookingId, "review-conflict-pay");

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 5,
                                  "comment": "Too early"
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void customerShouldCreateReviewWithoutComment() throws Exception {
        User partner = createUser("partner-review-no-comment@test.com", UserType.PARTNER);
        String customerToken = jwtService.generate(createUser("customer-review-no-comment@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(partner, "Review No Comment Hotel");
        Room room = createRoom(hotel, "Review No Comment Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(3);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "review-no-comment@test.com");
        payBooking(customerToken, bookingId, "review-no-comment-pay");
        markBookingCompleted(bookingId);

        MvcResult createResult = mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 5,
                                  "comment": null
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(5))
                .andExpect(jsonPath("$.data.comment").value(nullValue()))
                .andReturn();

        long reviewId = readReviewId(createResult);
        HotelReview review = hotelReviewRepository.findById(reviewId).orElseThrow();
        assertThat(review.getComment()).isNull();
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getRatingCount()).isEqualTo(1);
    }

    @Test
    void partnerShouldListReplyAndPublicShouldSeeHotelReviews() throws Exception {
        User ownerPartner = createUser("partner-review-owner@test.com", UserType.PARTNER);
        User strangerPartner = createUser("partner-review-stranger@test.com", UserType.PARTNER);
        String ownerToken = jwtService.generate(ownerPartner);
        String strangerToken = jwtService.generate(strangerPartner);
        String customerToken = jwtService.generate(createUser("customer-review-owner@test.com", UserType.CUSTOMER));

        Hotel hotel = createHotel(ownerPartner, "Partner Review Hotel");
        Room room = createRoom(hotel, "Partner Review Room", 1);
        LocalDate checkIn = LocalDate.now().plusDays(2);
        LocalDate checkOut = checkIn.plusDays(1);
        initInventory(room, checkIn, checkOut);

        long bookingId = createBooking(customerToken, room.getId(), checkIn, checkOut, "public-review@test.com");
        payBooking(customerToken, bookingId, "partner-review-pay");
        markBookingCompleted(bookingId);

        long reviewId = readReviewId(mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "bookingId": %d,
                                  "rating": 5,
                                  "comment": "Would stay again"
                                }
                                """.formatted(bookingId)))
                .andExpect(status().isOk())
                .andReturn());

        mockMvc.perform(get("/api/reviews/me")
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].reviewId").value(reviewId))
                .andExpect(jsonPath("$.data[0].hotelName").value("Partner Review Hotel"))
                .andExpect(jsonPath("$.data[0].rating").value(5));

        mockMvc.perform(get("/api/hotels/{hotelId}/reviews", hotel.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].reviewId").value(reviewId))
                .andExpect(jsonPath("$.data[0].reviewerName").value("Partner Detail Customer"))
                .andExpect(jsonPath("$.data[0].partnerReply").doesNotExist());

        mockMvc.perform(get("/api/partner/reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken))
                        .param("hotelId", String.valueOf(hotel.getId()))
                        .param("hasReply", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].reviewId").value(reviewId));

        mockMvc.perform(put("/api/partner/reviews/{reviewId}/reply", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken))
                        .content("""
                                {
                                  "reply": "Thank you, see you next time"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewId").value(reviewId))
                .andExpect(jsonPath("$.data.partnerReply").value("Thank you, see you next time"))
                .andExpect(jsonPath("$.data.partnerRepliedAt").exists());

        mockMvc.perform(get("/api/partner/reviews")
                        .header(HttpHeaders.AUTHORIZATION, bearer(ownerToken))
                        .param("hotelId", String.valueOf(hotel.getId()))
                        .param("hasReply", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].partnerReply").value("Thank you, see you next time"));

        mockMvc.perform(put("/api/partner/reviews/{reviewId}/reply", reviewId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(strangerToken))
                        .content("""
                                {
                                  "reply": "I should not be able to reply"
                                }
                                """))
                .andExpect(status().isNotFound())
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

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("bookingId").asLong();
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

    private void markBookingCompleted(long bookingId) {
        var booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setStatus(BookingStatus.COMPLETED);
        booking.setCheckIn(LocalDate.now().minusDays(3));
        booking.setCheckOut(LocalDate.now().minusDays(1));
        booking.setExpiresAt(null);
        bookingRepository.save(booking);
    }

    private long readReviewId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("reviewId").asLong();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
