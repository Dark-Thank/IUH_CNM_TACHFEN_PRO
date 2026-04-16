import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  loading: false,
  receivedList: [],
  sentList: [],

  // 🔥 GLOBAL BLOCK STATE
  blockedUsers: new Set<string>(),

setBlockedUsers: (ids: string[]) =>
  set({
    blockedUsers: new Set<string>(ids),
  }),

blockUser: (id: string) =>
  set((state) => {
    const newSet = new Set(state.blockedUsers);
    newSet.add(id);
    return { blockedUsers: newSet };
  }),

unblockUser: (id: string) =>
  set((state) => {
    const newSet = new Set(state.blockedUsers);
    newSet.delete(id);
    return { blockedUsers: newSet };
  }),

  searchByUsername: async (username) => {
    try {
      set({ loading: true });
      const user = await friendService.searchByUsername(username);
      return user;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  addFriend: async (to, message) => {
    try {
      set({ loading: true });
      return await friendService.sendFriendRequest(to, message);
    } catch (error) {
      console.error(error);
      return "Lỗi gửi kết bạn";
    } finally {
      set({ loading: false });
    }
  },

  getAllFriendRequests: async () => {
    try {
      set({ loading: true });
      const result = await friendService.getAllFriendRequest();
      if (!result) return;

      set({
        receivedList: result.received,
        sentList: result.sent,
      });
    } catch (error) {
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  acceptRequest: async (id) => {
    await friendService.acceptRequest(id);
    set((state) => ({
      receivedList: state.receivedList.filter((r) => r._id !== id),
    }));
  },

  declineRequest: async (id) => {
    await friendService.declineRequest(id);
    set((state) => ({
      receivedList: state.receivedList.filter((r) => r._id !== id),
    }));
  },

  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends });
    } catch {
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },

  removeFriend: async (id) => {
    await friendService.removeFriend(id);
    set((state) => ({
      friends: state.friends.filter((f) => f._id !== id),
    }));
  },
}));