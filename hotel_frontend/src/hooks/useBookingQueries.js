import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingService } from "../services/bookingService";

export const bookingKeys = {
  all:        ["bookings"],
  my:         ()          => ["bookings", "my"],
  detail:     (id)        => ["bookings", "detail", id],
  payments:   (id)        => ["bookings", "payments", id],
  refund:     (id)        => ["bookings", "refund", id],
};

export function useMyBookings(options = {}) {
  return useQuery({
    queryKey: bookingKeys.my(),
    queryFn:  () => bookingService.getMyBookings(),
    staleTime: 60 * 1000, // 1 min
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useBookingDetail(bookingId, options = {}) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn:  () => bookingService.getBooking(bookingId),
    enabled:  Boolean(bookingId),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function usePaymentHistory(bookingId, options = {}) {
  return useQuery({
    queryKey: bookingKeys.payments(bookingId),
    queryFn:  () => bookingService.getPaymentHistory(bookingId),
    enabled:  Boolean(bookingId),
    staleTime: 30 * 1000,
    ...options,
  });
}

export function useRefundRequest(bookingId, options = {}) {
  return useQuery({
    queryKey: bookingKeys.refund(bookingId),
    queryFn:  () => bookingService.getRefundRequest(bookingId),
    enabled:  Boolean(bookingId),
    staleTime: 60 * 1000,
    ...options,
  });
}

export function useGetQuote(options = {}) {
  return useMutation({
    mutationFn: (params) => bookingService.getQuote(params),
    ...options,
  });
}

export function useCreateBooking(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => bookingService.createBooking(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookingKeys.my() }),
    ...options,
  });
}

export function usePayBooking(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...params }) => bookingService.payBooking(bookingId, params),
    onSuccess: (_data, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.my() });
    },
    ...options,
  });
}

export function useCreatePaymentSession(options = {}) {
  return useMutation({
    mutationFn: (bookingId) => bookingService.createPaymentSession(bookingId),
    ...options,
  });
}

export function useCancelBooking(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId) => bookingService.cancelBooking(bookingId),
    onSuccess: (_data, bookingId) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.my() });
    },
    ...options,
  });
}

export function useCreateRefundRequest(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...params }) =>
      bookingService.createRefundRequest(bookingId, params),
    onSuccess: (_data, { bookingId }) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.refund(bookingId) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
    },
    ...options,
  });
}
