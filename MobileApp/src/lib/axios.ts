import { authSession } from "@/lib/authSession";
import axios, { type AxiosRequestHeaders } from "axios";

const BACKEND_HOST = process.env.EXPO_PUBLIC_BACKEND_HOST ?? "192.168.100.247";
const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT ?? "5001";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const API_URL =
  configuredApiUrl || `http://${BACKEND_HOST}:${BACKEND_PORT}/api`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const accessToken = authSession.getAccessToken();

  if (accessToken) {
    const authorization = `Bearer ${accessToken}`;
    const headers = config.headers as AxiosRequestHeaders & {
      set?: (name: string, value: string) => void;
    };

    if (typeof headers.set === "function") {
      headers.set("Authorization", authorization);
    } else {
      headers.Authorization = authorization;
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const originalUrl = originalRequest?.url ?? "";

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (
      originalUrl.includes("/auth/signin") ||
      originalUrl.includes("/auth/signup") ||
      originalUrl.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retryCount = originalRequest._retryCount || 0;

    const shouldRefresh =
      (error.response?.status === 401 || error.response?.status === 403) &&
      originalRequest._retryCount < 4;

    if (shouldRefresh) {
      originalRequest._retryCount += 1;

      try {
        const res = await api.post("/auth/refresh", undefined, {
          withCredentials: true,
        });
        const newAccessToken = res.data.accessToken;

        authSession.setAccessToken(newAccessToken);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        authSession.handleUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
