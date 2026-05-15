import apiClient from "./apiClient";

export const reviewService = {
  async getHotelReviews(hotelId) {
    try {
      const data = await apiClient.get(`/api/hotels/${hotelId}/reviews`);
      const list = Array.isArray(data) ? data : [];
      return list.map((review) => ({
        id:               review.reviewId,
        bookingId:        review.bookingId,
        hotelId:          review.hotelId,
        rating:           review.rating,
        comment:          review.comment,
        reviewerName:     review.reviewerName,
        partnerReply:     review.partnerReply,
        createdAt:        review.createdAt,
        updatedAt:        review.updatedAt,
        partnerRepliedAt: review.partnerRepliedAt,
      }));
    } catch { return []; }
  },

  async getMyReviews() {
    try {
      const data = await apiClient.get("/api/reviews/me");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  createReview({ bookingId, rating, comment }) {
    return apiClient.post("/api/reviews", { bookingId, rating, comment });
  },

  updateReview(reviewId, { rating, comment }) {
    return apiClient.put(`/api/reviews/${reviewId}`, { rating, comment });
  },

  deleteReview(reviewId) {
    return apiClient.delete(`/api/reviews/${reviewId}`);
  },
};
