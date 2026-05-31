import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewService } from "../services/reviewService";

export const reviewKeys = {
  hotel: (hotelId) => ["reviews", "hotel", hotelId],
  my:    ()        => ["reviews", "my"],
};

export function useHotelReviews(hotelId, options = {}) {
  return useQuery({
    queryKey: reviewKeys.hotel(hotelId),
    queryFn:  () => reviewService.getHotelReviews(hotelId),
    enabled:  Boolean(hotelId),
    staleTime: 3 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    ...options,
  });
}

export function useMyReviews(options = {}) {
  return useQuery({
    queryKey: reviewKeys.my(),
    queryFn:  () => reviewService.getMyReviews(),
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
    ...options,
  });
}

export function useCreateReview(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => reviewService.createReview(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.my() });
    },
    ...options,
  });
}

export function useUpdateReview(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, ...params }) => reviewService.updateReview(reviewId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.my() });
    },
    ...options,
  });
}

export function useDeleteReview(options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId) => reviewService.deleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.my() });
    },
    ...options,
  });
}
