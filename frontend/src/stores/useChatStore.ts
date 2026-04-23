import { chatService } from "@/services/chatServiec";
import type { Conversation } from "@/types/chat";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";

const getConversationTimestamp = (conversation: Conversation) => {
  const fallbackValue = "1970-01-01T00:00:00.000Z";

  return new Date(
    conversation.lastMessageAt ??
    conversation.updatedAt ??
    conversation.createdAt ??
    fallbackValue
  ).getTime();
};

const mergeConversationList = (
  conversations: Conversation[],
  nextConversation: Conversation
) =>
  [nextConversation, ...conversations.filter((conversation) => conversation._id !== nextConversation._id)]
    .sort((left, right) => getConversationTimestamp(right) - getConversationTimestamp(left));



export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      replyingMessage: null,
      convoLoading: false,
      messageLoading: false,
      loading: false,

      setActiveConversation: (id) => set({ activeConversationId: id, replyingMessage: null }),
      setReplyingMessage: (message) => set({ replyingMessage: message }),
      clearReplyingMessage: () => set({ replyingMessage: null }),
      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          replyingMessage: null,
          convoLoading: false,
          messageLoading: false,
        });
      },
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();

          const sortedConversations = conversations.sort(
            (left, right) => getConversationTimestamp(right) - getConversationTimestamp(left)
          );

          set({
            conversations: sortedConversations,
            convoLoading: false,
          });

          const socket = useSocketStore.getState().socket;

          if (socket?.connected) {
            sortedConversations.forEach((conversation) => {
              socket.emit("join-conversation", conversation._id);
            });
          }
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
          console.error("Lỗi xảy ra khi gửi direct message", error);
          throw error;
        }
      },
      sendGroupMessage: async (conversationId, formData?: FormData) => {
        try {
          const data = formData || new FormData();

          data.append("conversationId", conversationId);

          await chatService.sendGroupMessage(data);

        } catch (error) {
          console.error("Lỗi xảy ra gửi group message", error);
          throw error;
        }
      },
      createGroupPoll: async (conversationId, payload) => {
        try {
          await chatService.createGroupPoll({
            conversationId,
            question: payload.question,
            options: payload.options,
            expiresAt: payload.expiresAt ?? null,
          });
        } catch (error) {
          console.error("Loi khi tao binh chon nhom:", error);
          throw error;
        }
      },
      voteOnGroupPoll: async (messageId, optionId) => {
        try {
          const updatedMessage = await chatService.voteOnGroupPoll(messageId, optionId);

          set((state) => {
            const convoId = state.activeConversationId;
            if (!convoId) return state;

            const convoMessages = state.messages[convoId];
            if (!convoMessages) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...convoMessages,
                  items: convoMessages.items.map((message) =>
                    message._id === messageId
                      ? {
                        ...message,
                        pollMeta: updatedMessage.pollMeta,
                        updatedAt: updatedMessage.updatedAt,
                      }
                      : message
                  ),
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi khi vote binh chon:", error);
          throw error;
        }
      },
      closeGroupPoll: async (messageId) => {
        try {
          const updatedMessage = await chatService.closeGroupPoll(messageId);

          set((state) => {
            const convoId = state.activeConversationId;
            if (!convoId) return state;

            const convoMessages = state.messages[convoId];
            if (!convoMessages) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...convoMessages,
                  items: convoMessages.items.map((message) =>
                    message._id === messageId
                      ? {
                        ...message,
                        pollMeta: updatedMessage.pollMeta,
                        updatedAt: updatedMessage.updatedAt,
                      }
                      : message
                  ),
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi khi dong binh chon:", error);
          throw error;
        }
      },
      createGroupAppointment: async (conversationId, payload) => {
        try {
          await chatService.createGroupAppointment({
            conversationId,
            title: payload.title,
            description: payload.description,
            location: payload.location,
            scheduledAt: payload.scheduledAt,
          });
        } catch (error) {
          console.error("Loi khi tao lich hen nhom:", error);
          throw error;
        }
      },
      respondToGroupAppointment: async (messageId, status) => {
        try {
          const updatedMessage = await chatService.respondToGroupAppointment(messageId, status);

          set((state) => {
            const convoId = state.activeConversationId;
            if (!convoId) return state;

            const convoMessages = state.messages[convoId];
            if (!convoMessages) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...convoMessages,
                  items: convoMessages.items.map((message) =>
                    message._id === messageId
                      ? {
                        ...message,
                        appointmentMeta: updatedMessage.appointmentMeta,
                        updatedAt: updatedMessage.updatedAt,
                      }
                      : message
                  ),
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi khi xac nhan lich hen:", error);
          throw error;
        }
      },
      deleteGroupAppointment: async (messageId) => {
        try {
          const updatedMessage = await chatService.deleteGroupAppointment(messageId);

          set((state) => {
            const convoId = state.activeConversationId;
            if (!convoId) return state;

            const convoMessages = state.messages[convoId];
            if (!convoMessages) return state;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...convoMessages,
                  items: convoMessages.items.map((message) =>
                    message._id === messageId
                      ? { ...message, ...updatedMessage }
                      : message
                  ),
                },
              },
            };
          });
        } catch (error) {
          console.error("Loi khi xoa lich hen:", error);
          throw error;
        }
      },
      forwardMessage: async (targetConversationId, messageId) => {
        try {
          const { conversations } = get();
          const { user } = useAuthStore.getState();
          const targetConversation = conversations.find(
            (conversation) => conversation._id === targetConversationId
          );

          if (!targetConversation || !user) {
            throw new Error("Không tìm thấy cuộc trò chuyện để chuyển tiếp");
          }

          const formData = new FormData();
          formData.append("forwardedFromMessageId", messageId);

          if (targetConversation.type === "direct") {
            const recipient = targetConversation.participants.find(
              (participant) => participant._id !== user._id
            );

            if (!recipient) {
              throw new Error("Không tìm thấy người nhận để chuyển tiếp");
            }

            formData.append("recipientId", recipient._id);
            formData.append("conversationId", targetConversationId);
            await chatService.sendDirectMessage(formData);
            return;
          }

          formData.append("conversationId", targetConversationId);
          await chatService.sendGroupMessage(formData);
        } catch (error) {
          console.error("Lỗi khi chuyển tiếp tin nhắn:", error);
          throw error;
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

            const currentConversationMessages = state.messages[convoId];

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [...prevItems, message],
                  hasMore: currentConversationMessages?.hasMore ?? false,
                  nextCursor: currentConversationMessages?.nextCursor ?? undefined,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy khi ra add message:", error);
        }
      },
updateConversation: (updated: Partial<Conversation> & { _id: string }) =>
  set((state) => ({
    conversations: state.conversations.map((c) =>
      c._id !== updated._id
        ? c
        : {
            ...c,
            group: {
              ...c.group,
              ...updated.group,
            },
          }
    ),
  })),
  

      upsertConversation: (conversation) => {
        set((state) => ({
          conversations: mergeConversationList(state.conversations, conversation),
        }));
      },

      removeConversation: (conversationId) => {
        set((state) => {
          const { [conversationId]: _removed, ...restMessages } = state.messages;

          return {
            conversations: state.conversations.filter((conversation) => conversation._id !== conversationId),
            messages: restMessages,
            activeConversationId:
              state.activeConversationId === conversationId ? null : state.activeConversationId,
          };
        });
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
        set((state) => ({
          conversations: mergeConversationList(state.conversations, convo),
          activeConversationId: convo._id,
        }));
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

      addGroupMembers: async (conversationId, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatService.addGroupMembers(conversationId, memberIds);
          get().upsertConversation(conversation);
        } catch (error) {
          console.error("Lỗi khi thêm thành viên nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      removeGroupMember: async (conversationId, memberId) => {
        try {
          set({ loading: true });
          const { user } = useAuthStore.getState();

          if (user?._id === memberId) {
            await chatService.leaveGroup(conversationId);
            get().removeConversation(conversationId);
            return;
          }

          const conversation = await chatService.removeGroupMember(conversationId, memberId);
          get().upsertConversation(conversation);
        } catch (error) {
          console.error("Lỗi khi xóa thành viên nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      updateGroupMemberRole: async (conversationId, memberId, role) => {
        try {
          set({ loading: true });
          const conversation = await chatService.updateGroupMemberRole(conversationId, memberId, role);
          get().upsertConversation(conversation);
        } catch (error) {
          console.error("Lỗi khi cập nhật vai trò thành viên:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      transferGroupOwnership: async (conversationId, newOwnerId) => {
        try {
          set({ loading: true });
          const conversation = await chatService.transferGroupOwnership(conversationId, newOwnerId);
          get().upsertConversation(conversation);
        } catch (error) {
          console.error("Lỗi khi chuyển quyền chủ nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      leaveGroup: async (conversationId) => {
        try {
          set({ loading: true });
          await chatService.leaveGroup(conversationId);
          get().removeConversation(conversationId);
        } catch (error) {
          console.error("Lỗi khi rời nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      disbandGroup: async (conversationId) => {
        try {
          set({ loading: true });
          await chatService.disbandGroup(conversationId);
          get().removeConversation(conversationId);
        } catch (error) {
          console.error("Lỗi khi giải tán nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      togglePinMessage: async (messageId: string) => {
        try {
          const { activeConversationId } = get();
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
          const { activeConversationId } = get();
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
      deleteMessageForMe: async (messageId: string) => {
        try {
          const { activeConversationId } = get();
          if (!activeConversationId) return;

          const data = await chatService.deleteMessageForMe(messageId);

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
          console.error("Lỗi khi xóa tin nhắn cho tôi:", error);
        }
      },
      reactToMessage: async (messageId: string, emoji: string) => {
        const updatedMessage = await chatService.reactToMessage(messageId, emoji);

        set((state) => {
          const convoId = state.activeConversationId;
          if (!convoId) return state;

          const convoMessages = state.messages[convoId];

          if (!convoMessages) return state;

          return {
            messages: {
              ...state.messages,
              [convoId]: {
                ...convoMessages,
                items: convoMessages.items.map((m) =>
                  m._id === messageId
                    ? {
                      ...m,
                      reactions: updatedMessage.reactions,
                      updatedAt: updatedMessage.updatedAt,
                    }
                    : m
                ),
              },
            },
          };
        });
      },
    }),

    {
      name: "chat-storage",
      partialize: (state) => ({ conversations: state.conversations }),
    }
  )
);


