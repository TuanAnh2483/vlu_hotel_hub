package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.*;
import com.hotel.hotel_backend.repository.*;
import com.hotel.hotel_backend.service.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HotelSearchIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

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
    private InventoryService inventoryService;

    private LocalDate checkIn;
    private LocalDate checkOut;

    @BeforeEach
    void setUp() {
        // Reset DB truoc moi test de tung case doc lap nhau.
        // checkIn/checkOut duoc co dinh de helper inventory va request dung chung cung mot ky o.
        dailyRateRepository.deleteAll();
        dailyInventoryRepository.deleteAll();
        roomUnitRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();
        userRepository.deleteAll();

        checkIn = LocalDate.now().plusDays(1);
        checkOut = checkIn.plusDays(2);
    }

    @Test
    void locationsShouldReturnActiveProvinceAndDistrictOptions() throws Exception {
        User owner = createOwner("owner-location-options@test.com");

        createHotel(owner, "Hoan Kiem Hotel", " Hà Nội ", " Quận Hoàn Kiếm ");
        createHotel(owner, "Ba Dinh Hotel", "Hà Nội", "Quận Ba Đình");
        Hotel blockedHotel = createHotel(owner, "Blocked Da Nang Hotel", "Đà Nẵng", "Sơn Trà");
        blockedHotel.setStatus(HotelStatus.BLOCKED);
        hotelRepository.save(blockedHotel);

        mockMvc.perform(get("/api/hotels/locations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].province").value("Hà Nội"))
                .andExpect(jsonPath("$.data[0].districts", containsInAnyOrder("Quận Hoàn Kiếm", "Quận Ba Đình")));
    }

    @Test
    void searchShouldReturnHotelsWithAvailableRooms() throws Exception {
        // Contract:
        // Hotel dung location, room dang active, va inventory du cho toan bo ky o
        // thi phai duoc tra ve trong ket qua search.
        User owner = createOwner("owner-available@test.com");

        Hotel hotel = createHotel(owner, "Available Hotel", "Bangkok", "District 1");
        hotel.setImageUrls(new ArrayList<>(List.of(
                "https://cdn.example.com/hotels/available-cover.jpg",
                "https://cdn.example.com/hotels/available-lobby.jpg"
        )));
        hotel = hotelRepository.save(hotel);
        Room room = createRoom(hotel, "Standard Room", 2);
        initInventory(room);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Available Hotel"))
                .andExpect(jsonPath("$.data.items[0].address").value("Available Hotel address"))
                .andExpect(jsonPath("$.data.items[0].province").value("Bangkok"))
                .andExpect(jsonPath("$.data.items[0].district").value("District 1"))
                .andExpect(jsonPath("$.data.items[0].coverImageUrl").value("https://cdn.example.com/hotels/available-cover.jpg"))
                .andExpect(jsonPath("$.data.items[0].imageUrls[0]").value("https://cdn.example.com/hotels/available-cover.jpg"))
                .andExpect(jsonPath("$.data.items[0].ratingAvg").value(0))
                .andExpect(jsonPath("$.data.items[0].ratingCount").value(0))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(2_000_000))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.totalItems").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.hasNext").value(false))
                .andExpect(jsonPath("$.data.sort").value("price_asc"));
    }

    @Test
    void searchShouldExcludeHotelsWithoutAvailability() throws Exception {
        // Contract:
        // Hai hotel cung location nhung mot hotel bi sold-out toan bo ky o
        // thi ket qua search chi duoc giu lai hotel con phong.
        User owner = createOwner("owner-soldout@test.com");

        Hotel availableHotel = createHotel(owner, "Available Hotel", "Bangkok", "District 1");
        Room availableRoom = createRoom(availableHotel, "Available Room", 2);
        initInventory(availableRoom);

        Hotel soldOutHotel = createHotel(owner, "Sold Out Hotel", "Bangkok", "District 1");
        Room soldOutRoom = createRoom(soldOutHotel, "Sold Out Room", 1);
        initInventory(soldOutRoom);
        blockInventoryForEntireStay(soldOutRoom, 1);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(availableHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Available Hotel"));
    }

    @Test
    void searchShouldFilterHotelsByHotelAmenities() throws Exception {
        // Contract:
        // hotelAmenities la filter o muc hotel va semantics la AND.
        User owner = createOwner("owner-hotel-amenity@test.com");

        Hotel matchedHotel = createHotel(
                owner,
                "Pool Parking Hotel",
                "Bangkok",
                "District 1",
                Set.of(HotelAmenity.POOL, HotelAmenity.PARKING)
        );
        Room matchedRoom = createRoom(matchedHotel, "Matched Room", 1);
        initInventory(matchedRoom);

        Hotel unmatchedHotel = createHotel(
                owner,
                "Wifi Only Hotel",
                "Bangkok",
                "District 1",
                Set.of(HotelAmenity.WIFI)
        );
        Room unmatchedRoom = createRoom(unmatchedHotel, "Unmatched Room", 1);
        initInventory(unmatchedRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("hotelAmenities", "POOL,PARKING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(matchedHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Pool Parking Hotel"));
    }

    @Test
    void searchShouldFilterHotelsByHotelType() throws Exception {
        // Contract:
        // hotelTypes la filter muc hotel va semantics trong cung group la OR.
        User owner = createOwner("owner-hotel-type@test.com");

        Hotel resortHotel = createHotel(owner, "Island Resort", "Bangkok", "District 1", HotelType.RESORT);
        Room resortRoom = createRoom(resortHotel, "Resort Room", 1);
        initInventory(resortRoom);

        Hotel apartmentHotel = createHotel(owner, "City Apartment", "Bangkok", "District 1", HotelType.APARTMENT);
        Room apartmentRoom = createRoom(apartmentHotel, "Apartment Room", 1);
        initInventory(apartmentRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("hotelTypes", "RESORT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(resortHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Island Resort"));
    }

    @Test
    void searchShouldFilterByRoomCategoryAndUseMatchingCategoryPriceOnly() throws Exception {
        // Contract:
        // roomCategories phai loc room pool truoc pricing, minPrice chi duoc tinh tren category da match.
        User owner = createOwner("owner-room-category@test.com");

        Hotel hotel = createHotel(owner, "Category Hotel", "Bangkok", "District 1");

        Room cheapStandardRoom = createRoom(hotel, "Cheap Standard", 1, 2, RoomCategory.STANDARD, BedType.DOUBLE, Set.of());
        initInventory(cheapStandardRoom);
        createDailyRate(cheapStandardRoom, checkIn, 400_000L, 1, false);
        createDailyRate(cheapStandardRoom, checkIn.plusDays(1), 400_000L, 1, false);

        Room suiteRoom = createRoom(hotel, "Suite Room", 1, 2, RoomCategory.SUITE, BedType.DOUBLE, Set.of());
        initInventory(suiteRoom);
        createDailyRate(suiteRoom, checkIn, 950_000L, 1, false);
        createDailyRate(suiteRoom, checkIn.plusDays(1), 950_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("roomCategories", "SUITE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_900_000));
    }

    @Test
    void searchShouldFilterByBedType() throws Exception {
        // Contract:
        // bedTypes phai loc room pool o room-level, hotel khong con room match thi bi loai.
        User owner = createOwner("owner-bed-type@test.com");

        Hotel twinHotel = createHotel(owner, "Twin Hotel", "Bangkok", "District 1");
        Room twinRoom = createRoom(twinHotel, "Twin Room", 1, 2, RoomCategory.DELUXE, BedType.TWIN, Set.of());
        initInventory(twinRoom);

        Hotel doubleHotel = createHotel(owner, "Double Hotel", "Bangkok", "District 1");
        Room doubleRoom = createRoom(doubleHotel, "Double Room", 1, 2, RoomCategory.DELUXE, BedType.DOUBLE, Set.of());
        initInventory(doubleRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("bedTypes", "TWIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(twinHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Twin Hotel"));
    }

    @Test
    void searchShouldFilterByRoomAmenitiesAndUseMatchingRoomPriceOnly() throws Exception {
        // Contract:
        // roomAmenities phai loc room pool truoc availability/pricing.
        // minPrice phai tinh tu room da match amenity, khong lay room re hon nhung khong match.
        User owner = createOwner("owner-room-amenity@test.com");

        Hotel matchedHotel = createHotel(owner, "Breakfast Hotel", "Bangkok", "District 1");

        Room cheapPlainRoom = createRoom(matchedHotel, "Cheap Plain Room", 1);
        initInventory(cheapPlainRoom);
        createDailyRate(cheapPlainRoom, checkIn, 400_000L, 1, false);
        createDailyRate(cheapPlainRoom, checkIn.plusDays(1), 400_000L, 1, false);

        Room breakfastRoom = createRoom(
                matchedHotel,
                "Balcony Room",
                1,
                2,
                Set.of(RoomAmenity.BALCONY)
        );
        initInventory(breakfastRoom);
        createDailyRate(breakfastRoom, checkIn, 900_000L, 1, false);
        createDailyRate(breakfastRoom, checkIn.plusDays(1), 900_000L, 1, false);

        Hotel unmatchedHotel = createHotel(owner, "Plain Hotel", "Bangkok", "District 1");
        Room unmatchedRoom = createRoom(unmatchedHotel, "Plain Room", 1);
        initInventory(unmatchedRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("roomAmenities", "BALCONY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(matchedHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_800_000));
    }

    @Test
    void searchShouldCombineHotelAndRoomAmenityFilters() throws Exception {
        // Contract:
        // Search chi duoc giu hotel khi pass dong thoi hotel amenity va room amenity filter.
        User owner = createOwner("owner-combined-amenity@test.com");

        Hotel fullyMatchedHotel = createHotel(
                owner,
                "Matched Amenity Hotel",
                "Bangkok",
                "District 1",
                Set.of(HotelAmenity.POOL)
        );
        Room matchedRoom = createRoom(
                fullyMatchedHotel,
                "Matched Room",
                1,
                2,
                Set.of(RoomAmenity.BALCONY)
        );
        initInventory(matchedRoom);

        Hotel hotelOnlyMatched = createHotel(
                owner,
                "Hotel Only Match",
                "Bangkok",
                "District 1",
                Set.of(HotelAmenity.POOL)
        );
        Room hotelOnlyRoom = createRoom(hotelOnlyMatched, "Plain Room", 1);
        initInventory(hotelOnlyRoom);

        Hotel roomOnlyMatched = createHotel(owner, "Room Only Match", "Bangkok", "District 1");
        Room roomOnlyRoom = createRoom(
                roomOnlyMatched,
                "Balcony Room",
                1,
                2,
                Set.of(RoomAmenity.BALCONY)
        );
        initInventory(roomOnlyRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("hotelAmenities", "POOL")
                        .param("roomAmenities", "BALCONY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(fullyMatchedHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Matched Amenity Hotel"));
    }

    @Test
    void searchShouldReturnEmptyResultWithPaginationMetadataWhenNoHotelMatches() throws Exception {
        // Contract:
        // Search khong co ket qua van phai tra 200 voi pagination metadata on dinh,
        // thay vi tra loi hoac bo trong metadata.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(0))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.totalItems").value(0))
                .andExpect(jsonPath("$.data.totalPages").value(0))
                .andExpect(jsonPath("$.data.hasNext").value(false))
                .andExpect(jsonPath("$.data.sort").value("price_asc"));
    }

    @Test
    void searchShouldReturnBadRequestWhenDatesMissing() throws Exception {
        // Contract:
        // Request thieu checkIn/checkOut phai fail ngay o boundary validation
        // va tra 400 VALIDATION_ERROR thay vi chay vao business logic.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void searchShouldExcludeHotelsWithoutEnoughCapacityForAdults() throws Exception {
        // Contract:
        // Ca hai hotel deu du so phong user yeu cau.
        // Nhung chi hotel co tong suc chua du cho so adults moi duoc giu lai.
        User owner = createOwner("owner-capacity@test.com");

        Hotel familyHotel = createHotel(owner, "Family Hotel", "Bangkok", "District 1");
        Room familyRoomA = createRoom(familyHotel, "Family A", 1, 2);
        Room familyRoomB = createRoom(familyHotel, "Family B", 1, 2);
        initInventory(familyRoomA);
        initInventory(familyRoomB);

        Hotel lowCapacityHotel = createHotel(owner, "Low Capacity Hotel", "Bangkok", "District 1");
        Room singleRoomA = createRoom(lowCapacityHotel, "Single A", 1, 1);
        Room singleRoomB = createRoom(lowCapacityHotel, "Single B", 1, 1);
        initInventory(singleRoomA);
        initInventory(singleRoomB);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "3")
                        .param("rooms", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(familyHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Family Hotel"));
    }

    @Test
    void searchShouldReturnBadRequestWhenCheckOutIsNotAfterCheckIn() throws Exception {
        // Contract:
        // checkOut phai sau checkIn.
        // Neu checkOut == checkIn hoac checkOut truoc checkIn thi request phai tra 400.
        LocalDate invalidCheckIn = LocalDate.now().plusDays(3);
        LocalDate invalidCheckOut = invalidCheckIn;

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", invalidCheckIn.toString())
                        .param("checkOut", invalidCheckOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void searchShouldReturnFieldErrorWhenPageIsLessThanOne() throws Exception {
        // Contract:
        // Validation error phai tra field detail ro rang de frontend bind loi vao dung input.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("page", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("page"));
    }

    @Test
    void searchShouldExcludeHotelWhenOneNightIsSoldOut() throws Exception {
        // Contract:
        // Hotel phai available cho tat ca cac dem trong ky o.
        // Chi can sold-out dung mot dem thi hotel do phai bi loai.
        User owner = createOwner("owner-one-night@test.com");

        Hotel availableHotel = createHotel(owner, "Always Available Hotel", "Bangkok", "District 1");
        Room availableRoom = createRoom(availableHotel, "Available Room", 1);
        initInventory(availableRoom);

        Hotel oneNightSoldOutHotel = createHotel(owner, "One Night Sold Out Hotel", "Bangkok", "District 1");
        Room soldOutRoom = createRoom(oneNightSoldOutHotel, "Sold Out Room", 1);
        initInventory(soldOutRoom);
        blockInventoryOnDate(soldOutRoom, checkIn.plusDays(1), 1);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(availableHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].name").value("Always Available Hotel"));
    }

    private User createOwner(String email) {
        // Tao partner de gan lam owner cho hotel test.
        User owner = new User();
        owner.setEmail(email);
        owner.setPasswordHash("hash-owner");
        owner.setUserType(UserType.PARTNER);
        return userRepository.save(owner);
    }

    private Hotel createHotel(User owner, String name, String province, String district) {
        // Tao hotel voi location cu the de test filter location.
        return createHotel(owner, name, province, district, HotelType.HOTEL, Set.of());
    }

    private Hotel createHotel(User owner, String name, String province, String district, Set<HotelAmenity> amenities) {
        return createHotel(owner, name, province, district, HotelType.HOTEL, amenities);
    }

    private Hotel createHotel(User owner, String name, String province, String district, HotelType hotelType) {
        return createHotel(owner, name, province, district, hotelType, Set.of());
    }

    private Hotel createHotel(User owner, String name, String province, String district, HotelType hotelType, Set<HotelAmenity> amenities) {
        // Tao hotel voi location cu the de test filter location va filter amenity muc hotel.
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince(province);
        hotel.setDistrict(district);
        hotel.setHotelType(hotelType);
        hotel.setAmenities(amenities);
        return hotelRepository.save(hotel);
    }

    private Room createRoom(Hotel hotel, String name, int quantity) {
        // Helper mac dinh: room type nay co suc chua 2 nguoi.
        return createRoom(hotel, name, quantity, 2);
    }

    private Room createRoom(Hotel hotel, String name, int quantity, int capacity) {
        return createRoom(hotel, name, quantity, capacity, RoomCategory.STANDARD, BedType.DOUBLE, Set.of());
    }

    private Room createRoom(Hotel hotel, String name, int quantity, int capacity, Set<RoomAmenity> amenities) {
        return createRoom(hotel, name, quantity, capacity, RoomCategory.STANDARD, BedType.DOUBLE, amenities);
    }

    private Room createRoom(
            Hotel hotel,
            String name,
            int quantity,
            int capacity,
            RoomCategory roomCategory,
            BedType bedType,
            Set<RoomAmenity> amenities
    ) {
        // quantity = hotel co bao nhieu phong thuoc room type nay.
        // capacity = moi phong trong room type nay chua duoc bao nhieu nguoi.
        // Test capacity dung helper nay de mo phong hotel du phong nhung thieu suc chua cho adults.
        Room room = new Room();
        room.setHotel(hotel);
        room.setName(name);
        room.setPrice(1_000_000L);
        room.setCapacity(capacity);
        room.setQuantity(quantity);
        room.setRoomCategory(roomCategory);
        room.setBedType(bedType);
        room.setAmenities(amenities);
        return roomRepository.save(room);
    }

    private void initInventory(Room room) {
        // Search chi coi room la available khi moi ngay trong ky o deu co inventory.
        // Helper nay tao inventory cho tat ca cac ngay trong khoang [checkIn, checkOut).
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
    }

    private void blockInventoryForEntireStay(Room room, int blockedRooms) {
        // Block cung mot so luong phong tren moi dem cua ky o.
        // blockedRooms = quantity nghia la room van active nhung sold-out trong suot ky o.
        List<DailyInventory> inventories = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                checkIn,
                checkOut.minusDays(1)
        );

        for (DailyInventory inventory : inventories) {
            inventory.setBlockedRooms(blockedRooms);
        }

        dailyInventoryRepository.saveAll(inventories);
    }

    private void blockInventoryOnDate(Room room, LocalDate date, int blockedRooms) {
        // Chi block mot dem cu the.
        // Test nay dung de chung minh availability phai dung cho toan bo ky o,
        // chi thieu inventory o mot dem cung phai loai hotel ra.
        DailyInventory inventory = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                room.getId(),
                date,
                date
        ).get(0);

        inventory.setBlockedRooms(blockedRooms);
        dailyInventoryRepository.save(inventory);
    }


    private void createDailyRate(Room room, LocalDate date, long price, int minStay, boolean isClosed) {
        // Helper nay tao pricing data theo tung ngay cho room type.
        // Test co the dieu khien ro cac nhanh DailyRate, fallback, isClosed va minStay.
        DailyRate dailyRate = new DailyRate();
        dailyRate.setId(new DailyRateId(room.getId(), date));
        dailyRate.setRoom(room);
        dailyRate.setPrice(price);
        dailyRate.setMinStay(minStay);
        dailyRate.setClosed(isClosed);
        dailyRateRepository.save(dailyRate);
    }

    @Test
    void searchShouldUseDailyRatesToCalculateMinPrice() throws Exception {
        User owner = createOwner("owner-dailyrate@test.com");

        Hotel hotel = createHotel(owner, "Rate Hotel", "Bangkok", "District 1");

        Room room = createRoom(hotel, "Rate Room", 1);

        initInventory(room);

        createDailyRate(room, checkIn, 800_000L, 2, false);
        createDailyRate(room, checkIn.plusDays(1), 900_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())

                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_700_000));
    }
    @Test
    void searchShouldFallbackToBasePriceWhenDailyRateIsMissingForOneNight() throws Exception {
        // Contract:
        // Neu thieu DailyRate o mot dem, room type van duoc dinh gia
        // bang cach dung DailyRate cho ngay co du lieu va fallback Room.price cho ngay con lai.
        User owner = createOwner("owner-fallback@test.com");

        Hotel hotel = createHotel(owner, "Fallback Hotel", "Bangkok", "District 1");
        Room room = createRoom(hotel, "Fallback Room", 1);
        initInventory(room);

        // Chi co daily rate cho dem dau, dem con lai phai fallback ve base price cua room.
        createDailyRate(room, checkIn, 800_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_800_000));
    }

    @Test
    void searchShouldIgnoreClosedRoomTypeWhenCalculatingMinPrice() throws Exception {
        // Contract:
        // Room type re hon nhung bi closed o mot dem phai bi loai khoi pricing.
        // Search phai lay minPrice tu room type hop le con lai.
        User owner = createOwner("owner-closed@test.com");

        Hotel hotel = createHotel(owner, "Closed Rate Hotel", "Bangkok", "District 1");

        Room closedRoom = createRoom(hotel, "Closed Room", 2);
        initInventory(closedRoom);
        createDailyRate(closedRoom, checkIn, 700_000L, 1, false);
        createDailyRate(closedRoom, checkIn.plusDays(1), 700_000L, 1, true);

        Room validRoom = createRoom(hotel, "Valid Room", 2);
        initInventory(validRoom);
        createDailyRate(validRoom, checkIn, 900_000L, 1, false);
        createDailyRate(validRoom, checkIn.plusDays(1), 900_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_800_000));
    }

    @Test
    void searchShouldIgnoreRoomTypeWhenMinStayExceedsStayLength() throws Exception {
        // Contract:
        // Room type re hon nhung yeu cau minStay lon hon so dem user chon
        // phai bi loai khoi pricing. Search phai lay minPrice tu room type hop le con lai.
        User owner = createOwner("owner-minstay@test.com");

        Hotel hotel = createHotel(owner, "Min Stay Hotel", "Bangkok", "District 1");

        Room minStayRoom = createRoom(hotel, "Min Stay Room", 2);
        initInventory(minStayRoom);
        createDailyRate(minStayRoom, checkIn, 700_000L, 3, false);
        createDailyRate(minStayRoom, checkIn.plusDays(1), 700_000L, 3, false);

        Room validRoom = createRoom(hotel, "Valid Room", 2);
        initInventory(validRoom);
        createDailyRate(validRoom, checkIn, 900_000L, 1, false);
        createDailyRate(validRoom, checkIn.plusDays(1), 900_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_800_000));
    }

    @Test
    void searchShouldReturnSecondPageWithPaginationMetadata() throws Exception {
        // Contract:
        // Search phai tra metadata pagination on dinh va cat dung item theo page/size.
        User owner = createOwner("owner-pagination@test.com");

        Hotel cheapestHotel = createHotel(owner, "Cheapest Hotel", "Bangkok", "District 1");
        Room cheapestRoom = createRoom(cheapestHotel, "Cheapest Room", 1);
        initInventory(cheapestRoom);
        createDailyRate(cheapestRoom, checkIn, 700_000L, 1, false);
        createDailyRate(cheapestRoom, checkIn.plusDays(1), 800_000L, 1, false);

        Hotel middleHotel = createHotel(owner, "Middle Hotel", "Bangkok", "District 1");
        Room middleRoom = createRoom(middleHotel, "Middle Room", 1);
        initInventory(middleRoom);
        createDailyRate(middleRoom, checkIn, 800_000L, 1, false);
        createDailyRate(middleRoom, checkIn.plusDays(1), 900_000L, 1, false);

        Hotel expensiveHotel = createHotel(owner, "Expensive Hotel", "Bangkok", "District 1");
        Room expensiveRoom = createRoom(expensiveHotel, "Expensive Room", 1);
        initInventory(expensiveRoom);
        createDailyRate(expensiveRoom, checkIn, 900_000L, 1, false);
        createDailyRate(expensiveRoom, checkIn.plusDays(1), 1_000_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("page", "2")
                        .param("size", "2")
                        .param("sort", "price_asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(expensiveHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_900_000))
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.size").value(2))
                .andExpect(jsonPath("$.data.totalItems").value(3))
                .andExpect(jsonPath("$.data.totalPages").value(2))
                .andExpect(jsonPath("$.data.hasNext").value(false))
                .andExpect(jsonPath("$.data.sort").value("price_asc"));
    }

    @Test
    void searchShouldSortHotelsByRatingDescending() throws Exception {
        // Contract:
        // sort=rating_desc phai uu tien ratingAvg giam dan, tie-break tiep theo moi den hotelId.
        User owner = createOwner("owner-rating-sort@test.com");

        Hotel lowerRatedHotel = createHotel(owner, "Lower Rated Hotel", "Bangkok", "District 1");
        lowerRatedHotel.setRatingAvg(new BigDecimal("4.20"));
        lowerRatedHotel.setRatingCount(12);
        lowerRatedHotel = hotelRepository.save(lowerRatedHotel);
        Room lowerRatedRoom = createRoom(lowerRatedHotel, "Lower Rated Room", 1);
        initInventory(lowerRatedRoom);

        Hotel higherRatedHotel = createHotel(owner, "Higher Rated Hotel", "Bangkok", "District 1");
        higherRatedHotel.setRatingAvg(new BigDecimal("4.80"));
        higherRatedHotel.setRatingCount(25);
        higherRatedHotel = hotelRepository.save(higherRatedHotel);
        Room higherRatedRoom = createRoom(higherRatedHotel, "Higher Rated Room", 1);
        initInventory(higherRatedRoom);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "rating_desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(higherRatedHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].ratingAvg").value(4.8))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(lowerRatedHotel.getId()))
                .andExpect(jsonPath("$.data.items[1].ratingAvg").value(4.2))
                .andExpect(jsonPath("$.data.sort").value("rating_desc"));
    }

    @Test
    void searchShouldSortHotelsByRecommendedScore() throws Exception {
        // Contract:
        // sort=recommended phai can bang giua rating, do tin cay review va gia tuong doi.
        // Hotel qua re nhung chua co review khong duoc mac dinh dung dau.
        User owner = createOwner("owner-recommended-sort@test.com");

        Hotel cheapestUnratedHotel = createHotel(owner, "Cheapest Unrated Hotel", "Bangkok", "District 1");
        Room cheapestRoom = createRoom(cheapestUnratedHotel, "Cheapest Room", 1);
        initInventory(cheapestRoom);
        createDailyRate(cheapestRoom, checkIn, 600_000L, 1, false);
        createDailyRate(cheapestRoom, checkIn.plusDays(1), 600_000L, 1, false);

        Hotel balancedHotel = createHotel(owner, "Balanced Hotel", "Bangkok", "District 1");
        balancedHotel.setRatingAvg(new BigDecimal("4.70"));
        balancedHotel.setRatingCount(48);
        balancedHotel = hotelRepository.save(balancedHotel);
        Room balancedRoom = createRoom(balancedHotel, "Balanced Room", 1);
        initInventory(balancedRoom);
        createDailyRate(balancedRoom, checkIn, 800_000L, 1, false);
        createDailyRate(balancedRoom, checkIn.plusDays(1), 800_000L, 1, false);

        Hotel premiumLowConfidenceHotel = createHotel(owner, "Premium Low Confidence Hotel", "Bangkok", "District 1");
        premiumLowConfidenceHotel.setRatingAvg(new BigDecimal("4.90"));
        premiumLowConfidenceHotel.setRatingCount(3);
        premiumLowConfidenceHotel = hotelRepository.save(premiumLowConfidenceHotel);
        Room premiumRoom = createRoom(premiumLowConfidenceHotel, "Premium Room", 1);
        initInventory(premiumRoom);
        createDailyRate(premiumRoom, checkIn, 1_100_000L, 1, false);
        createDailyRate(premiumRoom, checkIn.plusDays(1), 1_100_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "recommended"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(balancedHotel.getId()))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(premiumLowConfidenceHotel.getId()))
                .andExpect(jsonPath("$.data.items[2].hotelId").value(cheapestUnratedHotel.getId()))
                .andExpect(jsonPath("$.data.sort").value("recommended"));
    }

    @Test
    void searchShouldReturnBadRequestWhenSortIsInvalid() throws Exception {
        // Contract:
        // sort ngoai whitelist product phai bi chan o boundary validation.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "popular"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("sort"));
    }

    @Test
    void searchShouldReturnBadRequestWhenHotelAmenityIsInvalid() throws Exception {
        // Contract:
        // hotel amenity ngoai catalog phai fail o boundary validation, khong duoc silently ignore.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("hotelAmenities", "INVALID_AMENITY"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field", containsString("hotelAmenities")));
    }

    @Test
    void searchShouldReturnBadRequestWhenRoomAmenityIsInvalid() throws Exception {
        // Contract:
        // room amenity ngoai catalog phai fail o boundary validation de contract query param ro rang.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("roomAmenities", "INVALID_AMENITY"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field", containsString("roomAmenities")));
    }

    @Test
    void searchShouldReturnBadRequestWhenSizeExceedsLimit() throws Exception {
        // Contract:
        // size > 50 phai bi chan o boundary validation de tranh query product qua lon.
        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("size"));
    }

    @Test
    void searchShouldSortHotelsByPriceAscending() throws Exception {
        // Contract:
        // sort=price_asc phai tra ket qua theo thu tu minPrice tang dan.
        // Hotel re nhat phai o vi tri dau tien.
        User owner = createOwner("owner-price-asc@test.com");

        Hotel expensiveHotel = createHotel(owner, "Expensive Hotel", "Bangkok", "District 1");
        Room expensiveRoom = createRoom(expensiveHotel, "Expensive Room", 1);
        initInventory(expensiveRoom);
        createDailyRate(expensiveRoom, checkIn, 900_000L, 1, false);
        createDailyRate(expensiveRoom, checkIn.plusDays(1), 1_000_000L, 1, false);

        Hotel cheapHotel = createHotel(owner, "Cheap Hotel", "Bangkok", "District 1");
        Room cheapRoom = createRoom(cheapHotel, "Cheap Room", 1);
        initInventory(cheapRoom);
        createDailyRate(cheapRoom, checkIn, 500_000L, 1, false);
        createDailyRate(cheapRoom, checkIn.plusDays(1), 600_000L, 1, false);

        Hotel middleHotel = createHotel(owner, "Middle Hotel", "Bangkok", "District 1");
        Room middleRoom = createRoom(middleHotel, "Middle Room", 1);
        initInventory(middleRoom);
        createDailyRate(middleRoom, checkIn, 700_000L, 1, false);
        createDailyRate(middleRoom, checkIn.plusDays(1), 800_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "price_asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(cheapHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_100_000))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(middleHotel.getId()))
                .andExpect(jsonPath("$.data.items[1].minPrice").value(1_500_000))
                .andExpect(jsonPath("$.data.items[2].hotelId").value(expensiveHotel.getId()))
                .andExpect(jsonPath("$.data.items[2].minPrice").value(1_900_000))
                .andExpect(jsonPath("$.data.sort").value("price_asc"));
    }

    @Test
    void searchShouldSortHotelsByPriceDescending() throws Exception {
        // Contract:
        // sort=price_desc phai tra ket qua theo thu tu minPrice giam dan.
        // Hotel dat nhat phai o vi tri dau tien.
        User owner = createOwner("owner-price-desc@test.com");

        Hotel cheapHotel = createHotel(owner, "Cheap Hotel Desc", "Bangkok", "District 1");
        Room cheapRoom = createRoom(cheapHotel, "Cheap Room Desc", 1);
        initInventory(cheapRoom);
        createDailyRate(cheapRoom, checkIn, 500_000L, 1, false);
        createDailyRate(cheapRoom, checkIn.plusDays(1), 600_000L, 1, false);

        Hotel expensiveHotel = createHotel(owner, "Expensive Hotel Desc", "Bangkok", "District 1");
        Room expensiveRoom = createRoom(expensiveHotel, "Expensive Room Desc", 1);
        initInventory(expensiveRoom);
        createDailyRate(expensiveRoom, checkIn, 900_000L, 1, false);
        createDailyRate(expensiveRoom, checkIn.plusDays(1), 1_000_000L, 1, false);

        Hotel middleHotel = createHotel(owner, "Middle Hotel Desc", "Bangkok", "District 1");
        Room middleRoom = createRoom(middleHotel, "Middle Room Desc", 1);
        initInventory(middleRoom);
        createDailyRate(middleRoom, checkIn, 700_000L, 1, false);
        createDailyRate(middleRoom, checkIn.plusDays(1), 800_000L, 1, false);

        mockMvc.perform(get("/api/hotels/search")
                        .param("province", "Bangkok")
                        .param("district", "District 1")
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1")
                        .param("sort", "price_desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].hotelId").value(expensiveHotel.getId()))
                .andExpect(jsonPath("$.data.items[0].minPrice").value(1_900_000))
                .andExpect(jsonPath("$.data.items[1].hotelId").value(middleHotel.getId()))
                .andExpect(jsonPath("$.data.items[1].minPrice").value(1_500_000))
                .andExpect(jsonPath("$.data.items[2].hotelId").value(cheapHotel.getId()))
                .andExpect(jsonPath("$.data.items[2].minPrice").value(1_100_000))
                .andExpect(jsonPath("$.data.sort").value("price_desc"));
    }

}
