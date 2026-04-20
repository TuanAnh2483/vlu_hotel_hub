package com.hotel.hotel_backend.dto.request;


import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class  CreateBookingRequest {
     @NotNull(message = "checkIn is required")
     @FutureOrPresent(message = "checkIn must be today or in the future")
     private LocalDate checkIn;

     @NotNull(message = "checkOut is required")
     @Future(message = "checkOut must be in the future")
     private LocalDate checkOut;

     @Valid
     @NotNull(message = "room is required")
     @Size(min = 1, message = "room must have at least 1 item")
     private List<BookingRoomRequest> room;

     @Valid
     @NotNull(message = "contact is required")
     private BookingContactRequest contact;

     @AssertTrue(message = "checkOut must be after checkIn")
     public boolean isDateRangeValid() {
          if (checkIn == null || checkOut == null) {
               return true;
          }
          return checkOut.isAfter(checkIn);
     }


}
