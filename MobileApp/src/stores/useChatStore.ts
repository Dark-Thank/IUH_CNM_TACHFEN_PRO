import AsyncStorage from "@react-native-async-storage/async-storage";
import { authSession } from "@/lib/authSession";
import { socketEmitter } from "@/lib/socketEmitter";
import { chatService } from "@/services/chatServiec";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const uniqueById = <T extends { _id: string }>(items: T[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item._id)) {
      return false;
    }

    seen.add(item._id);
    return true;
  });
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false,
      messageLoading: false,
      loading: false,

      setActiveConversation: (id) => set({ activeConversationId: id }),

      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          convoLoading: false,
          messageLoading: false,
          loading: false,
        });
      },

      fetchConversations: async () => {
        if (!authSession.getAccessToken()) {
          set({ convoLoading: false });
          return;
        }

        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();
          set({ conversations: uniqueById(conversations), convoLoading: false });
        } catch (error) {
          console.error("Loi xay ra khi fetchConversations:", error);
          set({ convoLoading: false });
        }
      },

      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const currentUserId = authSession.getCurrentUserId();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId || !authSession.getAccessToken()) return;

        const current = messages?.[convoId];
        const nextCursor =
          current?.nextCursor === undefined ? "" : current?.nextCursor;

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } = await chatService.fetchMessages(
            convoId,
            nextCursor
          );

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === currentUserId,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = uniqueById(
              prev.length > 0 ? [...processed, ...prev] : processed
            );

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi xay ra khi fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },

      sendDirectMessage: async (recipientId, content, imgUrl) => {
        try {
          const { activeConversationId } = get();
          await chatService.sendDirectMessage(
            recipientId,
            content,
            imgUrl,
            activeConversationId || undefined
          );

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Loi xay ra khi gui direct message", error);
        }
      },

      sendGroupMessage: async (conversationId, content, imgUrl) => {
        try {
          await chatService.sendGroupMessage(conversationId, content, imgUrl);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Loi xay ra khi gui group message", error);
        }
      },

      addMessage: async (message) => {
        try {
          const currentUserId = authSession.getCurrentUserId();
          const { fetchMessages } = get();

          message.isOwn = message.senderId === currentUserId;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];

          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            const current = state.messages[convoId];
            const currentItems = current?.items ?? prevItems;

            if (currentItems.some((m) => m._id === message._id)) {
              return state;
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: uniqueById([...currentItems, message]),
                  hasMore: current?.hasMore ?? false,
                  nextCursor: current?.nextCursor ?? undefined,
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi xay ra khi add message:", error);
        }
      },

      updateConversation: (conversation) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c
          ),
        }));
      },

      markAsSeen: async () => {
        try {
          const currentUserId = authSession.getCurrentUserId();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !currentUserId) {
            return;
          }

          const convo = conversations.find((c) => c._id === activeConversationId);

          if (!convo) {
            return;
          }

          if ((convo.unreadCounts?.[currentUserId] ?? 0) === 0) {
            return;
          }

          await chatService.markAsSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId && c.lastMessage
                ? {
                    ...c,
                    unreadCounts: {
                      ...c.unreadCounts,
                      [currentUserId]: 0,
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Loi xay ra khi goi markAsSeen trong store:", error);
        }
      },

      addConvo: (convo) => {
        set((state) => {
          const exists = state.conversations.some(
            (c) => c._id.toString() === convo._id.toString()
          );

          return {
            conversations: exists
              ? state.conversations
              : uniqueById([convo, ...state.conversations]),
            activeConversationId: convo._id,
          };
        });
      },

      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatService.createConversation(
            type,
            name,
            memberIds
          );

          get().addConvo(conversation);

          socketEmitter.emit("join-conversation", conversation._id);
        } catch (error) {
          console.error("Loi xay ra khi goi createConversation trong store", error);
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ conversations: state.conversations }),
    }
  )
);
