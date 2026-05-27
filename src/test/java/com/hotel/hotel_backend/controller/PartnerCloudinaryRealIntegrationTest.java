package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.config.UploadStorageProperties;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.Room;
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
import com.hotel.hotel_backend.service.ImageStorageRouterService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "cloudinary-real"})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named = "RUN_CLOUDINARY_IT", matches = "(?i:true|1|yes)")
class PartnerCloudinaryRealIntegrationTest {

    private static final byte[] PNG_BYTES = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z/C/HwAF/gL+q1tFoAAAAABJRU5ErkJggg=="
    );

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
    private UploadStorageProperties uploadStorageProperties;

    @Autowired
    private ImageStorageRouterService imageStorageRouterService;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final List<String> managedImageUrlsToCleanup = new ArrayList<>();

    @BeforeAll
    void requireRealCloudinaryCredentials() {
        assumeTrue(hasText(System.getenv("UPLOAD_CLOUDINARY_CLOUD_NAME")),
                "Skip real Cloudinary integration test when UPLOAD_CLOUDINARY_CLOUD_NAME is missing");
        assumeTrue(hasText(System.getenv("UPLOAD_CLOUDINARY_API_KEY")),
                "Skip real Cloudinary integration test when UPLOAD_CLOUDINARY_API_KEY is missing");
        assumeTrue(hasText(System.getenv("UPLOAD_CLOUDINARY_API_SECRET")),
                "Skip real Cloudinary integration test when UPLOAD_CLOUDINARY_API_SECRET is missing");
    }

    @AfterEach
    void cleanUp() {
        for (String imageUrl : List.copyOf(managedImageUrlsToCleanup)) {
            imageStorageRouterService.deleteManagedImage(imageUrl);
        }
        managedImageUrlsToCleanup.clear();

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
    void partnerShouldUploadToRealCloudinaryAndKeepHotelRoomFlowsWorking() throws Exception {
        User partner = createPartner("partner-cloudinary-real@test.com");
        String partnerToken = jwtService.generate(partner);

        Hotel hotel = new Hotel();
        hotel.setOwner(partner);
        hotel.setName("Cloudinary Hotel");
        hotel.setAddress("Cloud Street");
        hotel.setDistrict("District 1");
        hotel.setProvince("Bangkok");
        hotel = hotelRepository.save(hotel);

        Room room = new Room();
        room.setHotel(hotel);
        room.setName("Cloudinary Room");
        room.setCapacity(2);
        room.setQuantity(1);
        room.setPrice(1_900_000L);
        room = roomRepository.save(room);

        MockMultipartFile hotelImageA = new MockMultipartFile("files", "hotel-a.png", "image/png", PNG_BYTES);
        MockMultipartFile hotelImageB = new MockMultipartFile("files", "hotel-b.png", "image/png", PNG_BYTES);

        MvcResult hotelUploadResult = mockMvc.perform(multipart("/api/partner/hotels/{hotelId}/images", hotel.getId())
                        .file(hotelImageA)
                        .file(hotelImageB)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imageUrls.length()").value(2))
                .andReturn();

        String hotelImageUrlA = readImageUrl(hotelUploadResult, 0);
        String hotelImageUrlB = readImageUrl(hotelUploadResult, 1);
        managedImageUrlsToCleanup.add(hotelImageUrlA);
        managedImageUrlsToCleanup.add(hotelImageUrlB);

        assertCloudinaryDeliveryUrl(hotelImageUrlA, "hotels", hotel.getId());
        assertCloudinaryDeliveryUrl(hotelImageUrlB, "hotels", hotel.getId());
        assertRemoteImageReachable(hotelImageUrlA);

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
        managedImageUrlsToCleanup.remove(hotelImageUrlB);

        MockMultipartFile roomImage = new MockMultipartFile("files", "room-a.png", "image/png", PNG_BYTES);

        MvcResult roomUploadResult = mockMvc.perform(multipart("/api/partner/rooms/{roomId}/images", room.getId())
                        .file(roomImage)
                        .header(HttpHeaders.AUTHORIZATION, bearer(partnerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.imageUrls.length()").value(1))
                .andReturn();

        String roomImageUrl = readImageUrl(roomUploadResult, 0);
        managedImageUrlsToCleanup.add(roomImageUrl);

        assertCloudinaryDeliveryUrl(roomImageUrl, "rooms", room.getId());
        assertRemoteImageReachable(roomImageUrl);

        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getImageUrls())
                .containsExactly(hotelImageUrlA);
        assertThat(hotelRepository.findById(hotel.getId()).orElseThrow().getCoverImageUrl())
                .isEqualTo(hotelImageUrlA);
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getImageUrls())
                .containsExactly(roomImageUrl);
        assertThat(roomRepository.findById(room.getId()).orElseThrow().getCoverImageUrl())
                .isEqualTo(roomImageUrl);
    }

    private void assertCloudinaryDeliveryUrl(String imageUrl, String scope, Long ownerId) {
        String expectedCloudNameSegment = "/" + uploadStorageProperties.getCloudinary().getCloudName() + "/";
        assertThat(imageUrl)
                .contains("cloudinary.com")
                .contains(expectedCloudNameSegment)
                .contains(expectedFolderFragment(scope, ownerId));
    }

    private void assertRemoteImageReachable(String imageUrl) throws Exception {
        HttpResponse<byte[]> response = httpClient.send(
                HttpRequest.newBuilder(URI.create(imageUrl)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray()
        );

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse(""))
                .contains("image/png");
        assertThat(response.body()).isNotEmpty();
    }

    private String expectedFolderFragment(String scope, Long ownerId) {
        String normalizedPrefix = normalizeFolderPrefix(uploadStorageProperties.getCloudinary().getFolderPrefix());
        String scopedFolder = scope + "/" + ownerId + "/";
        return normalizedPrefix.isEmpty() ? "/" + scopedFolder : "/" + normalizedPrefix + "/" + scopedFolder;
    }

    private String normalizeFolderPrefix(String folderPrefix) {
        if (!hasText(folderPrefix)) {
            return "";
        }

        String normalized = folderPrefix.trim();
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String readImageUrl(MvcResult result, int index) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("imageUrls").get(index).asText();
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private User createPartner(String email) {
        User partner = new User();
        partner.setEmail(email);
        partner.setPasswordHash("hash-partner");
        partner.setUserType(UserType.PARTNER);
        partner.setStatus(UserStatus.ACTIVE);
        return userRepository.save(partner);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

}
