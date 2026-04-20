package com.hotel.hotel_backend.mapper;


import com.hotel.hotel_backend.dto.request.BookingContactRequest;
import com.hotel.hotel_backend.dto.response.BookingContactResponse;
import com.hotel.hotel_backend.dto.response.BookingItemResponse;
import com.hotel.hotel_backend.dto.response.BookingResponse;
import com.hotel.hotel_backend.entity.BookingContact;
import com.hotel.hotel_backend.entity.Booking;
import org.springframework.stereotype.Component;
import org.modelmapper.ModelMapper;


@Component
public class BookingMapper {

    private final ModelMapper modelMapper ;

    public BookingMapper(ModelMapper modelMapper) {
        this.modelMapper = modelMapper;
    }
    /**
     * Convert CreateBookingRequest → Booking Entity
     */

    public BookingContact toBookingContact(BookingContactRequest bookingContactRequest) {
        return modelMapper.map(bookingContactRequest, BookingContact.class);
    }

    // convert entity thành response DTO
    public BookingResponse toBookingResponse(Booking booking) {
        BookingContactResponse contactResponse = null;
        if (booking.getContact() != null) {
            contactResponse = new BookingContactResponse(
                    booking.getContact().getName(),
                    booking.getContact().getEmail(),
                    booking.getContact().getPhone()
            );
        }

        return new BookingResponse(
                booking.getId(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                booking.getTotalPrice(),
                booking.getStatus().name(),
                booking.getExpiresAt(),
                booking.getItems().stream()
                        .map(item -> new BookingItemResponse(
                                item.getRoom().getId(),
                                item.getRoom().getName(),
                                item.getQuantity(),
                                item.getPrice()
                        ))
                        .toList(),
                contactResponse
        );

    }






}
