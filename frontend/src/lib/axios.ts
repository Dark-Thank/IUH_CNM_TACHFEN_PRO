import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { getApiBaseUrl, warnIfLocalOnlyRealtimeConfig } from "./runtimeConfig";

warnIfLocalOnlyRealtimeConfig();

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

const isTokenAuthError = (status?: number, message = "") => {
  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("access token") || normalizedMessage.includes("token không hợp lệ") || normalizedMessage.includes("token đã hết hạn");
};

const isAuthBypassRequest = (url = "") => {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  return normalizedUrl.includes("/auth/signin") ||
    normalizedUrl.includes("/auth/signup") ||
    normalizedUrl.includes("/auth/refresh");
};

// gắn access token vào req header
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// // tự động gọi refresh api khi access token hết hạn
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const message = error.response?.data?.message || "";

    // những api không cần check
    if (isAuthBypassRequest(originalRequest.url)) {
      return Promise.reject(error);
    }

    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (isTokenAuthError(status, message) && originalRequest._retryCount < 4) {
      originalRequest._retryCount += 1;
      console.log("refresh", originalRequest._retryCount);

      try {
        const res = await api.post("/auth/refresh", { withCredentials: true });
        const newAccessToken = res.data.accessToken;

        useAuthStore.getState().setAccessToken(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearState();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
