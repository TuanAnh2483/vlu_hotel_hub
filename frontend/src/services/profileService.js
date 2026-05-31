import apiClient from "./apiClient";

export const profileService = {
  getProfile: () => apiClient.get("/api/me/profile"),

  updateProfile: (data) => apiClient.put("/api/me/profile", data),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/api/me/profile/avatar", formData);
  },

  getBilling: () => apiClient.get("/api/me/billing"),

  getNotifications: () => apiClient.get("/api/me/notifications"),

  markNotificationRead: (notificationId) =>
    apiClient.post(`/api/me/notifications/${notificationId}/read`),

  updatePreferences: (data) => apiClient.put("/api/me/preferences", data),

  changePassword: (data) => apiClient.post("/api/me/change-password", data),
};
