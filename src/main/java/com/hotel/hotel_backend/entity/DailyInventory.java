package com.hotel.hotel_backend.entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name= "daily_inventory")
@Getter
@Setter
@NoArgsConstructor


public class DailyInventory {
    @EmbeddedId
    private DailyInventoryId id;

    @MapsId("roomId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id",nullable = false)
    private Room room;

    @Column(name = "available_rooms", nullable = false)
    private Integer availableRooms;
    @Column(name = "blocked_rooms",nullable = false)
    private Integer blockedRooms;
    @Version
    private Integer version;
}
