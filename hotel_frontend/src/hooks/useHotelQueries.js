import { useQuery, useQueries } from "@tanstack/react-query";
import { hotelService } from "../services/hotelService";

export const hotelKeys = {
  all:       ["hotels"],
  locations: () => ["hotels", "locations"],
  search:    (params) => ["hotels", "search", params],
  detail:    (id)     => ["hotels", "detail", id],
  rooms:     (hotelId, params) => ["hotels", "rooms", hotelId, params],
};

export function useHotelLocations() {
  return useQuery({
    queryKey: hotelKeys.locations(),
    queryFn:  () => hotelService.getLocations(),
    staleTime: 10 * 60 * 1000, // 10 min – locations change rarely
    gcTime:    30 * 60 * 1000,
  });
}

export function useHotelSearch(params, options = {}) {
  return useQuery({
    queryKey: hotelKeys.search(params),
    queryFn:  () => hotelService.searchHotels(params),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

export function useHotelDetail(id, options = {}) {
  return useQuery({
    queryKey: hotelKeys.detail(id),
    queryFn:  () => hotelService.getHotelDetail(id),
    enabled:  Boolean(id),
    staleTime: 5 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    ...options,
  });
}

export function useAvailableRooms(hotelId, params, options = {}) {
  const { checkIn, checkOut } = params || {};
  return useQuery({
    queryKey: hotelKeys.rooms(hotelId, params),
    queryFn:  () => hotelService.getAvailableRooms(hotelId, params),
    enabled:  Boolean(hotelId && checkIn && checkOut),
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

// Fetch hotel counts for multiple destinations in parallel
export function useDestinationCounts(destinations) {
  return useQueries({
    queries: destinations.map((dest) => ({
      queryKey: hotelKeys.search({ province: dest.searchKey, size: 3, sort: "recommended" }),
      queryFn:  () => hotelService.searchHotels({ province: dest.searchKey, size: 3, sort: "recommended" }),
      staleTime: 10 * 60 * 1000,
      gcTime:    30 * 60 * 1000,
      select: (data) => ({ ...dest, count: data.totalItems ?? 0 }),
    })),
  });
}
