package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomAmenity;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PartnerHotelRoomIntegrationTest {

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
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

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
    void partnerShouldCreateHotelAndRoomWithTypedCatalogFields() throws Exception {
        // Contract:
        // Partner create flow khong con gui free-text cho hotelType/roomType dimensions,
        // ma gui enum catalog de backend luu truc tiep va search co the filter duoc.
        String partnerToken = createPartnerToken("partner-type@test.com");

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Catalog Resort",
                                  "address": "Beach Road",
                                  "district": "District 1",
                                  "province": "Bangkok",
                                  "description": "Type-enabled hotel",
                                  "hotelType": "RESORT",
                                  "amenities": ["POOL", "PARKING"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Catalog Resort"))
                .andExpect(jsonPath("$.data.hotelType").value("RESORT"))
                .andExpect(jsonPath("$.data.amenities[0]").exists())
                .andReturn();

        long hotelId = readId(hotelResult, "data", "id");

        mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Twin Suite Room",
                                  "capacity": 2,
                                  "quantity": 3,
                                  "price": 2500000,
                                  "roomCategory": "SUITE",
                                  "bedType": "TWIN",
                                  "amenities": ["BALCONY", "BATHTUB"]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Twin Suite Room"))
                .andExpect(jsonPath("$.data.roomCategory").value("SUITE"))
                .andExpect(jsonPath("$.data.bedType").value("TWIN"));

        var hotel = hotelRepository.findById(hotelId).orElseThrow();
        assertThat(hotel.getHotelType()).isEqualTo(HotelType.RESORT);
        assertThat(hotel.getAmenities()).containsExactlyInAnyOrder(HotelAmenity.POOL, HotelAmenity.PARKING);

        var room = roomRepository.findByHotelId(hotelId).get(0);
        assertThat(room.getRoomCategory()).isEqualTo(RoomCategory.SUITE);
        assertThat(room.getBedType()).isEqualTo(BedType.TWIN);
        assertThat(room.getAmenities()).containsExactlyInAnyOrder(RoomAmenity.BALCONY, RoomAmenity.BATHTUB);
    }

    private String createPartnerToken(String email) {
        User partner = new User();
        partner.setEmail(email);
        partner.setPasswordHash("hash-partner");
        partner.setUserType(UserType.PARTNER);
        partner.setStatus(UserStatus.ACTIVE);
        partner = userRepository.save(partner);
        return jwtService.generate(partner);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private long readId(MvcResult result, String parentField, String idField) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path(parentField).path(idField).asLong();
    }
}
