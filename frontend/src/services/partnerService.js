import apiClient from "./apiClient";

function buildImageFormData(files) {
  const formData = new FormData();
  Array.from(files || []).forEach((file) => formData.append("files", file));
  return formData;
}

export const partnerService = {
  getCatalogOptions: () => apiClient.get("/api/catalog/options"),

  // ── Hotels ──────────────────────────────────────────────────────────
  getMyHotels: () => apiClient.get("/api/partner/hotels"),

  createHotel: (data) => apiClient.post("/api/partner/hotels", data),

  updateHotel: (id, data) => apiClient.put(`/api/partner/hotels/${id}`, data),

  deleteHotel: (id) => apiClient.delete(`/api/partner/hotels/${id}`),

  uploadHotelImages: (id, files) =>
    apiClient.post(`/api/partner/hotels/${id}/images`, buildImageFormData(files)),

  deleteHotelImage: (id, imageUrl) =>
    apiClient.delete(`/api/partner/hotels/${id}/images`, { params: { imageUrl } }),

  setHotelCoverImage: (id, imageUrl) =>
    apiClient.put(`/api/partner/hotels/${id}/cover-image`, { imageUrl }),

  // ── Rooms ────────────────────────────────────────────────────────────
  getRooms: (hotelId) => apiClient.get(`/api/partner/hotels/${hotelId}/rooms`),

  createRoom: (hotelId, data) => apiClient.post(`/api/partner/hotels/${hotelId}/rooms`, data),

  updateRoom: (roomId, data) => apiClient.put(`/api/partner/rooms/${roomId}`, data),

  deleteRoom: (roomId) => apiClient.delete(`/api/partner/rooms/${roomId}`),

  uploadRoomImages: (roomId, files) =>
    apiClient.post(`/api/partner/rooms/${roomId}/images`, buildImageFormData(files)),

  deleteRoomImage: (roomId, imageUrl) =>
    apiClient.delete(`/api/partner/rooms/${roomId}/images`, { params: { imageUrl } }),

  setRoomCoverImage: (roomId, imageUrl) =>
    apiClient.put(`/api/partner/rooms/${roomId}/cover-image`, { imageUrl }),

  // ── Room Units (phòng cụ thể) ────────────────────────────────────────
  getHotelRoomUnits: (hotelId) =>
    apiClient.get(`/api/partner/hotels/${hotelId}/room-units`),

  getRoomUnits: (roomId) =>
    apiClient.get(`/api/partner/rooms/${roomId}/units`),

  createRoomUnit: (roomId, data) =>
    apiClient.post(`/api/partner/rooms/${roomId}/units`, data),

  updateRoomUnit: (roomId, unitId, data) =>
    apiClient.put(`/api/partner/rooms/${roomId}/units/${unitId}`, data),

  deleteRoomUnit: (roomId, unitId) =>
    apiClient.delete(`/api/partner/rooms/${roomId}/units/${unitId}`),

  uploadRoomUnitImage: (roomId, unitId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.post(`/api/partner/rooms/${roomId}/units/${unitId}/image`, fd);
  },

  // ── Bookings ─────────────────────────────────────────────────────────
  getBookings: (params = {}) => {
    const p = {};
    if (params.hotelId)     p.hotelId     = params.hotelId;
    if (params.status)      p.status      = params.status;
    if (params.checkInFrom) p.checkInFrom = params.checkInFrom;
    if (params.checkInTo)   p.checkInTo   = params.checkInTo;
    p.page = params.page ?? 1;
    p.size = params.size ?? 20;
    return apiClient.get("/api/partner/bookings", { params: p });
  },

  getBooking: (bookingId) => apiClient.get(`/api/partner/bookings/${bookingId}`),

  completeBooking: (bookingId) =>
    apiClient.post(`/api/partner/bookings/${bookingId}/complete`),

  // ── Analytics ───────────────────────────────────────────────────────
  getAnalyticsSummary: (params = {}) => {
    const p = {};
    if (params.hotelId)     p.hotelId     = params.hotelId;
    if (params.checkInFrom) p.checkInFrom = params.checkInFrom;
    if (params.checkInTo)   p.checkInTo   = params.checkInTo;
    return apiClient.get("/api/partner/analytics/summary", { params: p });
  },

  // ── Room calendar ───────────────────────────────────────────────────
  getRoomCalendar: (roomId, params) =>
    apiClient.get(`/api/partner/rooms/${roomId}/calendar`, {
      params: { from: params.from, to: params.to },
    }),

  updateRoomCalendar: (roomId, data) =>
    apiClient.put(`/api/partner/rooms/${roomId}/calendar`, data),

  setHotelBasePricing: (hotelId, data) =>
    apiClient.put(`/api/partner/hotels/${hotelId}/base-pricing`, data),

  // ── Refunds ─────────────────────────────────────────────────────────
  getRefunds: (params = {}) => {
    const p = {};
    if (params.hotelId) p.hotelId = params.hotelId;
    if (params.status)  p.status  = params.status;
    return apiClient.get("/api/partner/refunds", { params: p });
  },

  approveRefund: (refundRequestId, transferNote) =>
    apiClient.post(`/api/partner/refunds/${refundRequestId}/approve`, { transferNote: transferNote || null }),

  rejectRefund: (refundRequestId) =>
    apiClient.post(`/api/partner/refunds/${refundRequestId}/reject`),

  // ── AI Price Suggestions ─────────────────────────────────────────────
  getPriceSuggestions: (roomId, from, to) =>
    apiClient.get(`/api/partner/rooms/${roomId}/price-suggestions`, { params: { from, to } }),

  submitPriceFeedback: (roomId, payload) =>
    apiClient.post(`/api/partner/rooms/${roomId}/price-feedback`, payload),

  getRevenueAnalytics: (roomId) =>
    apiClient.get(`/api/partner/rooms/${roomId}/revenue-analytics`),

  triggerTraining: (roomId) => apiClient.post(`/api/partner/rooms/${roomId}/train`),

  // ── Partner Onboarding ──────────────────────────────────────────────
  startOnboarding: (data) => apiClient.post("/api/partner-onboarding/start", data),

  submitOnboarding: (applicationId) =>
    apiClient.post(`/api/partner-onboarding/${applicationId}/submit`),

  // ── Reviews ─────────────────────────────────────────────────────────
  getReviews: (params = {}) => {
    const p = {};
    if (params.hotelId) p.hotelId = params.hotelId;
    if (params.rating)  p.rating  = params.rating;
    if (params.hasReply !== undefined && params.hasReply !== "") p.hasReply = params.hasReply;
    return apiClient.get("/api/partner/reviews", { params: p });
  },

  replyReview: (reviewId, reply) =>
    apiClient.put(`/api/partner/reviews/${reviewId}/reply`, { reply }),
};
