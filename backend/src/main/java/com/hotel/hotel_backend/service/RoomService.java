package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.CreateRoomRequest;
import com.hotel.hotel_backend.dto.response.RoomResponse;
import com.hotel.hotel_backend.dto.response.RoomUnitSummaryResponse;
import com.hotel.hotel_backend.entity.BookingMode;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.entity.RoomStatus;

import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomService {

    private final RoomRepository roomRepository;
    private final HotelRepository hotelRepository;
    private final BookingItemRepository bookingItemRepository;
    private final DailyInventoryRepository dailyInventoryRepository;
    private final DailyRateRepository dailyRateRepository;
    private final InventoryService inventoryService;
    private final SecurityService securityService;
    private final RoomUnitRepository roomUnitRepository;
    private final RoomUnitProvisionService roomUnitProvisionService;

    public RoomResponse create(Long hotelId, CreateRoomRequest request) {
        // Tạo phòng mới cho khách sạn thuộc sở hữu hiện tại.
        Hotel hotel = findOwnedHotel(hotelId);

        // ENTIRE hotels: max 1 room type, and that room type must have quantity <= 1.
        if (hotel.getBookingMode() == BookingMode.ENTIRE) {
            long activeRoomCount = roomRepository.findByHotelId(hotel.getId()).stream()
                    .filter(r -> r.getStatus() == null || r.getStatus() == RoomStatus.ACTIVE)
                    .count();
            if (activeRoomCount >= 1) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Cơ sở thuê nguyên căn chỉ được phép có 1 đơn vị phòng");
            }
            // FIX ISSUE-016: A villa/apartment can only ever have quantity=1 (or 0 to deactivate).
            if (request.quantity() > 1) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR,
                        "Cơ sở thuê nguyên căn chỉ được phép có tối đa 1 phòng mỗi loại");
            }
        }

        Room room = new Room();
        room.setName(request.name());
        room.setCapacity(request.capacity());
        room.setQuantity(request.quantity());
        room.setPrice(request.price());
        room.setHotel(hotel);
        room.setRoomCategory(request.roomCategory());
        room.setBedType(request.bedType());
        room.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));
        room.setCustomAmenities(normalizeCustomAmenities(request.customAmenities()));
        room.setImageUrls(normalizeImageUrls(request.imageUrls()));
        room.setCoverImageUrl(resolveCoverImageUrl(null, room.getImageUrls()));
        room.setDescription(request.description());

        roomRepository.save(room);
        inventoryService.generateInventory(room);
        roomUnitProvisionService.syncUnitsWithQuantity(room);

        return mapToResponse(room);
    }

    @Transactional(readOnly = true)
    public List<RoomResponse> getRoomsByHotel(Long hotelId) {
        Hotel hotel = findOwnedHotel(hotelId);
        List<Room> rooms = roomRepository.findByHotelId(hotel.getId())
                .stream()
                .filter(r -> r.getStatus() == null || r.getStatus() == RoomStatus.ACTIVE)
                .toList();

        if (rooms.isEmpty()) return List.of();

        List<Long> roomIds = rooms.stream().map(Room::getId).toList();
        Map<Long, RoomUnitRepository.RoomUnitSummaryRow> summaryMap = roomUnitRepository
                .summarizeByRoomIds(roomIds)
                .stream()
                .collect(Collectors.toMap(RoomUnitRepository.RoomUnitSummaryRow::getRoomId, r -> r));

        return rooms.stream()
                .map(room -> {
                    RoomUnitRepository.RoomUnitSummaryRow row = summaryMap.get(room.getId());
                    RoomUnitSummaryResponse summary = row != null
                            ? new RoomUnitSummaryResponse(row.getTotalCount(), row.getAvailableCount(),
                                    row.getOccupiedCount(), row.getMaintenanceCount(), row.getCleaningCount())
                            : new RoomUnitSummaryResponse(0, 0, 0, 0, 0);
                    return mapToResponseWithSummary(room, summary);
                })
                .toList();
    }

    public RoomResponse update(Long roomId, CreateRoomRequest request) {
        Room room = findOwnedRoom(roomId);
        // FIX ISSUE-016: Enforce ENTIRE mode quantity ceiling on updates too.
        if (room.getHotel().getBookingMode() == BookingMode.ENTIRE && request.quantity() > 1) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    "Cơ sở thuê nguyên căn chỉ được phép có tối đa 1 phòng mỗi loại");
        }
        int oldQuantity = room.getQuantity();
        List<String> normalizedImageUrls = normalizeImageUrls(request.imageUrls());
        room.setName(request.name());
        room.setCapacity(request.capacity());
        room.setQuantity(request.quantity());
        room.setPrice(request.price());
        room.setRoomCategory(request.roomCategory());
        room.setBedType(request.bedType());
        room.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));
        room.setCustomAmenities(normalizeCustomAmenities(request.customAmenities()));
        room.setImageUrls(normalizedImageUrls);
        room.setCoverImageUrl(resolveCoverImageUrl(room.getCoverImageUrl(), room.getImageUrls()));
        room.setDescription(request.description());

        if (oldQuantity != request.quantity()) {
            roomUnitProvisionService.syncUnitsWithQuantity(room);
            inventoryService.generateInventory(room);
        }

        return mapToResponse(room);
    }

    @Transactional(readOnly = true)
    public void assertOwnedRoom(Long roomId) {
        findOwnedRoom(roomId);
    }

    public RoomResponse appendImageUrls(Long roomId, List<String> imageUrls) {
        Room room = findOwnedRoom(roomId);
        room.setImageUrls(mergeImageUrls(room.getImageUrls(), imageUrls));
        // Room dùng cùng quy tắc cover như hotel: cover hợp lệ thì giữ, không thì fallback ảnh đầu tiên.
        room.setCoverImageUrl(resolveCoverImageUrl(room.getCoverImageUrl(), room.getImageUrls()));
        return mapToResponse(room);
    }

    @Transactional(readOnly = true)
    public String getOwnedRoomImageUrl(Long roomId, String imageUrl) {
        Room room = findOwnedRoom(roomId);
        String normalized = normalizeRequiredImageUrl(imageUrl);
        if (!copyImageUrls(room.getImageUrls()).contains(normalized)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Room image not found");
        }
        return normalized;
    }

    public RoomResponse removeImageUrl(Long roomId, String imageUrl) {
        Room room = findOwnedRoom(roomId);
        String normalized = normalizeRequiredImageUrl(imageUrl);

        List<String> updatedImageUrls = copyImageUrls(room.getImageUrls()).stream()
                .filter(existingImageUrl -> !existingImageUrl.equals(normalized))
                .toList();

        if (updatedImageUrls.size() == copyImageUrls(room.getImageUrls()).size()) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Room image not found");
        }

        room.setImageUrls(new ArrayList<>(updatedImageUrls));
        // Xóa ảnh cover hiện tại sẽ tự chuyển sang ảnh đầu tiên còn lại hoặc null nếu gallery rỗng.
        room.setCoverImageUrl(resolveCoverImageUrl(room.getCoverImageUrl(), room.getImageUrls()));
        return mapToResponse(room);
    }

    public RoomResponse setCoverImageUrl(Long roomId, String imageUrl) {
        Room room = findOwnedRoom(roomId);
        String normalized = normalizeRequiredImageUrl(imageUrl);
        if (!copyImageUrls(room.getImageUrls()).contains(normalized)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Cover image must exist in the room gallery");
        }

        // Chỉ đổi ảnh đại diện; danh sách imageUrls không thay đổi.
        room.setCoverImageUrl(normalized);
        return mapToResponse(room);
    }

    public void delete(Long roomId) {
        Room room = findOwnedRoom(roomId);
        if (bookingItemRepository.existsByRoomId(roomId)) {
            room.setStatus(RoomStatus.INACTIVE);
        } else {
            // Delete DailyRate and inventory rows before the Room entity; FK has no cascade.
            dailyRateRepository.deleteByIdRoomId(roomId);
            dailyInventoryRepository.deleteByIdRoomId(roomId);
            roomUnitRepository.deleteByRoomId(roomId);
            roomRepository.delete(room);
        }
    }

    // ---------------- Helper methods ----------------

    private Hotel findOwnedHotel(Long hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!hotel.getOwner().getId().equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return hotel;
    }

    private Room findOwnedRoom(Long roomId) {
        Room room = roomRepository.findByIdWithCollections(roomId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!room.getHotel().getOwner().getId()
                .equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return room;
    }

    private JwtPrincipal getPrincipal() {
        return securityService.getCurrentPrincipal();
    }

    private RoomResponse mapToResponse(Room room) {
        List<RoomUnitRepository.RoomUnitSummaryRow> rows =
                roomUnitRepository.summarizeByRoomIds(List.of(room.getId()));
        RoomUnitSummaryResponse summary;
        if (rows.isEmpty()) {
            summary = new RoomUnitSummaryResponse(0, 0, 0, 0, 0);
        } else {
            RoomUnitRepository.RoomUnitSummaryRow row = rows.get(0);
            summary = new RoomUnitSummaryResponse(
                    row.getTotalCount(), row.getAvailableCount(),
                    row.getOccupiedCount(), row.getMaintenanceCount(),
                    row.getCleaningCount());
        }
        return mapToResponseWithSummary(room, summary);
    }

    private RoomResponse mapToResponseWithSummary(Room room, RoomUnitSummaryResponse unitSummary) {
        return new RoomResponse(
                room.getId(),
                room.getName(),
                room.getCapacity(),
                room.getQuantity(),
                room.getPrice(),
                room.getHotel().getId(),
                room.getRoomCategory(),
                room.getBedType(),
                room.getAmenities(),
                room.getCustomAmenities() == null ? new HashSet<>() : new HashSet<>(room.getCustomAmenities()),
                resolveCoverImageUrl(room.getCoverImageUrl(), room.getImageUrls()),
                copyImageUrls(room.getImageUrls()),
                room.getDescription(),
                unitSummary
        );
    }

    private java.util.Set<String> normalizeCustomAmenities(java.util.Set<String> raw) {
        if (raw == null) return new HashSet<>();
        java.util.Set<String> result = new HashSet<>();
        for (String s : raw) {
            if (s != null) {
                String trimmed = s.trim();
                if (!trimmed.isEmpty() && trimmed.length() <= 100) {
                    result.add(trimmed);
                }
            }
        }
        return result;
    }

    private List<String> normalizeImageUrls(List<String> imageUrls) {
        // Chỉ giữ lại các URL không trống và duy trì thứ tự do người dùng định nghĩa mà không có bản sao trùng lặp.
        if (imageUrls == null || imageUrls.isEmpty()) {
            return new ArrayList<>();
        }

        LinkedHashSet<String> uniqueUrls = new LinkedHashSet<>();
        for (String imageUrl : imageUrls) {
            if (imageUrl == null) {
                continue;
            }

            String normalized = imageUrl.trim();
            if (!normalized.isEmpty()) {
                if (isBase64ImageData(normalized)) {
                    throw new ApiException(
                            ErrorCode.VALIDATION_ERROR,
                            "Base64 image data is not supported; upload files with multipart/form-data first"
                    );
                }
                uniqueUrls.add(normalized);
            }
        }

        return new ArrayList<>(uniqueUrls);
    }

    private List<String> copyImageUrls(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return List.of();
        }

        return List.copyOf(imageUrls);
    }

    private List<String> mergeImageUrls(List<String> currentImageUrls, List<String> imageUrlsToAppend) {
        LinkedHashSet<String> merged = new LinkedHashSet<>();
        merged.addAll(copyImageUrls(currentImageUrls));
        merged.addAll(normalizeImageUrls(imageUrlsToAppend));
        return new ArrayList<>(merged);
    }

    private String normalizeRequiredImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "imageUrl is required");
        }

        return imageUrl.trim();
    }

    private boolean isBase64ImageData(String imageUrl) {
        return imageUrl.toLowerCase(Locale.ROOT).startsWith("data:image");
    }

    private String resolveCoverImageUrl(String preferredCoverImageUrl, List<String> imageUrls) {
        List<String> normalizedImageUrls = copyImageUrls(imageUrls);
        if (normalizedImageUrls.isEmpty()) {
            return null;
        }

        // Giữ cover hiện tại nếu URL đó vẫn còn trong gallery.
        if (preferredCoverImageUrl != null) {
            String normalizedCover = preferredCoverImageUrl.trim();
            if (!normalizedCover.isEmpty() && normalizedImageUrls.contains(normalizedCover)) {
                return normalizedCover;
            }
        }

        // Nếu không còn cover hợp lệ thì lấy ảnh đầu tiên làm ảnh đại diện mặc định.
        return normalizedImageUrls.get(0);
    }
}
