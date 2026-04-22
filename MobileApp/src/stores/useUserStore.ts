import { toast } from "@/lib/toast";
import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

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
          console.error("Lỗi khi đồng bộ cuộc trò chuyện sau khi đổi ảnh đại diện", chatError);
        }
      }
    } catch (error: any) {
      console.error("Lỗi khi cập nhật ảnh đại diện", error);
      toast.error(error.response?.data?.message || "Tải ảnh đại diện lên không thành công.");
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
        console.error("Lỗi khi đồng bộ cuộc trò chuyện sau khi cập nhật hồ sơ", chatError);
      }

      toast.success("Cập nhật thông tin thành công.");
    } catch (error: any) {
      console.error("Lỗi khi cập nhật hồ sơ", error);
      toast.error(error.response?.data?.message || "Cập nhật thông tin thất bại.");
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
      console.error("Lỗi khi xóa tài khoản", error);
      toast.error(error.response?.data?.message || "Không thể xóa tài khoản.");
      throw error;
    }
  },
}));
