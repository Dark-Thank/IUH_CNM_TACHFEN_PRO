import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { toast } from "sonner";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist((set, get) => ({
    accessToken: null,
    user: null,
    loading: false,
    pendingOtpEmail: null,
    setAccessToken: (accessToken) => {
      set({ accessToken });
    },

    setUser: (user) => {
      set({ user });
    },
    clearState: () => {
      set({ accessToken: null, user: null, loading: false });
      useChatStore.getState().reset();
      localStorage.clear();
      sessionStorage.clear();
    },

    signUp: async (username, password, email, firstName, lastName) => {
      try {
        set({ loading: true });

        localStorage.clear(); // Xóa toàn bộ localStorage trước khi đăng ký, đảm bảo không còn dữ liệu cũ nào ảnh hưởng đến quá trình đăng ký mới
        useChatStore.getState().reset(); // Đặt lại trạng thái chat để đảm bảo không còn dữ liệu cũ nào ảnh hưởng đến trải nghiệm người dùng sau khi đăng ký mới

        //  gọi api

        await authService.signUp(username, password, email, firstName, lastName);
        set({ pendingOtpEmail: email });
        toast.success("Đã gửi mã OTP tới email. Vui lòng xác thực để hoàn tất đăng ký.");
        return true;
      } catch (error) {
        console.error(error);
        const msg = error?.response?.data?.message || "Đăng ký không thành công";
        toast.error(msg);
        return false;
      } finally {
        set({ loading: false });
      }
    },

    signIn: async (username, password) => {
      try {
        get().clearState();
        set({ loading: true });

        const res = await authService.signIn(username, password);
        // res = { message, userId, email }
        // store pending email for OTP verify
        set({ pendingOtpEmail: res.email });

        toast.success("Đã gửi mã OTP tới email. Vui lòng kiểm tra email.");
        return res;
      } catch (error) {
        console.error(error);
        toast.error("Đăng nhập không thành công!");
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
        useChatStore.getState().fetchConversations();
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
        get().clearState();
        await authService.signOut();
        toast.success("Logout thành công!");
      } catch (error) {
        console.error(error);
        toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
      }
    },

    fetchMe: async () => {
      try {
        set({ loading: true });
        const user = await authService.fetchMe();

        set({ user });
      } catch (error) {
        console.error(error);
        set({ user: null, accessToken: null });
        toast.error("Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!");
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
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
        get().clearState();
      }
      finally {
        set({ loading: false });
      }
    },
  }), {
    name: "auth-storage",
    partialize: (state) => ({ user: state.user }),
  })
);
