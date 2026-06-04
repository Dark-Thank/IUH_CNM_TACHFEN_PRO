import { authSession } from "@/lib/authSession";
import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

const isUnauthorizedError = (error: any) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

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

  // searchByUsername: async (username) => {
  //   try {
  //     set({ loading: true });
  //     const user = await friendService.searchByUsername(username);
  //     return user;
  //   } catch (error) {
  //     console.error(error);

  searchByUsername: async (username) => {
    if (!authSession.getAccessToken()) {
      return null;
    }

    try {
      set({ loading: true });
      return await friendService.searchByUsername(username);
    } catch (error) {
      console.error("Lỗi xảy ra khi tìm user bằng username", error);

      return null;
    } finally {
      set({ loading: false });
    }
  },

  addFriend: async (to, message) => {
    if (!authSession.getAccessToken()) {
      return "Bạn cần đăng nhập để gửi lời mời kết bạn.";
    }

    try {
      set({ loading: true });
      return await friendService.sendFriendRequest(to, message);

    // } catch (error) {
    //   console.error(error);
    //   return "Lỗi gửi kết bạn";

    } catch (error: any) {
      console.error("Lỗi xảy ra khi addFriend", error);
      return error?.response?.data?.message ?? "Lỗi xảy ra khi gửi kết bạn. Hãy thử lại";
    } finally {
      set({ loading: false });
    }
  },

  getAllFriendRequests: async () => {

    // try {
    //   set({ loading: true });
    //   const result = await friendService.getAllFriendRequest();
    //   if (!result) return;

    //   set({
    //     receivedList: result.received,
    //     sentList: result.sent,
    //   });
    // } catch (error) {
    //   console.error(error);

    if (!authSession.getAccessToken()) {
      set({ receivedList: [], sentList: [], loading: false });
      return;
    }

    try {
      set({ loading: true });
      const result = await friendService.getAllFriendRequest();

      if (!result) {
        return;
      }

      const { received, sent } = result;
      set({ receivedList: received, sentList: sent });
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        console.error("Lỗi xảy ra khi getAllFriendRequests", error);
      }

    } finally {
      set({ loading: false });
    }
  },


  // acceptRequest: async (id) => {
  //   await friendService.acceptRequest(id);
  //   set((state) => ({
  //     receivedList: state.receivedList.filter((r) => r._id !== id),
  //   }));
  // },

  // declineRequest: async (id) => {
  //   await friendService.declineRequest(id);
  //   set((state) => ({
  //     receivedList: state.receivedList.filter((r) => r._id !== id),
  //   }));
  // },

  // getFriends: async () => {


  acceptRequest: async (requestId) => {
    if (!authSession.getAccessToken()) {
      return;
    }

    try {
      set({ loading: true });
      await friendService.acceptRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
      }));

      await get().getFriends();
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        console.error("Lỗi xảy ra khi acceptRequest", error);
      }
    } finally {
      set({ loading: false });
    }
  },

  declineRequest: async (requestId) => {
    if (!authSession.getAccessToken()) {
      return;
    }

    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((request) => request._id !== requestId),
      }));
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        console.error("Lỗi xảy ra khi declineRequest", error);
      }
    } finally {
      set({ loading: false });
    }
  },

  getFriends: async () => {
    if (!authSession.getAccessToken()) {
      set({ friends: [], loading: false });
      return;
    }

    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends });
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        console.error("Lỗi xảy ra khi load friends", error);
      }

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


