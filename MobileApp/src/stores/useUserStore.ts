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
          console.error("Loi khi dong bo conversations sau khi doi avatar", chatError);
        }
      }
    } catch (error: any) {
      console.error("Loi khi updateAvatarUrl", error);
      toast.error(error.response?.data?.message || "Upload avatar khong thanh cong.");
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
        console.error("Loi khi dong bo conversations sau khi cap nhat profile", chatError);
      }

      toast.success("Cap nhat thong tin thanh cong.");
    } catch (error: any) {
      console.error("Loi khi updateProfile", error);
      toast.error(error.response?.data?.message || "Cap nhat thong tin that bai.");
      throw error;
    }
  },
  deleteAccount: async () => {
    try {
      const { clearState } = useAuthStore.getState();

      await userService.deleteAccount();
      clearState();
      toast.success("Xoa tai khoan thanh cong.");
    } catch (error: any) {
      console.error("Loi khi deleteAccount", error);
      toast.error(error.response?.data?.message || "Khong the xoa tai khoan.");
      throw error;
    }
  },
}));
