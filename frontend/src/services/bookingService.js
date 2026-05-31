import apiClient from "./apiClient";

export const bookingService = {
  getQuote({ checkIn, checkOut, rooms }) {
    return apiClient.post("/api/bookings/quote", { checkIn, checkOut, room: rooms });
  },

  createBooking({ checkIn, checkOut, rooms, contact }) {
    return apiClient.post("/api/bookings", { checkIn, checkOut, room: rooms, contact });
  },

  getMyBookings() {
    return apiClient.get("/api/bookings/me");
  },

  getBooking(bookingId) {
    return apiClient.get(`/api/bookings/${bookingId}`);
  },

  payBooking(bookingId, { simulateSuccess, clientRequestId }) {
    return apiClient.post(`/api/bookings/${bookingId}/pay`, { simulateSuccess, clientRequestId });
  },

  createPaymentSession(bookingId) {
    return apiClient.post(`/api/bookings/${bookingId}/payment-session`);
  },

  getPaymentHistory(bookingId) {
    return apiClient.get(`/api/bookings/${bookingId}/payments`);
  },

  cancelBooking(bookingId) {
    return apiClient.post(`/api/bookings/${bookingId}/cancel`);
  },

  getRefundRequest(bookingId) {
    return apiClient.get(`/api/bookings/${bookingId}/refund-request`).catch((error) => {
      if (error.status === 404) return null;
      throw error;
    });
  },

  createRefundRequest(bookingId, { reason, note }) {
    return apiClient.post(`/api/bookings/${bookingId}/refund-request`, { reason, note });
  },
};
