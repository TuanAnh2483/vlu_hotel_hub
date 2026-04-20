package com.hotel.hotel_backend.service.search;

public enum HotelSearchSort {
    PRICE_ASC("price_asc"),
    PRICE_DESC("price_desc"),
    RATING_DESC("rating_desc");

    private final String value;

    HotelSearchSort(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static HotelSearchSort fromValue(String value) {
        for (HotelSearchSort sort : values()) {
            if (sort.value.equals(value)) {
                return sort;
            }
        }

        throw new IllegalArgumentException("Unsupported sort: " + value);
    }
}
