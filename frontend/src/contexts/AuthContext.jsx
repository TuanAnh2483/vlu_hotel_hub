import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/authService";
import {
  clearSession,
  getStoredUser,
  getToken,
  setSession,
  setStoredUser,
} from "../services/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  async function refreshUser() {
    const currentUser = await authService.getCurrentUser();
    setStoredUser(currentUser);
    setUser(currentUser);
    return currentUser;
  }

  // Khôi phục session khi load trang
  useEffect(() => {
    let ignore = false;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return undefined;
    }

    authService.getCurrentUser()
      .then((currentUser) => {
        if (ignore) return;
        setStoredUser(currentUser);
        setUser(currentUser);
      })
      .catch(() => {
        if (ignore) return;
        clearSession();
        setUser(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, []);

  // Khi access token hết hạn và refresh thất bại, apiClient dispatch event này
  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
    }
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  // refreshToken là optional — login cũ (không có refresh token) vẫn hoạt động
  function login(userData, accessToken, refreshToken) {
    setSession(accessToken, userData, refreshToken);
    setUser(userData);
  }

  async function logout() {
    try {
      await authService.logout();
    } catch {
      // authService.logout() clears the session in its own finally block
    } finally {
      setUser(null);
      // Xoá toàn bộ cache React Query để dữ liệu của tài khoản cũ (đơn partner,
      // booking, hồ sơ…) không lộ sang tài khoản mới khi đổi tài khoản mà không reload trang
      queryClient.clear();
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
