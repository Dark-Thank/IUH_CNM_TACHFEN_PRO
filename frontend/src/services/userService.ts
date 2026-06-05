import api from "@/lib/axios";

export const userService = {
  uploadAvatar: async (formData: FormData) => {
    const res = await api.post("/users/uploadAvatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (res.status === 400) {
      throw new Error(res.data.message);
    }

    return res.data;
  },
  updateProfile: async (payload: {
    displayName?: string;
    bio?: string;
    showOnlineStatus?: boolean;
  }) => {
    const res = await api.patch("/users/me", payload);
    return res.data.user;
  },
  deleteAccount: async () => {
    const res = await api.delete("/users/me");
    return res.data;
  },
};
