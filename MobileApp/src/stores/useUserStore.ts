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

        useChatStore.getState().fetchConversations();
      }
    } catch (error) {
      console.error("Loi khi updateAvatarUrl", error);
      toast.error("Upload avatar khong thanh cong.");
    }
  },
  updateProfile: async (payload) => {
    try {
      const { setUser } = useAuthStore.getState();
      const updatedUser = await userService.updateProfile(payload);
      setUser(updatedUser);
      toast.success("Cap nhat thong tin thanh cong.");
    } catch (error) {
      console.error("Loi khi updateProfile", error);
      toast.error("Cap nhat thong tin that bai.");
    }
  },
}));
