import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";
import { useSocketStore } from "./useSocketStore";

export const useUserStore = create<UserState>(() => ({
  updateAvatarUrl: async (formData) => {
    try {
      const { user, setUser } = useAuthStore.getState();
      const data = await userService.uploadAvatar(formData);

      if (user) {
        setUser({
          ...user,
          avatarUrl: data.avatarUrl,
        });

        try {
          await useChatStore.getState().fetchConversations();
        } catch (chatError) {
          console.error("Lỗi khi đồng bộ conversations sau khi đổi avatar", chatError);
        }
      }
    } catch (error: any) {
      console.error("Lỗi khi updateAvatarUrl", error);
      toast.error(error.response?.data?.message || "Upload avatar không thành công!");
      throw error;
    }
  },
  updateProfile: async (payload) => {
    try {
      const { setUser } = useAuthStore.getState();
      const updatedUser = await userService.updateProfile(payload);

      setUser(updatedUser);

      try {
        await useChatStore.getState().fetchConversations();
      } catch (chatError) {
        console.error("Lỗi khi đồng bộ conversations sau khi cập nhật profile", chatError);
      }

      toast.success("Cập nhật thông tin thành công.");
    } catch (error: any) {
      console.error("Lỗi khi updateProfile", error);
      toast.error(error.response?.data?.message || "Cập nhật thông tin thất bại.");
      throw error;
    }
  },
  updateOnlineStatusVisibility: async (showOnlineStatus) => {
    try {
      const { setUser } = useAuthStore.getState();
      const updatedUser = await userService.updateProfile({ showOnlineStatus });

      setUser(updatedUser);
      useSocketStore.getState().socket?.emit("presence:set-visible", { showOnlineStatus });
    } catch (error: any) {
      console.error("Lỗi khi updateOnlineStatusVisibility", error);
      toast.error(error.response?.data?.message || "Không thể cập nhật trạng thái online.");
      throw error;
    }
  },
  deleteAccount: async () => {
    try {
      const { clearState } = useAuthStore.getState();

      await userService.deleteAccount();
      clearState();
      toast.success("Xóa tài khoản thành công.");
    } catch (error: any) {
      console.error("Lỗi khi deleteAccount", error);
      toast.error(error.response?.data?.message || "Không thể xóa tài khoản.");
      throw error;
    }
  },
}));
