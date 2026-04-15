import AsyncStorage from "@react-native-async-storage/async-storage";
import { authSession } from "@/lib/authSession";
import { toast } from "@/lib/toast";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,
      pendingOtpEmail: null,

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
          const successMsg = "Da gui ma OTP toi email. Vui long xac thuc de hoan tat dang ky.";
          toast.success(successMsg);
          return { ok: true } as const;
        } catch (error: any) {
          // Prefer backend error message when available
          const message = error?.response?.data?.message ?? "Dang ky khong thanh cong.";

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

      signIn: async (username, password) => {
        try {
          get().clearState();
          set({ loading: true });

          // backend returns { message, userId, email }
          const res = await authService.signIn(username, password);
          set({ pendingOtpEmail: res.email });

          toast.success("Da gui ma OTP toi email. Vui long kiem tra email.");
          return res;
        } catch (error) {
          console.error(error);
          toast.error("Dang nhap khong thanh cong.");
          throw error;
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
          toast.success("Dang nhap thanh cong!");
        } catch (error) {
          console.error(error);
          toast.error("Xac thuc OTP that bai.");
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      signOut: async () => {
        try {
          await authService.signOut();
          get().clearState();
          toast.success("Logout thanh cong.");
        } catch (error) {
          console.error(error);
          get().clearState();
          toast.error("Loi xay ra khi logout. Hay thu lai.");
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
          toast.error("Loi xay ra khi lay du lieu nguoi dung.");
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
          toast.error("Phien dang nhap da het han. Vui long dang nhap lai.");
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
