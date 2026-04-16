import { create } from "zustand";

interface BlockState {
  blockedUsers: Set<string>;
  blockedBy: Set<string>;

  setBlockedUser: (id: string) => void;
  setBlockedBy: (id: string) => void;

  removeBlockedUser: (id: string) => void;
  removeBlockedBy: (id: string) => void;

  reset: () => void;
}

export const useBlockStore = create<BlockState>((set) => ({
  blockedUsers: new Set(),
  blockedBy: new Set(),

  setBlockedUser: (id) =>
    set((state) => {
      const updated = new Set(state.blockedUsers);
      updated.add(id);
      return { blockedUsers: updated };
    }),

  setBlockedBy: (id) =>
    set((state) => {
      const updated = new Set(state.blockedBy);
      updated.add(id);
      return { blockedBy: updated };
    }),

  removeBlockedUser: (id) =>
    set((state) => {
      const updated = new Set(state.blockedUsers);
      updated.delete(id);
      return { blockedUsers: updated };
    }),

  removeBlockedBy: (id) =>
    set((state) => {
      const updated = new Set(state.blockedBy);
      updated.delete(id);
      return { blockedBy: updated };
    }),

  reset: () => ({
    blockedUsers: new Set(),
    blockedBy: new Set(),
  }),
}));