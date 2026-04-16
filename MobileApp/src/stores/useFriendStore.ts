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

  searchByUsername: async (username) => {
    if (!authSession.getAccessToken()) {
      return null;
    }

    try {
      set({ loading: true });
      return await friendService.searchByUsername(username);
    } catch (error) {
      console.error("Loi xay ra khi tim user bang username", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },

  addFriend: async (to, message) => {
    if (!authSession.getAccessToken()) {
      return "Ban can dang nhap de gui loi moi ket ban.";
    }

    try {
      set({ loading: true });
      return await friendService.sendFriendRequest(to, message);
    } catch (error: any) {
      console.error("Loi xay ra khi addFriend", error);
      return error?.response?.data?.message ?? "Loi xay ra khi gui ket ban. Hay thu lai";
    } finally {
      set({ loading: false });
    }
  },

  getAllFriendRequests: async () => {
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
        console.error("Loi xay ra khi getAllFriendRequests", error);
      }
    } finally {
      set({ loading: false });
    }
  },

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
        console.error("Loi xay ra khi acceptRequest", error);
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
        console.error("Loi xay ra khi declineRequest", error);
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
        console.error("Loi xay ra khi load friends", error);
      }
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },
}));
