import AsyncStorage from "@react-native-async-storage/async-storage";
import { authSession } from "@/lib/authSession";
import { toast } from "@/lib/toast";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

const getAuthErrorMessage = (error: any, fallbackMessage: string) => {
  const serverMessage = error?.response?.data?.message;

  if (typeof serverMessage === "string" && serverMessage.trim()) {
    return serverMessage;
  }

  if (error?.code === "ECONNABORTED") {
    return "Không thể kết nối tới backend trong 10 giây. Hãy kiểm tra server và EXPO_PUBLIC_BACKEND_HOST.";
  }

  if (!error?.response) {
    return "Không kết nối được tới backend. Hãy kiểm tra điện thoại cùng mạng Wi-Fi và IP backend trong MobileApp/.env.";
  }

  return fallbackMessage;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,
      pendingOtpEmail: null,
      pendingOtpForReset: false,

      setAccessToken: (accessToken) => {
        authSession.setAccessToken(accessToken);
        set({ accessToken });
      },

      setUser: (user) => {
        authSession.setCurrentUserId(user._id);
        set({ user });
      },

      clearState: () => {
        authSession.clear();
        set({ accessToken: null, user: null, loading: false });
        useChatStore.getState().reset();
      },

      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });
          useChatStore.getState().reset();

          await authService.signUp(
            username,
            password,
            email,
            firstName,
            lastName
          );

          // store pending otp email so UI can show OTP verify flow
          set({ pendingOtpEmail: email });
          const successMsg = "Đã gửi mã OTP tới email. Vui lòng xác thực để hoàn tất đăng ký.";
          toast.success(successMsg);
          return { ok: true } as const;
        } catch (error: any) {
          const message = getAuthErrorMessage(
            error,
            "Đăng ký không thành công."
          );

          // Avoid noisy Axios stack traces for expected client errors (4xx)
          const status = error?.response?.status;
          if (status && status >= 400 && status < 500) {
            console.warn("[Auth][signUp]", status, message);
          } else {
            console.error(error);
          }

          toast.error(message);
          return { ok: false, message } as const;
        } finally {
          set({ loading: false });
        }
      },

      forgotPassword: async (email: string) => {
        try {
          // immediately mark pending reset flow so UI navigates to OTP input quickly
          set({ pendingOtpEmail: email, pendingOtpForReset: true, loading: true });
          await authService.forgotPassword(email);
          toast.success("Nếu email tồn tại, mã reset đã được gửi.");
        } catch (error) {
          console.error(error);
          toast.error("Gửi mã reset thất bại.");
          // keep pending state so user can still enter OTP if server actually sent it
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (username, password) => {
        try {
          get().clearState();
          set({ loading: true });

          // backend returns { message, userId, email }
          const res = await authService.signIn(username, password);
          set({ pendingOtpEmail: res.email });

          toast.success("Đã gửi mã OTP tới email. Vui lòng kiểm tra email.");
          return res;
        } catch (error) {
          console.error(error);
          // Hiển thị message cụ thể từ backend nếu có
          const serverMessage = getAuthErrorMessage(
            error,
            "Tên đăng nhập hoặc mật khẩu không trùng khớp."
          );
          toast.error(serverMessage || "Tên đăng nhập hoặc mật khẩu không trùng khớp.");
          // Không throw error ra ngoài để tránh RN alert mặc định
          return null;
        } finally {
          set({ loading: false });
        }
      },

      verifyOtp: async (email, otp) => {
        try {
          set({ loading: true });
          const res = await authService.verifyOtp(email, otp);
          const { accessToken } = res;
          get().setAccessToken(accessToken);
          await get().fetchMe();
          await useChatStore.getState().fetchConversations();
          set({ pendingOtpEmail: null });
          toast.success("Đăng nhập thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Xác thực OTP thất bại.");
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          await authService.signOut();
          get().clearState();
          toast.success("Đăng xuất thành công.");
        } catch (error) {
          console.error(error);
          get().clearState();
          toast.error("Lỗi xảy ra khi đăng xuất. Hãy thử lại.");
        }
      },

      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();
          authSession.setCurrentUserId(user._id);
          set({ user });
        } catch (error) {
          console.error(error);
          authSession.clear();
          set({ user: null, accessToken: null });
          toast.error("Lỗi xảy ra khi lấy dữ liệu người dùng.");
        } finally {
          set({ loading: false });
        }
      },

      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          console.error(error);
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        authSession.setAccessToken(state?.accessToken ?? null);
        authSession.setCurrentUserId(state?.user?._id ?? null);
      },
    }
  )
);

authSession.setAccessTokenChangeHandler((accessToken) => {
  useAuthStore.setState({ accessToken });
});

authSession.setUnauthorizedHandler(() => {
  useAuthStore.getState().clearState();
});
