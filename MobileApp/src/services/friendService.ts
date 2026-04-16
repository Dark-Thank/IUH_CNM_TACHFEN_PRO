import api from "@/lib/axios";

export const friendService = {
  async searchByUsername(username: string) {
    const res = await api.get(`/users/search?username=${username}`);
    return res.data.user;
  },

  async sendFriendRequest(to: string, message?: string) {
    const res = await api.post("/friends/requests", { to, message });
    return res.data.message;
  },

  async getAllFriendRequest() {
    const res = await api.get("/friends/requests");
    const { sent, received } = res.data;
    return { sent, received };
  },

  async acceptRequest(requestId: string) {
    const res = await api.post(`/friends/requests/${requestId}/accept`);
    return res.data.requestAcceptedBy;
  },

  async declineRequest(requestId: string) {
    await api.post(`/friends/requests/${requestId}/decline`);
  },

  async getFriendList() {
    const res = await api.get("/friends");
    return res.data.friends;
  },

  
  async removeFriend(friendId: string) {
    try {
      const res = await api.delete(`/friends/${friendId}`);
      return res.data.message;
    } catch (error) {
      console.error("Lỗi khi xóa bạn", error);
      throw error;
    }
  },

  async getUserById(userId: string) {
    try {
      const res = await api.get(`/users/${userId}`);
      return res.data.user;
    } catch (error) {
      console.error("Lỗi khi lấy thông tin user", error);
      throw error;
    }
  },

  async blockFriend(friendId: string) {
    try {
      const res = await api.post(`/friends/${friendId}/block`);
      return res.data.message;
    } catch (error) {
      console.error("Lỗi khi chặn bạn", error);
      throw error;
    }
  },

  async unblockFriend(friendId: string) {
    try {
      const res = await api.post(`/friends/${friendId}/unblock`);
      return res.data.message;
    } catch (error) {
      console.error("Lỗi khi bỏ chặn bạn", error);
      throw error;
    }
  },

  async checkBlockStatus(friendId: string) {
    try {
      const res = await api.get(`/friends/${friendId}/block-status`);
      return res.data.isBlocked;
    } catch (error) {
      console.error("Lỗi khi kiểm tra trạng thái chặn", error);
      return false;
    }
  },

  async getBlockedUsers() {
    try {
      const res = await api.get(`/friends/blocked`);
      return res.data.blockedUsers;
    } catch (error) {
      console.error("Lỗi khi lấy danh sách chặn", error);
      return [];
    }
  },


};

