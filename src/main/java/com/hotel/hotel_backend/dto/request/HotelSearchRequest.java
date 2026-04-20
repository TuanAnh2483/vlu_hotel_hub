package com.hotel.hotel_backend.dto.request;

import com.hotel.hotel_backend.entity.BedType;
import com.hotel.hotel_backend.entity.HotelAmenity;
import com.hotel.hotel_backend.entity.HotelType;
import com.hotel.hotel_backend.entity.RoomCategory;
import com.hotel.hotel_backend.entity.RoomAmenity;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class HotelSearchRequest {

    @NotBlank(message = "Khong duoc trong")
    private String province;

    private String district;

    @NotNull
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkIn;

    @NotNull
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate checkOut;

    @NotNull
    @Min(value = 1, message = "Quantity must be >= 1")
    private Integer adults = 1;

    @NotNull
    @Min(value = 1, message = "Quantity must be >= 1")
    private Integer rooms = 1;

    @NotNull
    @Min(value = 1, message = "Page must be >= 1")
    private Integer page = 1;

    @NotNull
    @Min(value = 1, message = "Size must be >= 1")
    @Max(value = 50, message = "Size must be <= 50")
    private Integer size = 10;

    @NotBlank(message = "Sort is required")
    @Pattern(
            regexp = "price_asc|price_desc|rating_desc",
            message = "Sort must be one of: price_asc, price_desc, rating_desc"
    )
    private String sort = "price_asc";

    private List<HotelType> hotelTypes = new ArrayList<>();

    private List<RoomCategory> roomCategories = new ArrayList<>();

    private List<BedType> bedTypes = new ArrayList<>();

    private List<HotelAmenity> hotelAmenities = new ArrayList<>();

    private List<RoomAmenity> roomAmenities = new ArrayList<>();

    @AssertTrue(message = "checkOut must be after checkIn")
    public boolean isDateRangeValid() {
        if (checkIn == null || checkOut == null) {
            return true;
        }

        return checkOut.isAfter(checkIn);
    }
}
