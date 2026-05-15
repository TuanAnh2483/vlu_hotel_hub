import { createContext, useContext, useEffect, useState } from "react";
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
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  async function refreshUser() {
    const currentUser = await authService.getCurrentUser();
    setStoredUser(currentUser);
    setUser(currentUser);
    return currentUser;
  }

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

  function login(userData, token) {
    setSession(token, userData);
    setUser(userData);
  }

  async function logout() {
    try {
      await authService.logout();
    } catch {
      clearSession();
    } finally {
      setUser(null);
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
