package com.hotel.hotel_backend.controller;

import com.hotel.hotel_backend.dto.request.CreateHotelRequest;
import com.hotel.hotel_backend.dto.request.PartnerBookingSearchRequest;
import com.hotel.hotel_backend.dto.request.UpdateHotelRequest;
import com.hotel.hotel_backend.dto.request.CreateRoomRequest;
import com.hotel.hotel_backend.dto.response.ApiResponse;
import com.hotel.hotel_backend.dto.response.HotelResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingDetailResponse;
import com.hotel.hotel_backend.dto.response.PartnerBookingPageResponse;
import com.hotel.hotel_backend.dto.response.RoomResponse;
import com.hotel.hotel_backend.service.*;
import com.hotel.hotel_backend.service.RoomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@RestController
@RequestMapping("/api/partner")
@RequiredArgsConstructor
public class PartnerController {

    private final HotelService hotelService;
    private final RoomService roomService;
    private final PartnerBookingService partnerBookingService;

    @GetMapping("/hotels")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<HotelResponse>> getMyHotels() {
        return ApiResponse.ok(hotelService.getMyHotels());
    }

    @GetMapping("/bookings")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingPageResponse> getMyBookings(@Valid @ModelAttribute PartnerBookingSearchRequest request) {
        return ApiResponse.ok(partnerBookingService.getPartnerBookings(request));
    }

    @GetMapping("/bookings/{bookingId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<PartnerBookingDetailResponse> getMyBooking(@PathVariable Long bookingId) {
        return ApiResponse.ok(partnerBookingService.getPartnerBooking(bookingId));
    }

    @PostMapping("/hotels")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> createHotel(
            @Valid @RequestBody CreateHotelRequest request) {
        return ApiResponse.ok(hotelService.create(request));
    }

    @PutMapping("/hotels/{id}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<HotelResponse> updateHotel(
            @PathVariable Long id,
            @Valid @RequestBody UpdateHotelRequest request) {
        return ApiResponse.ok(hotelService.update(id, request));
    }

    @DeleteMapping("/hotels/{id}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteHotel(@PathVariable Long id) {
        hotelService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping("/hotels/{hotelId}/rooms")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> createRoom(
            @PathVariable Long hotelId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.ok(roomService.create(hotelId, request));
    }

    @GetMapping("/hotels/{hotelId}/rooms")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<List<RoomResponse>> getRooms(
            @PathVariable Long hotelId) {
        return ApiResponse.ok(roomService.getRoomsByHotel(hotelId));
    }

    @PutMapping("/rooms/{roomId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<RoomResponse> updateRoom(
            @PathVariable Long roomId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.ok(roomService.update(roomId, request));
    }

    @DeleteMapping("/rooms/{roomId}")
    @PreAuthorize("hasRole('PARTNER')")
    public ApiResponse<Void> deleteRoom(@PathVariable Long roomId) {
        roomService.delete(roomId);
        return ApiResponse.ok(null);
    }
}
