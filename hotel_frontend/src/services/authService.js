import apiClient from "./apiClient";
import { clearSession } from "./authStorage";

// Re-export storage helpers so existing callers don't break
export { getToken, getStoredUser, setSession, setStoredUser, clearSession } from "./authStorage";

export const authService = {
  login({ email, password }) {
    return apiClient.post("/api/auth/login", { email, password });
  },

  googleLogin({ credential }) {
    return apiClient.post("/api/auth/google", { credential });
  },

  register({ email, password, confirmPassword }) {
    return apiClient.post("/api/auth/register", { email, password, confirmPassword });
  },

  forgotPassword({ email }) {
    return apiClient.post("/api/auth/forgot-password", { email });
  },

  resetPassword({ token, newPassword, confirmPassword }) {
    return apiClient.post("/api/auth/reset-password", { token, newPassword, confirmPassword });
  },

  verifyEmail({ token }) {
    return apiClient.post("/api/auth/verify-email", { token });
  },

  resendVerification({ email }) {
    return apiClient.post("/api/auth/resend-verification", { email });
  },

  getCurrentUser() {
    return apiClient.get("/api/me");
  },

  logout() {
    return apiClient.post("/api/auth/logout").finally(clearSession);
  },
};
