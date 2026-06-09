package com.hotel.hotel_backend.service;

import com.hotel.hotel_backend.dto.request.CreateHotelRequest;
import com.hotel.hotel_backend.dto.request.UpdateHotelRequest;
import com.hotel.hotel_backend.dto.response.HotelResponse;
import com.hotel.hotel_backend.entity.BookingMode;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelStatus;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomStatus;
import com.hotel.hotel_backend.entity.User;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.BookingItemRepository;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.repository.HotelRepository;
import com.hotel.hotel_backend.repository.RoomRepository;
import com.hotel.hotel_backend.repository.RoomUnitRepository;
import com.hotel.hotel_backend.repository.UserRepository;
import com.hotel.hotel_backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class HotelService {

    private final HotelRepository hotelRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final RoomUnitRepository roomUnitRepository;
    private final BookingItemRepository bookingItemRepository;
    private final DailyInventoryRepository dailyInventoryRepository;
    private final DailyRateRepository dailyRateRepository;
    private final SecurityService securityService;

    @CacheEvict(value = "locationOptions", allEntries = true)
    public HotelResponse create(CreateHotelRequest request) {
        // Tạo khách sạn mới cho partner hiện tại.
        User owner = getCurrentUser();

        String normalizedName = normalizeRequiredText(request.name());
        if (hotelRepository.existsByOwnerIdAndNameIgnoreCase(owner.getId(), normalizedName)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bạn đã có cơ sở lưu trú với tên này");
        }

        Hotel hotel = new Hotel();
        hotel.setName(normalizedName);
        hotel.setAddress(normalizeRequiredText(request.address()));
        hotel.setDistrict(LocationNormalizer.normalizeDistrictLabel(request.district()));
        hotel.setProvince(LocationNormalizer.normalizeProvinceLabel(request.province()));
        hotel.setOwner(owner);
        hotel.setDescription(normalizeOptionalText(request.description()));
        hotel.setHotelType(request.hotelType());
        hotel.setBookingMode(resolveBookingMode(request.bookingMode(), request.hotelType()));
        hotel.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));
        hotel.setCustomAmenities(normalizeCustomAmenities(request.customAmenities()));
        hotel.setImageUrls(normalizeImageUrls(request.imageUrls()));
        hotel.setCoverImageUrl(resolveCoverImageUrl(null, hotel.getImageUrls()));
        hotel.setCancellationPolicy(request.cancellationPolicy() != null ? request.cancellationPolicy() : com.hotel.hotel_backend.entity.CancellationPolicy.MODERATE);
        hotelRepository.save(hotel);

        return mapToResponse(hotel);
    }

    @Transactional(readOnly = true)
    public List<HotelResponse> getMyHotels() {
        // Lấy danh sách khách sạn của partner hiện tại.
        Long userId = getPrincipal().userId();

        return hotelRepository.findByOwnerId(userId)
                .stream()
                .filter(h -> h.getStatus() == null || h.getStatus() != HotelStatus.BLOCKED)
                .map(this::mapToResponse)
                .toList();
    }

    @CacheEvict(value = "locationOptions", allEntries = true)
    public HotelResponse update(Long id, UpdateHotelRequest request) {
        // Cập nhật thông tin khách sạn thuộc sở hữu hiện tại.
        Hotel hotel = findOwnedHotel(id);

        String normalizedName = normalizeRequiredText(request.name());
        if (hotelRepository.existsByOwnerIdAndNameIgnoreCaseAndIdNot(hotel.getOwner().getId(), normalizedName, id)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Bạn đã có cơ sở lưu trú với tên này");
        }

        hotel.setName(normalizedName);
        hotel.setAddress(normalizeRequiredText(request.address()));
        hotel.setDistrict(LocationNormalizer.normalizeDistrictLabel(request.district()));
        hotel.setProvince(LocationNormalizer.normalizeProvinceLabel(request.province()));
        hotel.setDescription(normalizeOptionalText(request.description()));
        hotel.setHotelType(request.hotelType());
        hotel.setBookingMode(resolveBookingMode(request.bookingMode(), request.hotelType()));
        hotel.setAmenities(request.amenities() == null ? new HashSet<>() : new HashSet<>(request.amenities()));
        hotel.setCustomAmenities(normalizeCustomAmenities(request.customAmenities()));
        hotel.setImageUrls(normalizeImageUrls(request.imageUrls()));
        hotel.setCoverImageUrl(resolveCoverImageUrl(hotel.getCoverImageUrl(), hotel.getImageUrls()));
        if (request.cancellationPolicy() != null) {
            hotel.setCancellationPolicy(request.cancellationPolicy());
        }

        return mapToResponse(hotel);
    }

    @Transactional(readOnly = true)
    public void assertOwnedHotel(Long id) {
        findOwnedHotel(id);
    }

    public HotelResponse appendImageUrls(Long id, List<String> imageUrls) {
        Hotel hotel = findOwnedHotel(id);
        hotel.setImageUrls(mergeImageUrls(hotel.getImageUrls(), imageUrls));
        // Nếu chưa có cover hợp lệ thì lấy ảnh đầu tiên trong gallery làm cover mặc định.
        hotel.setCoverImageUrl(resolveCoverImageUrl(hotel.getCoverImageUrl(), hotel.getImageUrls()));
        return mapToResponse(hotel);
    }

    @Transactional(readOnly = true)
    public String getOwnedHotelImageUrl(Long id, String imageUrl) {
        Hotel hotel = findOwnedHotel(id);
        String normalized = normalizeRequiredImageUrl(imageUrl);
        if (!copyImageUrls(hotel.getImageUrls()).contains(normalized)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Hotel image not found");
        }
        return normalized;
    }

    public HotelResponse removeImageUrl(Long id, String imageUrl) {
        Hotel hotel = findOwnedHotel(id);
        String normalized = normalizeRequiredImageUrl(imageUrl);

        List<String> updatedImageUrls = copyImageUrls(hotel.getImageUrls()).stream()
                .filter(existingImageUrl -> !existingImageUrl.equals(normalized))
                .toList();

        if (updatedImageUrls.size() == copyImageUrls(hotel.getImageUrls()).size()) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Hotel image not found");
        }

        hotel.setImageUrls(new ArrayList<>(updatedImageUrls));
        // Nếu vừa xóa đúng ảnh cover thì resolveCoverImageUrl sẽ tự fallback sang ảnh đầu tiên còn lại.
        hotel.setCoverImageUrl(resolveCoverImageUrl(hotel.getCoverImageUrl(), hotel.getImageUrls()));
        return mapToResponse(hotel);
    }

    public HotelResponse setCoverImageUrl(Long id, String imageUrl) {
        Hotel hotel = findOwnedHotel(id);
        String normalized = normalizeRequiredImageUrl(imageUrl);
        if (!copyImageUrls(hotel.getImageUrls()).contains(normalized)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Cover image must exist in the hotel gallery");
        }

        // Cover chỉ là một URL tham chiếu đến ảnh đã có, không sinh bản sao dữ liệu mới.
        hotel.setCoverImageUrl(normalized);
        return mapToResponse(hotel);
    }

    @CacheEvict(value = "locationOptions", allEntries = true)
    @Transactional
    public void delete(Long id) {
        Hotel hotel = findOwnedHotel(id);
        var rooms = roomRepository.findByHotelId(id);

        if (bookingItemRepository.existsByRoomHotelId(id)) {
            // Có booking tham chiếu → soft-delete để giữ lịch sử
            rooms.forEach(r -> r.setStatus(RoomStatus.INACTIVE));
            hotel.setStatus(HotelStatus.INACTIVE);
        } else {
            // Chưa có booking nào → hard-delete thật sự
            var roomIds = rooms.stream().map(r -> r.getId()).toList();
            if (!roomIds.isEmpty()) {
                // Delete child rows before rooms to avoid FK constraint violation (no cascade on FK).
                dailyRateRepository.deleteByIdRoomIdIn(roomIds);
                dailyInventoryRepository.deleteByIdRoomIdIn(roomIds);
                roomIds.forEach(roomUnitRepository::deleteByRoomId);
            }
            roomRepository.deleteAll(rooms);
            hotelRepository.delete(hotel);
        }
    }

    // ---------------- Helper methods ----------------

    private Hotel findOwnedHotel(Long id) {
        Hotel hotel = hotelRepository.findByIdWithCollections(id)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));

        if (!hotel.getOwner().getId().equals(getPrincipal().userId())) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return hotel;
    }

    private JwtPrincipal getPrincipal() {
        return securityService.getCurrentPrincipal();
    }

    private User getCurrentUser() {
        return userRepository.findById(getPrincipal().userId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND));
    }

    private HotelResponse mapToResponse(Hotel hotel) {
        return new HotelResponse(
                hotel.getId(),
                hotel.getName(),
                hotel.getAddress(),
                hotel.getDistrict(),
                hotel.getProvince(),
                hotel.getDescription(),
                hotel.getHotelType(),
                hotel.getBookingMode() != null ? hotel.getBookingMode() : BookingMode.BY_ROOM,
                hotel.getAmenities(),
                hotel.getCustomAmenities() == null ? new HashSet<>() : new HashSet<>(hotel.getCustomAmenities()),
                hotel.getRatingAvg(),
                hotel.getRatingCount(),
                resolveCoverImageUrl(hotel.getCoverImageUrl(), hotel.getImageUrls()),
                copyImageUrls(hotel.getImageUrls()),
                hotel.getStatus() != null ? hotel.getStatus() : HotelStatus.ACTIVE,
                hotel.getCancellationPolicy() != null ? hotel.getCancellationPolicy() : com.hotel.hotel_backend.entity.CancellationPolicy.MODERATE
        );
    }

    /**
     * Nếu partner truyền bookingMode tường minh thì dùng, ngược lại tự derive từ hotelType.
     * VILLA, APARTMENT → ENTIRE; tất cả còn lại → BY_ROOM.
     */
    private BookingMode resolveBookingMode(BookingMode requested, HotelType hotelType) {
        if (requested != null) {
            return requested;
        }
        if (hotelType == HotelType.VILLA || hotelType == HotelType.APARTMENT) {
            return BookingMode.ENTIRE;
        }
        return BookingMode.BY_ROOM;
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

    private String normalizeRequiredText(String value) {
        return value.trim();
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String resolveCoverImageUrl(String preferredCoverImageUrl, List<String> imageUrls) {
        List<String> normalizedImageUrls = copyImageUrls(imageUrls);
        if (normalizedImageUrls.isEmpty()) {
            return null;
        }

        // Nếu cover cũ vẫn còn tồn tại trong gallery thì giữ nguyên.
        if (preferredCoverImageUrl != null) {
            String normalizedCover = preferredCoverImageUrl.trim();
            if (!normalizedCover.isEmpty() && normalizedImageUrls.contains(normalizedCover)) {
                return normalizedCover;
            }
        }

        // Nếu cover cũ bị xóa hoặc chưa từng có thì lấy ảnh đầu tiên làm cover mặc định.
        return normalizedImageUrls.get(0);
    }
}
