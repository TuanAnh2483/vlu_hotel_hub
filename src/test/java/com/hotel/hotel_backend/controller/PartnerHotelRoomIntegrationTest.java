package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.config.UploadStorageProperties;
import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomAmenity;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Comparator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
    private RoomUnitRepository roomUnitRepository;

    @Autowired
    private DailyInventoryRepository dailyInventoryRepository;

    @Autowired
    private DailyRateRepository dailyRateRepository;

    @Autowired
    private BookingItemRepository bookingItemRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PaymentTransactionRepository paymentTransactionRepository;

    @Autowired
    private HotelReviewRepository hotelReviewRepository;

    @Autowired
    private UploadStorageProperties uploadStorageProperties;

    @BeforeEach
    void setUp() throws IOException {
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
        cleanUploadStorage();
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
                                  "amenities": ["POOL", "PARKING"],
                                  "imageUrls": [
                                    "https://cdn.example.com/hotels/resort-cover.jpg",
                                    "https://cdn.example.com/hotels/resort-lobby.jpg"
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Catalog Resort"))
                .andExpect(jsonPath("$.data.hotelType").value("RESORT"))
                .andExpect(jsonPath("$.data.amenities[0]").exists())
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://cdn.example.com/hotels/resort-cover.jpg"))
                .andExpect(jsonPath("$.data.imageUrls[0]").value("https://cdn.example.com/hotels/resort-cover.jpg"))
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
                                  "amenities": ["BALCONY", "BATHTUB"],
                                  "imageUrls": [
                                    "https://cdn.example.com/rooms/twin-suite-1.jpg",
                                    "https://cdn.example.com/rooms/twin-suite-2.jpg"
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Twin Suite Room"))
                .andExpect(jsonPath("$.data.roomCategory").value("SUITE"))
                .andExpect(jsonPath("$.data.bedType").value("TWIN"))
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://cdn.example.com/rooms/twin-suite-1.jpg"))
                .andExpect(jsonPath("$.data.imageUrls[0]").value("https://cdn.example.com/rooms/twin-suite-1.jpg"));

        var hotel = hotelRepository.findById(hotelId).orElseThrow();
        assertThat(hotel.getHotelType()).isEqualTo(HotelType.RESORT);
        assertThat(hotel.getAmenities()).containsExactlyInAnyOrder(HotelAmenity.POOL, HotelAmenity.PARKING);
        assertThat(hotel.getImageUrls()).containsExactly(
                "https://cdn.example.com/hotels/resort-cover.jpg",
                "https://cdn.example.com/hotels/resort-lobby.jpg"
        );
        assertThat(hotel.getCoverImageUrl()).isEqualTo("https://cdn.example.com/hotels/resort-cover.jpg");

        var room = roomRepository.findByHotelId(hotelId).get(0);
        assertThat(room.getRoomCategory()).isEqualTo(RoomCategory.SUITE);
        assertThat(room.getBedType()).isEqualTo(BedType.TWIN);
        assertThat(room.getAmenities()).containsExactlyInAnyOrder(RoomAmenity.BALCONY, RoomAmenity.BATHTUB);
        assertThat(room.getImageUrls()).containsExactly(
                "https://cdn.example.com/rooms/twin-suite-1.jpg",
                "https://cdn.example.com/rooms/twin-suite-2.jpg"
        );
        assertThat(room.getCoverImageUrl()).isEqualTo("https://cdn.example.com/rooms/twin-suite-1.jpg");
    }

    @Test
    void partnerCreatedHotelShouldAppearInSearchWithNormalizedLocationQuery() throws Exception {
        String partnerToken = createPartnerToken("partner-search@test.com");

        MvcResult hotelResult = mockMvc.perform(post("/api/partner/hotels")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Central Saigon Hotel",
                                  "address": " 1 Nguyen Hue ",
                                  "district": " Quận 1 ",
                                  "province": " TP. Hồ Chí Minh ",
                                  "description": " Search-ready hotel ",
                                  "hotelType": "HOTEL",
                                  "amenities": ["WIFI"],
                                  "imageUrls": [
                                    "https://cdn.example.com/hotels/search-cover.jpg"
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.province").value("TP. Hồ Chí Minh"))
                .andExpect(jsonPath("$.data.district").value("Quận 1"))
                .andReturn();

        long hotelId = readId(hotelResult, "data", "id");

        mockMvc.perform(post("/api/partner/hotels/{hotelId}/rooms", hotelId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .content("""
                                {
                                  "name": "Searchable Room",
                                  "capacity": 2,
                                  "quantity": 2,
                                  "price": 1800000,
                                  "roomCategory": "DELUXE",
                                  "bedType": "DOUBLE",
                                  "amenities": ["BALCONY"],
                                  "imageUrls": [
                                    "https://cdn.example.com/rooms/searchable-room.jpg"
                                  ]
                                }
                                """))
                .andExpect(status().isOk());

        LocalDate checkIn = LocalDate.now().plusDays(7);
        LocalDate checkOut = checkIn.plusDays(2);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "ho chi minh")
                        .param("district", "q1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotelId))
                .andExpect(jsonPath("$.data.items[0].name").value("Central Saigon Hotel"))
                .andExpect(jsonPath("$.data.items[0].province").value("TP. Hồ Chí Minh"))
                .andExpect(jsonPath("$.data.items[0].district").value("Quận 1"))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(3_600_000));
    }

    @Test
    void partnerShouldUploadHotelAndRoomImagesAsPublicFiles() throws Exception {
        User partner = createPartner("partner-upload@test.com");
        String partnerToken = jwtService.generate(partner);

        Hotel hotel = new Hotel();
        hotel.setOwner(partner);
        hotel.setName("Uploaded Hotel");
        hotel.setAddress("Upload Street");
        hotel.setDistrict("District 1");
        hotel.setProvince("Bangkok");
        hotel = hotelRepository.save(hotel);

        Room room = new Room();
        room.setHotel(hotel);
        room.setName("Uploaded Room");
        room.setCapacity(2);
        room.setQuantity(1);
        room.setPrice(1_500_000L);
        room = roomRepository.save(room);

        MockMultipartFile hotelImage = new MockMultipartFile(
                "files",
                "hotel-cover.png",
                "image/png",
                "hotel-image-bytes".getBytes(StandardCharsets.UTF_8)
        );

        MvcResult hotelUploadResult = mockMvc.perform(multipart("/api/partner/hotels/{hotelId}/images", hotel.getId())
                        .file(hotelImage)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl", containsString("/uploads/hotels/" + hotel.getId() + "/")))
                .andExpect(jsonPath("$.data.imageUrls.length()").value(1))
                .andExpect(jsonPath("$.data.imageUrls[0]", containsString("/uploads/hotels/" + hotel.getId() + "/")))
                .andReturn();

        String hotelImageUrl = readFirstImageUrl(hotelUploadResult);

        mockMvc.perform(get(hotelImageUrl))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("image/png")))
                .andExpect(content().bytes("hotel-image-bytes".getBytes(StandardCharsets.UTF_8)));

        MockMultipartFile roomImage = new MockMultipartFile(
                "files",
                "room-cover.png",
                "image/png",
                "room-image-bytes".getBytes(StandardCharsets.UTF_8)
        );

        MvcResult roomUploadResult = mockMvc.perform(multipart("/api/partner/rooms/{roomId}/images", room.getId())
                        .file(roomImage)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl", containsString("/uploads/rooms/" + room.getId() + "/")))
                .andExpect(jsonPath("$.data.imageUrls.length()").value(1))
                .andExpect(jsonPath("$.data.imageUrls[0]", containsString("/uploads/rooms/" + room.getId() + "/")))
                .andReturn();

        String roomImageUrl = readFirstImageUrl(roomUploadResult);

        mockMvc.perform(get(roomImageUrl))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("image/png")))
                .andExpect(content().bytes("room-image-bytes".getBytes(StandardCharsets.UTF_8)));

        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getImageUrls())
                .containsExactly(hotelImageUrl);
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getCoverImageUrl())
                .isEqualTo(hotelImageUrl);
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getImageUrls())
                .containsExactly(roomImageUrl);
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getCoverImageUrl())
                .isEqualTo(roomImageUrl);
    }

    @Test
    void partnerShouldSetCoverAndDeleteUploadedHotelAndRoomImages() throws Exception {
        User partner = createPartner("partner-cover-delete@test.com");
        String partnerToken = jwtService.generate(partner);

        Hotel hotel = new Hotel();
        hotel.setOwner(partner);
        hotel.setName("Cover Hotel");
        hotel.setAddress("Cover Street");
        hotel.setDistrict("District 1");
        hotel.setProvince("Bangkok");
        hotel = hotelRepository.save(hotel);

        Room room = new Room();
        room.setHotel(hotel);
        room.setName("Cover Room");
        room.setCapacity(2);
        room.setQuantity(1);
        room.setPrice(1_700_000L);
        room = roomRepository.save(room);

        MockMultipartFile hotelImageA = new MockMultipartFile(
                "files",
                "hotel-a.png",
                "image/png",
                "hotel-a".getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile hotelImageB = new MockMultipartFile(
                "files",
                "hotel-b.png",
                "image/png",
                "hotel-b".getBytes(StandardCharsets.UTF_8)
        );

        MvcResult hotelUploadResult = mockMvc.perform(multipart("/api/partner/hotels/{hotelId}/images", hotel.getId())
                        .file(hotelImageA)
                        .file(hotelImageB)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imageUrls.length()").value(2))
                .andReturn();

        String hotelImageUrlA = readImageUrl(hotelUploadResult, 0);
        String hotelImageUrlB = readImageUrl(hotelUploadResult, 1);

        mockMvc.perform(put("/api/partner/hotels/{hotelId}/cover-image", hotel.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "imageUrl": "%s"
                                }
                                """.formatted(hotelImageUrlB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(hotelImageUrlB));

        mockMvc.perform(delete("/api/partner/hotels/{hotelId}/images", hotel.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .param("imageUrl", hotelImageUrlB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(hotelImageUrlA))
                .andExpect(jsonPath("$.data.imageUrls.length()").value(1))
                .andExpect(jsonPath("$.data.imageUrls[0]").value(hotelImageUrlA));

        mockMvc.perform(get(hotelImageUrlB))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(hotelImageUrlA))
                .andExpect(status().isOk())
                .andExpect(content().bytes("hotel-a".getBytes(StandardCharsets.UTF_8)));

        MockMultipartFile roomImageA = new MockMultipartFile(
                "files",
                "room-a.png",
                "image/png",
                "room-a".getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile roomImageB = new MockMultipartFile(
                "files",
                "room-b.png",
                "image/png",
                "room-b".getBytes(StandardCharsets.UTF_8)
        );

        MvcResult roomUploadResult = mockMvc.perform(multipart("/api/partner/rooms/{roomId}/images", room.getId())
                        .file(roomImageA)
                        .file(roomImageB)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imageUrls.length()").value(2))
                .andReturn();

        String roomImageUrlA = readImageUrl(roomUploadResult, 0);
        String roomImageUrlB = readImageUrl(roomUploadResult, 1);

        mockMvc.perform(put("/api/partner/rooms/{roomId}/cover-image", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "imageUrl": "%s"
                                }
                                """.formatted(roomImageUrlB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(roomImageUrlB));

        mockMvc.perform(delete("/api/partner/rooms/{roomId}/images", room.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken))
                        .param("imageUrl", roomImageUrlB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImageUrl").value(roomImageUrlA))
                .andExpect(jsonPath("$.data.imageUrls.length()").value(1))
                .andExpect(jsonPath("$.data.imageUrls[0]").value(roomImageUrlA));

        mockMvc.perform(get(roomImageUrlB))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(roomImageUrlA))
                .andExpect(status().isOk())
                .andExpect(content().bytes("room-a".getBytes(StandardCharsets.UTF_8)));

        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getCoverImageUrl()).isEqualTo(hotelImageUrlA);
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getCoverImageUrl()).isEqualTo(roomImageUrlA);
    }

    private String createPartnerToken(String email) {
        return jwtService.generate(createPartner(email));
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private long readId(MvcResult result, String parentField, String idField) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path(parentField).path(idField).asLong();
    }

    private String readFirstImageUrl(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("imageUrls").get(0).asText();
    }

    private String readImageUrl(MvcResult result, int index) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("imageUrls").get(index).asText();
    }

    private User createPartner(String email) {
        User partner = new User();
        partner.setEmail(email);
        partner.setPasswordHash("hash-partner");
        partner.setUserType(UserType.PARTNER);
        partner.setStatus(UserStatus.ACTIVE);
        return userRepository.save(partner);
    }

    private void cleanUploadStorage() throws IOException {
        Path storageRoot = Paths.get(uploadStorageProperties.getStorageRoot()).toAbsolutePath().normalize();
        if (!Files.exists(storageRoot)) {
            return;
        }

        try (var paths = Files.walk(storageRoot)) {
            paths.sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ex) {
                            throw new RuntimeException(ex);
                        }
                    });
        }
    }
}
