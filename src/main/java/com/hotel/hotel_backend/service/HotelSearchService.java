package com.hotel.hotel_backend.service;


import com.hotel.hotel_backend.dto.response.HotelSearchPageResponse;
import com.hotel.hotel_backend.dto.response.HotelSearchItemResponse;
import com.hotel.hotel_backend.entity.Hotel;
import com.hotel.hotel_backend.mapper.HotelSearchMapper;
import com.hotel.hotel_backend.service.search.HotelAvailabilityService;
import com.hotel.hotel_backend.service.search.HotelCandidateQueryService;
import com.hotel.hotel_backend.service.search.HotelSearchCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchSort;
import com.hotel.hotel_backend.service.search.HotelStayCriteria;
import com.hotel.hotel_backend.service.search.HotelSearchUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HotelSearchService implements HotelSearchUseCase {

    private final HotelCandidateQueryService hotelCandidateQueryService;
    private final HotelAvailabilityService hotelAvailabilityService;
    private final HotelSearchMapper hotelSearchMapper;


    @Override
    public HotelSearchPageResponse search(HotelSearchCriteria criteria) {
        HotelStayCriteria stayCriteria = new HotelStayCriteria(
                criteria.checkIn(),
                criteria.checkOut(),
                criteria.adults(),
                criteria.rooms(),
                criteria.roomCategories(),
                criteria.bedTypes(),
                criteria.roomAmenities()
        );

        List<Hotel> candidateHotels = hotelCandidateQueryService.findCandidates(criteria);
        Map<Long, Long> minPricesByHotelId = hotelAvailabilityService.findAvailableHotelMinPrices(candidateHotels, stayCriteria);

        List<HotelSearchItemResponse> sortedItems = candidateHotels.stream()
                .filter(hotel -> minPricesByHotelId.containsKey(hotel.getId()))
                .map(hotel -> hotelSearchMapper.toItem(
                        hotel,minPricesByHotelId.get(hotel.getId())
                ))
                .sorted(buildSortComparator(criteria.sort()))
                .toList();

        long totalItems = sortedItems.size();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / criteria.size());
        int fromIndex = Math.min((criteria.page() - 1) * criteria.size(), sortedItems.size());
        int toIndex = Math.min(fromIndex + criteria.size(), sortedItems.size());

        List<HotelSearchItemResponse> pageItems = sortedItems.subList(fromIndex, toIndex);

        return new HotelSearchPageResponse(
                pageItems,
                criteria.page(),
                criteria.size(),
                totalItems,
                totalPages,
                criteria.page() < totalPages,
                criteria.sort().value()
        );
    }

    private Comparator<HotelSearchItemResponse> buildSortComparator(HotelSearchSort sort) {
        return switch (sort) {
            case PRICE_ASC -> Comparator
                    .comparing(HotelSearchItemResponse::minPrice, Comparator.nullsLast(Long::compareTo))
                    .thenComparing(HotelSearchItemResponse::hotelId);
            case PRICE_DESC -> Comparator
                    .comparing(HotelSearchItemResponse::minPrice, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(HotelSearchItemResponse::hotelId);
            case RATING_DESC -> Comparator
                    .comparing(HotelSearchItemResponse::ratingAvg, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(HotelSearchItemResponse::hotelId);
        };
    }

}
