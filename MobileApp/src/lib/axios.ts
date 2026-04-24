import { authSession } from "@/lib/authSession";
import { getApiBaseUrl } from "@/lib/backendUrl";
import axios, { type AxiosRequestHeaders } from "axios";

const API_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
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

// Helpful debug: show computed API URL in Metro logs when the app starts
try {
  // eslint-disable-next-line no-console
  console.log("[MobileApp] API_URL=", API_URL);
} catch (e) { }

api.interceptors.request.use(async (config) => {
  const accessToken = authSession.getAccessToken();

  console.log("TOKEN TRƯỚC KHI GỬI:", accessToken);

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
    // Log network errors for easier debugging in Metro/Expo logs
    if (!error.response) {
      // eslint-disable-next-line no-console
      console.error("[MobileApp][Axios] Network or CORS error:", error.message, error.config?.url);
      return Promise.reject(error);
    }
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

    const status = error.response?.status;
    const data = error.response?.data || {};
    const message = data.message || '';
    const type = data.type || '';
    const isBlockError = status === 403 && (message.includes('chặn') || type === 'YOU_ARE_BLOCKED');
    const shouldRefresh = !isBlockError && isTokenAuthError(status, message) && originalRequest._retryCount < 4;

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
