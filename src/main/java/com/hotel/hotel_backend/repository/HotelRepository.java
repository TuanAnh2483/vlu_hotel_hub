package com.hotel.hotel_backend.repository;

import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.entity.HotelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HotelRepository extends JpaRepository<Hotel, Long> {
 List<Hotel>  findByOwnerId(Long ownerId );

 List<Hotel> findByProvinceAndStatus(String province, HotelStatus status);

 List<Hotel> findByProvinceAndDistrictAndStatus(String province, String district, HotelStatus status);
}
