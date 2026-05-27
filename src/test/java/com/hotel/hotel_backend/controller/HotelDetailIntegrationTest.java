package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyRate;
import com.hotel.hotel_backend.entity.DailyRateId;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
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
import java.util.HashSet;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HotelDetailIntegrationTest {

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
    void hotelDetailShouldReturnStaticHotelInformation() throws Exception {
        // Contract:
        // GET /api/hotels/{id} chi tra thong tin tinh cua hotel, khong dính availability/pricing.
        User owner = createOwner("owner-detail@test.com");

        Hotel hotel = createHotel(owner, "Detail Hotel", "Bangkok", "District 1");
        hotel.setDescription("Hotel used for detail endpoint test");
        hotel.setImageUrls(new ArrayList<>(List.of(
                "https://cdn.example.com/hotels/detail-cover.jpg",
                "https://cdn.example.com/hotels/detail-pool.jpg"
        )));
        hotel.setHotelType(HotelType.RESORT);
        hotel.setAmenities(new HashSet<>(List.of(HotelAmenity.WIFI, HotelAmenity.POOL)));
        hotel.setRatingAvg(new BigDecimal("4.75"));
        hotel.setRatingCount(18);
        hotel = hotelRepository.save(hotel);

        mockMvc.perform(get("/api/hotels/{id}", hotel.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.hotelId").value(hotel.getId()))
                .andExpect(jsonPath("$.data.name").value("Detail Hotel"))
                .andExpect(jsonPath("$.data.address").value("Detail Hotel address"))
                .andExpect(jsonPath("$.data.province").value("Bangkok"))
                .andExpect(jsonPath("$.data.district").value("District 1"))
                .andExpect(jsonPath("$.data.description").value("Hotel used for detail endpoint test"))
                .andExpect(jsonPath("$.data.hotelType").value("RESORT"))
                .andExpect(jsonPath("$.data.amenities.length()").value(2))
                .andExpect(jsonPath("$.data.coverImageUrl").value("https://cdn.example.com/hotels/detail-cover.jpg"))
                .andExpect(jsonPath("$.data.imageUrls[0]").value("https://cdn.example.com/hotels/detail-cover.jpg"))
                .andExpect(jsonPath("$.data.ratingAvg").value(4.75))
                .andExpect(jsonPath("$.data.ratingCount").value(18));
    }

    @Test
    void availableRoomsShouldReturnOnlySellableRoomTypesForStay() throws Exception {
        // Contract:
        // Endpoint available-rooms chi tra room type ban duoc cho ky o, kem availableUnits va stayPrice.
        User owner = createOwner("owner-available-rooms@test.com");

        Hotel hotel = createHotel(owner, "Room Detail Hotel", "Bangkok", "District 1");
        hotel.setImageUrls(new ArrayList<>(List.of("https://cdn.example.com/hotels/room-detail-cover.jpg")));
        hotelRepository.save(hotel);

        Room validRoom = createRoom(hotel, "Valid Room", 2);
        validRoom.setImageUrls(new ArrayList<>(List.of(
                "https://cdn.example.com/rooms/valid-room-1.jpg",
                "https://cdn.example.com/rooms/valid-room-2.jpg"
        )));
        validRoom = roomRepository.save(validRoom);
        initInventory(validRoom);
        createDailyRate(validRoom, checkIn, 800_000L, 1, false);
        createDailyRate(validRoom, checkIn.plusDays(1), 900_000L, 1, false);

        Room soldOutRoom = createRoom(hotel, "Sold Out Room", 1);
        initInventory(soldOutRoom);
        blockInventoryForEntireStay(soldOutRoom, 1);

        mockMvc.perform(get("/api/hotels/{id}/available-rooms", hotel.getId())
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].roomId").value(validRoom.getId()))
                .andExpect(jsonPath("$.data[0].name").value("Valid Room"))
                .andExpect(jsonPath("$.data[0].coverImageUrl").value("https://cdn.example.com/rooms/valid-room-1.jpg"))
                .andExpect(jsonPath("$.data[0].imageUrls[0]").value("https://cdn.example.com/rooms/valid-room-1.jpg"))
                .andExpect(jsonPath("$.data[0].capacity").value(2))
                .andExpect(jsonPath("$.data[0].availableUnits").value(2))
                .andExpect(jsonPath("$.data[0].stayPrice").value(1_700_000));
    }

    @Test
    void availableRoomsShouldReturnBadRequestWhenCheckOutIsNotAfterCheckIn() throws Exception {
        // Contract:
        // Endpoint available-rooms phai fail o boundary validation khi date range khong hop le.
        LocalDate invalidCheckIn = LocalDate.now().plusDays(5);
        LocalDate invalidCheckOut = invalidCheckIn;

        User owner = createOwner("owner-available-rooms-validation@test.com");
        Hotel hotel = createHotel(owner, "Validation Hotel", "Bangkok", "District 1");

        mockMvc.perform(get("/api/hotels/{id}/available-rooms", hotel.getId())
                        .param("checkIn", invalidCheckIn.toString())
                        .param("checkOut", invalidCheckOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void availableRoomsShouldReturnFieldErrorWhenRoomsIsLessThanOne() throws Exception {
        // Contract:
        // Detail endpoint cung phai tra field-level validation detail de UI hien thi loi dung input.
        User owner = createOwner("owner-available-rooms-page-validation@test.com");
        Hotel hotel = createHotel(owner, "Validation Hotel", "Bangkok", "District 1");

        mockMvc.perform(get("/api/hotels/{id}/available-rooms", hotel.getId())
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("rooms"));
    }

    @Test
    void hotelDetailShouldReturnNotFoundWhenHotelDoesNotExist() throws Exception {
        // Contract:
        // GET /api/hotels/{id} phai tra 404 NOT_FOUND khi hotel id khong ton tai.
        mockMvc.perform(get("/api/hotels/{id}", 999999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void availableRoomsShouldReturnNotFoundWhenHotelDoesNotExist() throws Exception {
        // Contract:
        // GET /api/hotels/{id}/available-rooms phai tra 404 NOT_FOUND khi hotel id khong ton tai.
        mockMvc.perform(get("/api/hotels/{id}/available-rooms", 999999L)
                        .param("checkIn", checkIn.toString())
                        .param("checkOut", checkOut.toString())
                        .param("adults", "2")
                        .param("rooms", "1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    private User createOwner(String email) {
        User owner = new User();
        owner.setEmail(email);
        owner.setPasswordHash("hash-owner");
        owner.setUserType(UserType.PARTNER);
        return userRepository.save(owner);
    }

    private Hotel createHotel(User owner, String name, String province, String district) {
        Hotel hotel = new Hotel();
        hotel.setOwner(owner);
        hotel.setName(name);
        hotel.setAddress(name + " address");
        hotel.setProvince(province);
        hotel.setDistrict(district);
        return hotelRepository.save(hotel);
    }

    private Room createRoom(Hotel hotel, String name, int quantity) {
        Room room = new Room();
        room.setHotel(hotel);
        room.setName(name);
        room.setPrice(1_000_000L);
        room.setCapacity(2);
        room.setQuantity(quantity);
        return roomRepository.save(room);
    }

    private void initInventory(Room room) {
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
    }

    private void blockInventoryForEntireStay(Room room, int blockedRooms) {
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

    private void createDailyRate(Room room, LocalDate date, long price, int minStay, boolean isClosed) {
        DailyRate dailyRate = new DailyRate();
        dailyRate.setId(new DailyRateId(room.getId(), date));
        dailyRate.setRoom(room);
        dailyRate.setPrice(price);
        dailyRate.setMinStay(minStay);
        dailyRate.setClosed(isClosed);
        dailyRateRepository.save(dailyRate);
    }
}
