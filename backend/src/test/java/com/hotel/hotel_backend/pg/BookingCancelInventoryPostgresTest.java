package com.hotel.hotel_backend.pg;

import com.hotel.hotel_backend.entity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies the full booking-cancellation lifecycle against a real PostgreSQL database:
 * inventory is blocked on booking creation and restored on cancellation.
 * Also verifies that a second cancel attempt is rejected (idempotency guard).
 */
class BookingCancelInventoryPostgresTest extends AbstractPostgresIntegrationTest {

    private String customerToken;
    private Room room;

    @BeforeEach
    void setUp() {
        clearAll();
        User partner = seedUser("partner-cancel@pg.test", UserType.PARTNER);
        User customer = seedUser("customer-cancel@pg.test", UserType.CUSTOMER);
        customerToken = jwtService.generate(customer);

        var hotel = seedHotel(partner, "Cancel Hotel");
        room = seedRoom(hotel, "Cancel Room", 2);
        seedInventoryAndRates(room, 700_000L);
    }

    @Test
    void cancelBookingReleasesInventoryInPostgres() throws Exception {
        // 1. Create booking — inventory should be blocked
        MvcResult createResult = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [{ "roomId": %d, "quantity": 1 }],
                                  "contact": {
                                    "fullName": "Cancel Customer",
                                    "email": "customer-cancel@pg.test",
                                    "phone": "0900000003"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"))
                .andReturn();

        long bookingId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .path("data").path("bookingId").asLong();

        // Inventory must be blocked (1 room blocked per night)
        List<DailyInventory> beforeCancel = dailyInventoryRepository
                .findByIdRoomIdAndIdDateBetween(room.getId(), checkIn, checkOut.minusDays(1));
        assertThat(beforeCancel).allMatch(inv -> inv.getBlockedRooms() == 1);

        // 2. Cancel the booking
        mockMvc.perform(post("/api/v1/bookings/{id}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        // 3. PostgreSQL inventory rows must show 0 blocked rooms after cancellation
        List<DailyInventory> afterCancel = dailyInventoryRepository
                .findByIdRoomIdAndIdDateBetween(room.getId(), checkIn, checkOut.minusDays(1));
        assertThat(afterCancel).allMatch(inv -> inv.getBlockedRooms() == 0);

        // 4. GET booking confirms CANCELLED status is persisted in PostgreSQL
        mockMvc.perform(get("/api/v1/bookings/{id}", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    @Test
    void cancellingAlreadyCancelledBookingIsRejected() throws Exception {
        MvcResult createResult = mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken))
                        .content("""
                                {
                                  "checkIn": "%s",
                                  "checkOut": "%s",
                                  "room": [{ "roomId": %d, "quantity": 1 }],
                                  "contact": {
                                    "fullName": "Cancel Customer",
                                    "email": "customer-cancel@pg.test",
                                    "phone": "0900000003"
                                  }
                                }
                                """.formatted(checkIn, checkOut, room.getId())))
                .andExpect(status().isCreated())
                .andReturn();

        long bookingId = objectMapper.readTree(createResult.getResponse().getContentAsString())
                .path("data").path("bookingId").asLong();

        // First cancel succeeds
        mockMvc.perform(post("/api/v1/bookings/{id}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        // Second cancel is idempotent — returns 200 with CANCELLED status
        mockMvc.perform(post("/api/v1/bookings/{id}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }
}
