import axios from "axios";
import { getToken } from "./authStorage";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: { "Content-Type": "application/json" },
});

// Attach token + handle FormData content-type
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Let browser set multipart boundary automatically for FormData
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

// Unwrap API envelope ({ data: ... }) and normalise errors
apiClient.interceptors.response.use(
  (response) => response.data?.data ?? response.data,
  (error) => {
    const status = error.response?.status;
    const body = error.response?.data;
    const message =
      body?.error?.message || body?.message || `HTTP ${status ?? "unknown"}`;
    const err = new Error(message);
    err.status = status;
    err.details = body?.error?.details || [];
    throw err;
  }
);

export default apiClient;
