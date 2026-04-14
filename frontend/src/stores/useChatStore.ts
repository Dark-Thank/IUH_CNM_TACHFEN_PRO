import { chatService } from "@/services/chatServiec";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";
import type { Message } from "@/types/chat";

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
        });
      },
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();

          set({ conversations, convoLoading: false });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchConversations:", error);
          set({ convoLoading: false });
        }
      },
      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const { user } = useAuthStore.getState();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

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
            isOwn: m.senderId === user?._id,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = prev.length > 0 ? [...processed, ...prev] : processed;

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
          console.error("Lỗi xảy ra khi fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      sendDirectMessage: async (recipientId, formData?: FormData) => {
        try {
          const { activeConversationId } = get();

          const data = formData || new FormData();

          data.append("recipientId", recipientId);

          if (activeConversationId) {
            data.append("conversationId", activeConversationId);
          }

          await chatService.sendDirectMessage(data);

        } catch (error) {
          console.error(error);
        }
      },
      sendGroupMessage: async (conversationId, formData?: FormData) => {
        try {
          const data = formData || new FormData();

          data.append("conversationId", conversationId);

          await chatService.sendGroupMessage(data);

        } catch (error) {
          console.error(error);
        }
      },
      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const { fetchMessages } = get();

          message.isOwn = message.senderId === user?._id;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];

          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            if (prevItems.some((m) => m._id === message._id)) {
              return state;
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [...prevItems, message],
                  hasMore: state.messages[convoId].hasMore,
                  nextCursor: state.messages[convoId].nextCursor ?? undefined,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy khi ra add message:", error);
        }
      },
      updateConversation: (conversation: any) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c
          ),
        }));
      },

      markAsSeen: async () => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !user) {
            return;
          }

          const convo = conversations.find((c) => c._id === activeConversationId);

          if (!convo) {
            return;
          }

          if ((convo.unreadCounts?.[user._id] ?? 0) === 0) {
            return;
          }

          await chatService.markAsSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) => (
              c._id === activeConversationId && c.lastMessage ? {
                ...c,
                unreadCounts: {
                  ...c.unreadCounts,
                  [user._id]: 0
                }
              }
                : c
            ))
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi goi markAsSeen trong store:", error);
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
              : [convo, ...state.conversations],
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

          useSocketStore
            .getState()
            .socket?.emit("join-conversation", conversation._id);
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi createConversation trong store", error);
        } finally {
          set({ loading: false });
        }
      },

      togglePinMessage: async (messageId: string) => {
        try {
          const { activeConversationId, messages } = get();
          if (!activeConversationId) return;

          const data = await chatService.togglePinMessage(messageId);

          set((state) => {
            const convoMessages = state.messages[activeConversationId];
            if (!convoMessages) return state;

            const updatedItems = convoMessages.items.map((m) =>
              m._id === messageId
                ? { ...m, isPinned: data.isPinned, pinnedBy: data.pinnedBy, pinnedAt: data.pinnedAt }
                : m
            );

            return {
              ...state,
              messages: {
                ...state.messages,
                [activeConversationId]: {
                  ...convoMessages,
                  items: updatedItems,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi toggle pin message:", error);
        }
      },

      recallMessage: async (messageId: string) => {
        try {
          const { activeConversationId, messages } = get();
          if (!activeConversationId) return;

          const data = await chatService.recallMessage(messageId);

          set((state) => {
            const convoMessages = state.messages[activeConversationId];
            if (!convoMessages) return state;

            const updatedItems = convoMessages.items.map((m) =>
              m._id === messageId
                ? { ...m, ...data }
                : m
            );

            return {
              ...state,
              messages: {
                ...state.messages,
                [activeConversationId]: {
                  ...convoMessages,
                  items: updatedItems,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi thu hồi tin nhắn:", error);
        }
      },
    }),

    {
      name: "chat-storage",
      partialize: (state) => ({ conversations: state.conversations }),
    }
  )
);

