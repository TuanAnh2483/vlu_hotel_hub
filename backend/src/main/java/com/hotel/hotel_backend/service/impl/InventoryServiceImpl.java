package com.hotel.hotel_backend.service.impl;

import com.hotel.hotel_backend.entity.DailyInventory;
import com.hotel.hotel_backend.entity.DailyInventoryId;
import com.hotel.hotel_backend.entity.Room;
import com.hotel.hotel_backend.exception.ApiException;
import com.hotel.hotel_backend.exception.ErrorCode;
import com.hotel.hotel_backend.repository.DailyInventoryRepository;
import com.hotel.hotel_backend.repository.DailyRateRepository;
import com.hotel.hotel_backend.service.InventoryService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private static final int DEFAULT_INVENTORY_DAYS = 365;

    private final DailyInventoryRepository dailyInventoryRepository;
    private final DailyRateRepository dailyRateRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void generateInventory(Room room) {
        LocalDate today = LocalDate.now();
        initInventory(room.getId(), today, today.plusDays(DEFAULT_INVENTORY_DAYS), room.getQuantity());
    }

    /**
     * CREATE-OR-CAP operation on DailyInventory rows:
     * - Missing dates → create with availableRooms = totalRooms
     * - Existing rows with availableRooms > totalRooms → cap down (prevents stale inventory after quantity decrease)
     * - Existing rows with availableRooms <= totalRooms → leave untouched (respect partner-set ceiling)
     */
    @Override
    @Transactional
    public void initInventory(Long roomId,
                              LocalDate startDate,
                              LocalDate endDate,
                              int totalRooms) {
        if (startDate == null || endDate == null || !endDate.isAfter(startDate)) {
            return;
        }

        List<DailyInventory> existing = dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId, startDate, endDate.minusDays(1));

        Map<LocalDate, DailyInventory> existingMap = new HashMap<>();
        for (DailyInventory inv : existing) {
            existingMap.put(inv.getId().getDate(), inv);
        }

        Room roomRef = entityManager.getReference(Room.class, roomId);
        List<DailyInventory> toCreate = new ArrayList<>();
        List<DailyInventory> toUpdate = new ArrayList<>();

        for (LocalDate date = startDate; date.isBefore(endDate); date = date.plusDays(1)) {
            if (existingMap.containsKey(date)) {
                DailyInventory inv = existingMap.get(date);
                if (inv.getAvailableRooms() > totalRooms) {
                    // Cap availableRooms down; never go below existing blockedRooms.
                    int safeAvailable = Math.max(inv.getBlockedRooms(), totalRooms);
                    if (inv.getBlockedRooms() > totalRooms) {
                        log.warn("Inventory inconsistency: blockedRooms={} exceeds new totalRooms={} for roomId={} on date={}",
                                inv.getBlockedRooms(), totalRooms, roomId, date);
                    }
                    inv.setAvailableRooms(safeAvailable);
                    toUpdate.add(inv);
                }
                // availableRooms <= totalRooms: leave as-is (partner-set ceiling respected)
                continue;
            }

            DailyInventory inventory = new DailyInventory();
            inventory.setId(new DailyInventoryId(roomId, date));
            inventory.setRoom(roomRef);
            inventory.setAvailableRooms(totalRooms);
            inventory.setBlockedRooms(0);
            toCreate.add(inventory);
        }

        if (!toCreate.isEmpty()) dailyInventoryRepository.saveAll(toCreate);
        if (!toUpdate.isEmpty()) dailyInventoryRepository.saveAll(toUpdate);
    }

    /** Returns false when any date in the range has DailyRate.isClosed = true. */
    @Override
    @Transactional(readOnly = true)
    public boolean checkAvailability(Long roomId,
                                     LocalDate checkIn,
                                     LocalDate checkOut,
                                     int quantity) {
        long nights = nightsBetween(checkIn, checkOut);
        if (nights <= 0) return false;

        // Reject if any date in range is explicitly closed by the partner.
        if (dailyRateRepository.existsClosedDateInRange(roomId, checkIn, checkOut.minusDays(1))) {
            return false;
        }

        List<DailyInventory> inventories = loadInventories(roomId, checkIn, checkOut);
        if (!isCompleteRange(nights, inventories)) return false;

        return hasEnoughRooms(inventories, quantity);
    }

    /** Throws CONFLICT when any date in the range is closed by the partner. */
    @Override
    @Transactional
    public void reserveInventory(Long roomId,
                                 LocalDate checkIn,
                                 LocalDate checkOut,
                                 int quantity) {
        long nights = requireValidRangeForReserve(checkIn, checkOut);

        // Enforce isClosed before touching inventory.
        if (dailyRateRepository.existsClosedDateInRange(roomId, checkIn, checkOut.minusDays(1))) {
            throw new ApiException(ErrorCode.CONFLICT,
                    "Room is closed for one or more dates in the requested range");
        }

        List<DailyInventory> inventories = loadInventories(roomId, checkIn, checkOut);
        ensureCompleteRangeForReserve(nights, inventories);

        if (!hasEnoughRooms(inventories, quantity)) {
            throw new ApiException(ErrorCode.CONFLICT, "Not enough rooms available");
        }

        for (DailyInventory inventory : inventories) {
            inventory.setBlockedRooms(inventory.getBlockedRooms() + quantity);
        }
        dailyInventoryRepository.saveAll(inventories);
    }

    @Override
    @Transactional
    public void releaseInventory(Long roomId,
                                 LocalDate checkIn,
                                 LocalDate checkOut,
                                 int quantity) {
        long nights = requireValidRangeForRelease(checkIn, checkOut);

        List<DailyInventory> inventories = loadInventories(roomId, checkIn, checkOut);
        ensureCompleteRangeForRelease(nights, inventories);

        for (DailyInventory inventory : inventories) {
            int nextBlocked = inventory.getBlockedRooms() - quantity;
            if (nextBlocked < 0) {
                throw new ApiException(ErrorCode.CONFLICT, "Inventory release underflow");
            }
            inventory.setBlockedRooms(nextBlocked);
        }
        dailyInventoryRepository.saveAll(inventories);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private List<DailyInventory> loadInventories(Long roomId, LocalDate checkIn, LocalDate checkOut) {
        return dailyInventoryRepository.findByIdRoomIdAndIdDateBetween(
                roomId, checkIn, checkOut.minusDays(1));
    }

    private long nightsBetween(LocalDate checkIn, LocalDate checkOut) {
        return ChronoUnit.DAYS.between(checkIn, checkOut);
    }

    private boolean isCompleteRange(long nights, List<DailyInventory> inventories) {
        return inventories.size() == nights;
    }

    private boolean hasEnoughRooms(List<DailyInventory> inventories, int quantity) {
        return inventories.stream().allMatch(inv ->
                inv.getAvailableRooms() - inv.getBlockedRooms() >= quantity);
    }

    private long requireValidRangeForReserve(LocalDate checkIn, LocalDate checkOut) {
        long nights = nightsBetween(checkIn, checkOut);
        if (nights <= 0) throw new IllegalArgumentException("Invalid date range");
        return nights;
    }

    private long requireValidRangeForRelease(LocalDate checkIn, LocalDate checkOut) {
        long nights = nightsBetween(checkIn, checkOut);
        if (nights <= 0) throw new ApiException(ErrorCode.VALIDATION_ERROR, "Invalid date range");
        return nights;
    }

    private void ensureCompleteRangeForReserve(long nights, List<DailyInventory> inventories) {
        if (!isCompleteRange(nights, inventories))
            throw new IllegalStateException("Inventory data incomplete for given range");
    }

    private void ensureCompleteRangeForRelease(long nights, List<DailyInventory> inventories) {
        if (!isCompleteRange(nights, inventories))
            throw new ApiException(ErrorCode.CONFLICT, "Inventory data incomplete for given range");
    }

    @Override
    @Transactional
    public void capInventory(Long roomId, int newQuantity) {
        dailyInventoryRepository.capAvailableRooms(roomId, LocalDate.now(), newQuantity);
    }

    @Override
    @Transactional
    public void restoreOneUnit(Long roomId, int maxCapacity) {
        if (maxCapacity <= 0) return;
        dailyInventoryRepository.incrementAvailableRoomsUpTo(roomId, LocalDate.now(), maxCapacity);
    }
}
