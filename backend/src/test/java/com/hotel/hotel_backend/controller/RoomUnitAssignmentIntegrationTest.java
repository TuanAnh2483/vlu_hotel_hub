package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.entity.Booking;
import com.hotel.hotel_backend.entity.BookingItem;
import com.hotel.hotel_backend.entity.BookingStatus;
import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyInventoryId;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomUnit;
import com.hotel.hotel_backend.entity.RoomUnitStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.entity.UserType;
import com.hotel.hotel_backend.pg.AbstractPostgresIntegrationTest;
import com.hotel.hotel_backend.repository.RoomUnitAssignmentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests cho tính năng gán phòng vật lý vào booking THEO NGÀY
 * (room_unit_assignment): suy trạng thái theo ngày, chặn trùng nửa mở,
 * khoá bảo trì trừ kho, giải phóng khi checkout/huỷ/hoàn tiền.
 */
class RoomUnitAssignmentIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private RoomUnitAssignmentRepository assignmentRepository;

    @BeforeEach
    void setUp() {
        assignmentRepository.deleteAll();
        clearAll();
    }

    @AfterEach
    void tearDown() {
        assignmentRepository.deleteAll();
        clearAll();
    }

    // ── Gán phòng + xem theo ngày ─────────────────────────────────────────────

    @Test
    void assignUnit_reservedWithinStay_availableOnCheckoutDay() throws Exception {
        User partner = seedUser("rua-p1@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 1");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c1@test.com", UserType.CUSTOMER);

        LocalDate ci = LocalDate.now().plusDays(2);
        LocalDate co = ci.plusDays(2); // ở 2 đêm: ci, ci+1 ; nhả vào co
        Booking booking = confirmedBooking(customer, room, ci, co, 1);

        assign(token, booking.getId(), List.of(u101.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].type").value("BOOKING"));

        // Đêm đầu kỳ → RESERVED, gắn bookingId
        JsonNode onCi = findUnit(unitsOn(token, hotel.getId(), ci), u101.getId());
        assertThat(onCi.path("status").asString()).isEqualTo("RESERVED");
        assertThat(onCi.path("bookingId").asLong()).isEqualTo(booking.getId());

        // Ngày trả phòng (co) → nhả ngay, phòng trống (nửa mở [ci, co))
        JsonNode onCo = findUnit(unitsOn(token, hotel.getId(), co), u101.getId());
        assertThat(onCo.path("status").asString()).isEqualTo("AVAILABLE");

        // Ngoài kỳ → trống
        JsonNode after = findUnit(unitsOn(token, hotel.getId(), co.plusDays(3)), u101.getId());
        assertThat(after.path("status").asString()).isEqualTo("AVAILABLE");
    }

    @Test
    void overlappingBookingsOnSameUnit_rejected() throws Exception {
        User partner = seedUser("rua-p2@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 2");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c2@test.com", UserType.CUSTOMER);

        LocalDate d1 = LocalDate.now().plusDays(2);
        Booking a = confirmedBooking(customer, room, d1, d1.plusDays(2), 1); // [d1, d1+2)
        Booking b = confirmedBooking(customer, room, d1.plusDays(1), d1.plusDays(3), 1); // [d1+1, d1+3) đè

        assign(token, a.getId(), List.of(u101.getId())).andExpect(status().isOk());
        assign(token, b.getId(), List.of(u101.getId())).andExpect(status().isConflict());
    }

    @Test
    void adjacentBookingsOnSameUnit_allowed() throws Exception {
        User partner = seedUser("rua-p3@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 3");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c3@test.com", UserType.CUSTOMER);

        LocalDate d1 = LocalDate.now().plusDays(2);
        Booking a = confirmedBooking(customer, room, d1, d1.plusDays(2), 1);            // [d1, d1+2)
        Booking b = confirmedBooking(customer, room, d1.plusDays(2), d1.plusDays(4), 1); // [d1+2, d1+4)

        assign(token, a.getId(), List.of(u101.getId())).andExpect(status().isOk());
        // b bắt đầu đúng ngày a trả phòng → KHÔNG trùng (nửa mở)
        assign(token, b.getId(), List.of(u101.getId())).andExpect(status().isOk());
    }

    @Test
    void assignUnitOfWrongRoomType_rejected() throws Exception {
        User partner = seedUser("rua-p4@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 4");
        Room booked = seedRoom(hotel, "Standard", 1);
        Room other = seedRoom(hotel, "Deluxe", 1);
        RoomUnit otherUnit = unit(other, "201");
        User customer = seedUser("rua-c4@test.com", UserType.CUSTOMER);

        LocalDate ci = LocalDate.now().plusDays(2);
        Booking booking = confirmedBooking(customer, booked, ci, ci.plusDays(1), 1);

        assign(token, booking.getId(), List.of(otherUnit.getId()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void assigningMoreUnitsThanBooked_rejected() throws Exception {
        User partner = seedUser("rua-p5@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 5");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        RoomUnit u102 = unit(room, "102");
        User customer = seedUser("rua-c5@test.com", UserType.CUSTOMER);

        LocalDate ci = LocalDate.now().plusDays(2);
        Booking booking = confirmedBooking(customer, room, ci, ci.plusDays(1), 1); // chỉ đặt 1 phòng

        assign(token, booking.getId(), List.of(u101.getId(), u102.getId()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void strangerPartnerCannotAssign() throws Exception {
        User owner = seedUser("rua-owner@test.com", UserType.PARTNER);
        User stranger = seedUser("rua-stranger@test.com", UserType.PARTNER);
        String strangerToken = jwtService.generate(stranger);
        Hotel hotel = seedHotel(owner, "RUA Owner Hotel");
        Room room = seedRoom(hotel, "Standard", 1);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c6@test.com", UserType.CUSTOMER);

        LocalDate ci = LocalDate.now().plusDays(2);
        Booking booking = confirmedBooking(customer, room, ci, ci.plusDays(1), 1);

        assign(strangerToken, booking.getId(), List.of(u101.getId()))
                .andExpect(status().isNotFound()); // không phải booking của partner này
    }

    @Test
    void checkedInBooking_dateViewShowsOccupied() throws Exception {
        User partner = seedUser("rua-p7@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 7");
        Room room = seedRoom(hotel, "Standard", 1);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c7@test.com", UserType.CUSTOMER);

        LocalDate today = LocalDate.now();
        Booking booking = confirmedBooking(customer, room, today, today.plusDays(2), 1);
        assign(token, booking.getId(), List.of(u101.getId())).andExpect(status().isOk());

        // Trước check-in: RESERVED
        assertThat(findUnit(unitsOn(token, hotel.getId(), today), u101.getId()).path("status").asString())
                .isEqualTo("RESERVED");

        mockMvc.perform(post("/api/partner/bookings/{id}/checkin", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());

        // Sau check-in: OCCUPIED
        assertThat(findUnit(unitsOn(token, hotel.getId(), today), u101.getId()).path("status").asString())
                .isEqualTo("OCCUPIED");
    }

    // ── Khoá bảo trì theo ngày + tồn kho ──────────────────────────────────────

    @Test
    void maintenanceBlock_showsMaintenance_andReducesInventory() throws Exception {
        User partner = seedUser("rua-p8@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 8");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());

        int blockedBefore = blockedRooms(room.getId(), checkIn);

        createBlock(token, room.getId(), u101.getId(), checkIn, checkIn) // khoá đúng đêm checkIn
                .andExpect(status().isOk());

        assertThat(findUnit(unitsOn(token, hotel.getId(), checkIn), u101.getId()).path("status").asString())
                .isEqualTo("MAINTENANCE");
        assertThat(blockedRooms(room.getId(), checkIn)).isEqualTo(blockedBefore + 1);
        // Ngày sau không bị khoá
        assertThat(findUnit(unitsOn(token, hotel.getId(), checkIn.plusDays(1)), u101.getId()).path("status").asString())
                .isEqualTo("AVAILABLE");
    }

    @Test
    void maintenanceBlock_preventsAssigningBookingToUnit() throws Exception {
        User partner = seedUser("rua-p9@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 9");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c9@test.com", UserType.CUSTOMER);

        createBlock(token, room.getId(), u101.getId(), checkIn, checkIn).andExpect(status().isOk());

        Booking booking = confirmedBooking(customer, room, checkIn, checkOut, 1); // [checkIn, checkIn+2)
        assign(token, booking.getId(), List.of(u101.getId()))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteBlock_restoresInventory_andAvailability() throws Exception {
        User partner = seedUser("rua-p10@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 10");
        Room room = seedRoom(hotel, "Standard", 2);
        RoomUnit u101 = unit(room, "101");
        inventoryService.initInventory(room.getId(), checkIn, checkOut, room.getQuantity());
        int blockedBefore = blockedRooms(room.getId(), checkIn);

        MvcResult res = createBlock(token, room.getId(), u101.getId(), checkIn, checkIn)
                .andExpect(status().isOk()).andReturn();
        long blockId = objectMapper.readTree(res.getResponse().getContentAsString())
                .path("data").path("id").asLong();
        assertThat(blockedRooms(room.getId(), checkIn)).isEqualTo(blockedBefore + 1);

        mockMvc.perform(delete("/api/partner/rooms/{rid}/units/{uid}/blocks/{bid}",
                        room.getId(), u101.getId(), blockId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());

        assertThat(blockedRooms(room.getId(), checkIn)).isEqualTo(blockedBefore);
        assertThat(findUnit(unitsOn(token, hotel.getId(), checkIn), u101.getId()).path("status").asString())
                .isEqualTo("AVAILABLE");
    }

    // ── Giải phóng khi checkout / huỷ ─────────────────────────────────────────

    @Test
    void completeBooking_releasesAssignment_andSetsCleaning() throws Exception {
        User partner = seedUser("rua-p11@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 11");
        Room room = seedRoom(hotel, "Standard", 1);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c11@test.com", UserType.CUSTOMER);

        LocalDate today = LocalDate.now();
        Booking booking = confirmedBooking(customer, room, today, today.plusDays(2), 1);
        assign(token, booking.getId(), List.of(u101.getId())).andExpect(status().isOk());

        mockMvc.perform(post("/api/partner/bookings/{id}/complete", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk());

        assertThat(assignmentRepository.findByBookingId(booking.getId())).isEmpty();
        RoomUnit reloaded = roomUnitRepository.findById(u101.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(RoomUnitStatus.CLEANING);
    }

    @Test
    void cancelBooking_releasesAssignment() throws Exception {
        User partner = seedUser("rua-p12@test.com", UserType.PARTNER);
        String token = jwtService.generate(partner);
        Hotel hotel = seedHotel(partner, "RUA Hotel 12");
        Room room = seedRoom(hotel, "Standard", 1);
        RoomUnit u101 = unit(room, "101");
        User customer = seedUser("rua-c12@test.com", UserType.CUSTOMER);
        String customerToken = jwtService.generate(customer);

        LocalDate ci = LocalDate.now().plusDays(3);
        Booking booking = confirmedBooking(customer, room, ci, ci.plusDays(2), 1);
        assign(token, booking.getId(), List.of(u101.getId())).andExpect(status().isOk());
        assertThat(assignmentRepository.findByBookingId(booking.getId())).hasSize(1);

        mockMvc.perform(post("/api/bookings/{id}/cancel", booking.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk());

        assertThat(assignmentRepository.findByBookingId(booking.getId())).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private RoomUnit unit(Room room, String number) {
        RoomUnit u = new RoomUnit();
        u.setRoom(room);
        u.setRoomNumber(number);
        u.setStatus(RoomUnitStatus.AVAILABLE);
        u.setAutoGenerated(false);
        return roomUnitRepository.save(u);
    }

    private Booking confirmedBooking(User customer, Room room, LocalDate ci, LocalDate co, int qty) {
        Booking b = Booking.builder()
                .userId(customer.getId())
                .checkIn(ci)
                .checkOut(co)
                .totalPrice(1_000_000L)
                .guests(2)
                .status(BookingStatus.CONFIRMED)
                .build();
        BookingItem item = BookingItem.builder()
                .booking(b)
                .room(room)
                .quantity(qty)
                .price(1_000_000L)
                .build();
        b.getItems().add(item);
        return bookingRepository.save(b);
    }

    private ResultActions assign(String token, long bookingId, List<Long> unitIds) throws Exception {
        String ids = unitIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        return mockMvc.perform(put("/api/partner/bookings/{id}/room-units", bookingId)
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .content("{\"unitIds\":[" + ids + "]}"));
    }

    private ResultActions createBlock(String token, long roomId, long unitId,
                                      LocalDate start, LocalDate end) throws Exception {
        return mockMvc.perform(post("/api/partner/rooms/{rid}/units/{uid}/blocks", roomId, unitId)
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .content("""
                        {"startDate":"%s","endDate":"%s","type":"MAINTENANCE","note":"fix AC"}
                        """.formatted(start, end)));
    }

    private JsonNode unitsOn(String token, long hotelId, LocalDate date) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/partner/hotels/{id}/room-units", hotelId)
                        .param("date", date.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).path("data");
    }

    private JsonNode findUnit(JsonNode arr, long unitId) {
        for (JsonNode n : arr) {
            if (n.path("id").asLong() == unitId) return n;
        }
        throw new AssertionError("Unit " + unitId + " not found in response");
    }

    private int blockedRooms(long roomId, LocalDate date) {
        DailyInventory inv = dailyInventoryRepository.findById(new DailyInventoryId(roomId, date))
                .orElseThrow(() -> new AssertionError("No inventory for room " + roomId + " on " + date));
        return inv.getBlockedRooms();
    }
}
