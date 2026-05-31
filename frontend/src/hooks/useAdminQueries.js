import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../services/adminService";

export const adminKeys = {
  stats:        ()         => ["admin", "stats"],
  applications: (status)   => ["admin", "partner-applications", status],
  users:        (search)   => ["admin", "users", search],
  hotels:       ()         => ["admin", "hotels"],
  hotelRooms:   (hotelId)  => ["admin", "hotels", hotelId, "rooms"],
  bookings:     (status)   => ["admin", "bookings", status],
  refunds:      (status)   => ["admin", "refunds", status],
  reviews:      ()         => ["admin", "reviews"],
  system:       ()         => ["admin", "system"],
};

export function useAdminStats(options = {}) {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn:  () => adminService.getStats(),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function usePartnerApplications(status, options = {}) {
  return useQuery({
    queryKey: adminKeys.applications(status),
    queryFn:  () => adminService.getPartnerApplications(status),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useApprovePartner(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId) => adminService.approvePartner(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "partner-applications"] }),
    ...options,
  });
}

export function useRejectPartner(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, reason }) => adminService.rejectPartner(applicationId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "partner-applications"] }),
    ...options,
  });
}

export function useAdminUsers(search, options = {}) {
  return useQuery({
    queryKey: adminKeys.users(search),
    queryFn:  () => adminService.getUsers(search),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useToggleUserStatus(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => adminService.toggleUserStatus(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    ...options,
  });
}

export function useCreateAdminUser(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => adminService.createUser(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    ...options,
  });
}

export function useAdminHotels(options = {}) {
  return useQuery({
    queryKey: adminKeys.hotels(),
    queryFn:  () => adminService.getHotels(),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useAdminHotelRooms(hotelId, options = {}) {
  return useQuery({
    queryKey: adminKeys.hotelRooms(hotelId),
    queryFn:  () => adminService.getHotelRooms(hotelId),
    enabled:  !!hotelId,
    staleTime: 60 * 1000,
    ...options,
  });
}

export function useUpdateAdminHotel(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, ...data }) => adminService.updateHotel(hotelId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.hotels() }),
    ...options,
  });
}

export function useDeleteAdminHotel(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hotelId) => adminService.deleteHotel(hotelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.hotels() }),
    ...options,
  });
}

export function useAdminBookings(status, options = {}) {
  return useQuery({
    queryKey: adminKeys.bookings(status),
    queryFn:  () => adminService.getBookings(status),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useAdminRefunds(status, options = {}) {
  return useQuery({
    queryKey: adminKeys.refunds(status),
    queryFn:  () => adminService.getRefunds(status),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useUpdateRefundStatus(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ refundId, newStatus, transferNote }) => adminService.updateRefundStatus(refundId, newStatus, transferNote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "refunds"] }),
    ...options,
  });
}

export function useAdminReviews(options = {}) {
  return useQuery({
    queryKey: adminKeys.reviews(),
    queryFn:  () => adminService.getReviews(),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useDeleteAdminReview(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId) => adminService.deleteReview(reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.reviews() }),
    ...options,
  });
}

export function useAdminSystem(options = {}) {
  return useQuery({
    queryKey: adminKeys.system(),
    queryFn:  () => adminService.getSystemData(),
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}
