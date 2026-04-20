package com.hotel.hotel_backend.entity;


import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "hotels")
@Getter
@Setter
public class  Hotel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @OneToMany(mappedBy = "hotel")
    private List<Room> rooms;         /// table rooms

    @Column(nullable = false)
    private String name;

    private String address;
    private String province;
    private String district;
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HotelType hotelType = HotelType.HOTEL;

    @ElementCollection(targetClass = HotelAmenity.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "hotel_amenities", joinColumns = @JoinColumn(name = "hotel_id"))
    @Column(name = "amenity", nullable = false)
    @Enumerated(EnumType.STRING)
    private Set<HotelAmenity> amenities = new HashSet<>();


    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(nullable = false)
    private Integer ratingCount = 0;

    @Enumerated(EnumType.STRING)
    private HotelStatus status = HotelStatus.ACTIVE;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        var now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}




