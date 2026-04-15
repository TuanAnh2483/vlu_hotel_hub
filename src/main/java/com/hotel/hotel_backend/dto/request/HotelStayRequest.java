package com.hotel.hotel_backend.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

@Getter
@Setter

public class HotelStayRequest {
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

    @AssertTrue(message = "checkOut must be after checkIn")
    public boolean isDateRangeValid() {
        if (checkIn == null || checkOut == null) {
            return true;
        }

        return checkOut.isAfter(checkIn);
    }
}
