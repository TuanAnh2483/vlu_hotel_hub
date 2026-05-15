import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnerService } from "../services/partnerService";

export const partnerKeys = {
  catalog:     ()                => ["partner", "catalog"],
  hotels:      ()                => ["partner", "hotels"],
  rooms:       (hotelId)         => ["partner", "rooms", hotelId],
  bookings:    (params)          => ["partner", "bookings", params],
  booking:     (id)              => ["partner", "booking", id],
  analytics:   (params)          => ["partner", "analytics", params],
  calendar:    (roomId, params)  => ["partner", "calendar", roomId, params],
  refunds:     (params)          => ["partner", "refunds", params],
  priceSugs:   (roomId, from, to) => ["partner", "price-suggestions", roomId, from, to],
  revenue:     (roomId)          => ["partner", "revenue", roomId],
  reviews:     (params)          => ["partner", "reviews", params],
};

// ── Catalog ──────────────────────────────────────────────────────────
export function useCatalogOptions(options = {}) {
  return useQuery({
    queryKey: partnerKeys.catalog(),
    queryFn:  () => partnerService.getCatalogOptions(),
    staleTime: 30 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    ...options,
  });
}

// ── Hotels ───────────────────────────────────────────────────────────
export function useMyHotels(options = {}) {
  return useQuery({
    queryKey: partnerKeys.hotels(),
    queryFn:  () => partnerService.getMyHotels(),
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

export function useCreateHotel(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => partnerService.createHotel(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

export function useUpdateHotel(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => partnerService.updateHotel(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

export function useDeleteHotel(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => partnerService.deleteHotel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

export function useUploadHotelImages(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files }) => partnerService.uploadHotelImages(id, files),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

export function useDeleteHotelImage(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageUrl }) => partnerService.deleteHotelImage(id, imageUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

export function useSetHotelCoverImage(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, imageUrl }) => partnerService.setHotelCoverImage(id, imageUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.hotels() }),
    ...options,
  });
}

// ── Rooms ─────────────────────────────────────────────────────────────
export function usePartnerRooms(hotelId, options = {}) {
  return useQuery({
    queryKey: partnerKeys.rooms(hotelId),
    queryFn:  () => partnerService.getRooms(hotelId),
    enabled:  Boolean(hotelId),
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

export function useCreateRoom(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, ...data }) => partnerService.createRoom(hotelId, data),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

export function useUpdateRoom(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, hotelId, ...data }) => partnerService.updateRoom(roomId, data),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

export function useDeleteRoom(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, hotelId }) => partnerService.deleteRoom(roomId),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

export function useUploadRoomImages(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, hotelId, files }) => partnerService.uploadRoomImages(roomId, files),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

export function useDeleteRoomImage(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, hotelId, imageUrl }) =>
      partnerService.deleteRoomImage(roomId, imageUrl),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

export function useSetRoomCoverImage(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, hotelId, imageUrl }) =>
      partnerService.setRoomCoverImage(roomId, imageUrl),
    onSuccess: (_data, { hotelId }) =>
      queryClient.invalidateQueries({ queryKey: partnerKeys.rooms(hotelId) }),
    ...options,
  });
}

// ── Bookings ──────────────────────────────────────────────────────────
export function usePartnerBookings(params, options = {}) {
  return useQuery({
    queryKey: partnerKeys.bookings(params),
    queryFn:  () => partnerService.getBookings(params),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function usePartnerBookingDetail(bookingId, options = {}) {
  return useQuery({
    queryKey: partnerKeys.booking(bookingId),
    queryFn:  () => partnerService.getBooking(bookingId),
    enabled:  Boolean(bookingId),
    staleTime: 60 * 1000,
    ...options,
  });
}

export function useCompleteBooking(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId) => partnerService.completeBooking(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner", "bookings"] }),
    ...options,
  });
}

// ── Analytics ─────────────────────────────────────────────────────────
export function useAnalyticsSummary(params, options = {}) {
  return useQuery({
    queryKey: partnerKeys.analytics(params),
    queryFn:  () => partnerService.getAnalyticsSummary(params),
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

// ── Calendar ──────────────────────────────────────────────────────────
export function useRoomCalendar(roomId, params, options = {}) {
  return useQuery({
    queryKey: partnerKeys.calendar(roomId, params),
    queryFn:  () => partnerService.getRoomCalendar(roomId, params),
    enabled:  Boolean(roomId && params?.from && params?.to),
    staleTime: 60 * 1000,
    ...options,
  });
}

export function useUpdateRoomCalendar(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, ...data }) => partnerService.updateRoomCalendar(roomId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner", "calendar"] }),
    ...options,
  });
}

// ── Refunds ───────────────────────────────────────────────────────────
export function usePartnerRefunds(params, options = {}) {
  return useQuery({
    queryKey: partnerKeys.refunds(params),
    queryFn:  () => partnerService.getRefunds(params),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useApproveRefund(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refundRequestId) => partnerService.approveRefund(refundRequestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner", "refunds"] }),
    ...options,
  });
}

export function useRejectRefund(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refundRequestId) => partnerService.rejectRefund(refundRequestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner", "refunds"] }),
    ...options,
  });
}

// ── AI Price ──────────────────────────────────────────────────────────
export function usePriceSuggestions(roomId, from, to, options = {}) {
  return useQuery({
    queryKey: partnerKeys.priceSugs(roomId, from, to),
    queryFn:  () => partnerService.getPriceSuggestions(roomId, from, to),
    enabled:  Boolean(roomId && from && to),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useSubmitPriceFeedback(options = {}) {
  return useMutation({
    mutationFn: ({ roomId, ...payload }) => partnerService.submitPriceFeedback(roomId, payload),
    ...options,
  });
}

export function useRevenueAnalytics(roomId, options = {}) {
  return useQuery({
    queryKey: partnerKeys.revenue(roomId),
    queryFn:  () => partnerService.getRevenueAnalytics(roomId),
    enabled:  Boolean(roomId),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useTriggerTraining(options = {}) {
  return useMutation({
    mutationFn: (roomId) => partnerService.triggerTraining(roomId),
    ...options,
  });
}

// ── Reviews ───────────────────────────────────────────────────────────
export function usePartnerReviews(params, options = {}) {
  return useQuery({
    queryKey: partnerKeys.reviews(params),
    queryFn:  () => partnerService.getReviews(params),
    staleTime: 2 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

export function useReplyReview(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, reply }) => partnerService.replyReview(reviewId, reply),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["partner", "reviews"] }),
    ...options,
  });
}

// ── Onboarding ────────────────────────────────────────────────────────
export function useStartOnboarding(options = {}) {
  return useMutation({
    mutationFn: (data) => partnerService.startOnboarding(data),
    ...options,
  });
}

export function useSubmitOnboarding(options = {}) {
  return useMutation({
    mutationFn: (applicationId) => partnerService.submitOnboarding(applicationId),
    ...options,
  });
}
