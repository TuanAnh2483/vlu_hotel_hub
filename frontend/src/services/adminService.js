import apiClient from "./apiClient";

export const adminService = {
  // Dashboard
  async getStats() {
    try {
      const data = await apiClient.get("/api/admin/stats");
      return {
        totalUsers:     data.totalUsers    ?? data.customerCount   ?? 0,
        totalPartners:  data.totalPartners ?? data.partnerCount    ?? 0,
        totalHotels:    data.totalHotels   ?? data.hotelCount      ?? 0,
        totalBookings:  data.totalBookings ?? data.bookingCount    ?? 0,
        pendingBookings: data.pendingBookings ?? data.pendingPaymentCount ?? 0,
      };
    } catch {
      return { totalUsers: 0, totalPartners: 0, totalHotels: 0, totalBookings: 0, pendingBookings: 0 };
    }
  },

  // Partner applications
  getPartnerApplications(status) {
    return apiClient.get("/api/admin/partner-applications", {
      params: status ? { status } : {},
    });
  },
  approvePartner(applicationId) {
    return apiClient.post(`/api/admin/partner-applications/${applicationId}/approve`);
  },
  rejectPartner(applicationId, reason) {
    return apiClient.post(`/api/admin/partner-applications/${applicationId}/reject`, { reason });
  },

  // Users
  async getUsers(search = "") {
    try {
      const data = await apiClient.get("/api/admin/users");
      const list = Array.isArray(data) ? data : [];
      const q = search.toLowerCase();
      return q ? list.filter((u) => u.email.toLowerCase().includes(q)) : list;
    } catch { return []; }
  },
  toggleUserStatus(userId) {
    return apiClient.post(`/api/admin/users/${userId}/toggle-status`);
  },
  createUser({ email, password, userType }) {
    return apiClient.post("/api/admin/users", { email, password, userType });
  },

  // Hotels
  async getHotels() {
    try {
      const data = await apiClient.get("/api/admin/hotels");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  updateHotel(hotelId, data) {
    return apiClient.put(`/api/admin/hotels/${hotelId}`, data);
  },
  deleteHotel(hotelId) {
    return apiClient.delete(`/api/admin/hotels/${hotelId}`);
  },
  async getHotelRooms(hotelId) {
    try {
      const data = await apiClient.get(`/api/admin/hotels/${hotelId}/rooms`);
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  // Bookings
  async getBookings(status = "") {
    try {
      const data = await apiClient.get("/api/admin/bookings");
      const list = Array.isArray(data) ? data : [];
      return status ? list.filter((b) => b.status === status) : list;
    } catch { return []; }
  },

  // Refunds
  async getRefunds(status = "") {
    try {
      const data = await apiClient.get("/api/admin/refunds", {
        params: status ? { status } : {},
      });
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  updateRefundStatus(refundId, newStatus, transferNote) {
    if (newStatus === "APPROVED") {
      return apiClient.post(`/api/admin/refunds/${refundId}/approve`, { transferNote: transferNote || null });
    }
    if (newStatus === "REJECTED") {
      return apiClient.post(`/api/admin/refunds/${refundId}/reject`);
    }
    throw new Error("Unsupported refund status");
  },

  // Reviews
  async getReviews() {
    try {
      const data = await apiClient.get("/api/admin/reviews");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  deleteReview(reviewId) {
    return apiClient.delete(`/api/admin/reviews/${reviewId}`);
  },

  // System
  async getSystemData() {
    try {
      const data = await apiClient.get("/api/admin/system");
      return {
        flaggedBookings: Array.isArray(data?.flaggedBookings)
          ? data.flaggedBookings.map((item) => ({
              ...item,
              reason:     item.reason     || item.message     || "Cần kiểm tra",
              reportedAt: item.reportedAt || item.requestedAt || "—",
            }))
          : [],
        recentErrors: Array.isArray(data?.recentErrors)
          ? data.recentErrors.map((item) => ({
              ...item,
              timestamp: item.timestamp || item.createdAt || "—",
            }))
          : [],
      };
    } catch { return { flaggedBookings: [], recentErrors: [] }; }
  },
  resolveFlaggedBooking(flagId) {
    return Promise.resolve({ id: flagId });
  },
};
