export function getToken() {
  return localStorage.getItem("token");
}

export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user")); }
  catch { return null; }
}

export function setSession(accessToken, user, refreshToken) {
  localStorage.setItem("token", accessToken);
  localStorage.setItem("user", JSON.stringify(user));
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

export function setStoredUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

// Dùng sau khi silent refresh: chỉ cập nhật tokens, không đụng user data
export function setTokens(accessToken, refreshToken) {
  localStorage.setItem("token", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  // Hồ sơ partner gắn với từng tài khoản — xoá để tài khoản mới không thấy đơn của tài khoản cũ
  localStorage.removeItem("partner_application_id");
}
