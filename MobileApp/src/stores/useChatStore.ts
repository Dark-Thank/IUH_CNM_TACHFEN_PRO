import { authSession } from "@/lib/authSession";
import { socketEmitter } from "@/lib/socketEmitter";
import { toast } from "@/lib/toast";
import { chatService } from "@/services/chatServiec";
import type { ChatState } from "@/types/store";


import AsyncStorage from "@react-native-async-storage/async-storage";


import type { Conversation, Message } from "@/types/chat";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const buildForwardGroupFormData = (messageId: string) => {
  const formData = new FormData();
  formData.append("forwardedFromMessageId", messageId);
  return formData;
};

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

const isUnauthorizedError = (error: any) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

const getConversationTimestamp = (conversation: Conversation) => {
  const fallbackValue = "1970-01-01T00:00:00.000Z";
  const priorityTimestamp = conversation.isPinned
    ? conversation.pinnedAt
    : conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt;

  return new Date(
    priorityTimestamp ??
    fallbackValue
  ).getTime();
};

const mergeConversationList = (
  conversations: Conversation[],
  nextConversation: Conversation
) =>
  uniqueById([
    nextConversation,
    ...conversations.filter((conversation) => conversation._id !== nextConversation._id),
  ]).sort((left, right) => getConversationTimestamp(right) - getConversationTimestamp(left));

const getMessageTimestamp = (message: Partial<Message>) => {
  const fallbackValue = "1970-01-01T00:00:00.000Z";

  return new Date(message.createdAt ?? fallbackValue).getTime();
};

const sortMessagesAscending = (items: Message[]) =>
  uniqueById(items).sort((left, right) => getMessageTimestamp(left) - getMessageTimestamp(right));

const buildOptimisticTextMessage = ({
  conversationId,
  senderId,
  content,
  replyingMessage,
}: {
  conversationId: string;
  senderId: string;
  content: string;
  replyingMessage: Message | null;
}): Message => {
  const now = new Date().toISOString();

  return {
    _id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conversationId,
    senderId,
    content,
    messageType: "text",
    deliveredTo: [],
    seenBy: [],
    replyTo: replyingMessage
      ? {
        messageId: replyingMessage._id,
        senderId: replyingMessage.senderId,
        content: replyingMessage.content,
        messageType: replyingMessage.messageType,
        imgUrls: replyingMessage.imgUrls,
        fileUrls: replyingMessage.fileUrls,
        createdAt: replyingMessage.createdAt,
      }
      : null,
    imgUrls: [],
    fileUrls: [],
    createdAt: now,
    updatedAt: now,
    isOwn: true,
  };
};

const appendOptimisticMessage = (
  set: (partial: any) => void,
  message: Message
) => {
  set((state: ChatState) => {
    const current = state.messages[message.conversationId];
    const currentItems = current?.items ?? [];

    if (currentItems.some((item) => item._id === message._id)) {
      return state;
    }

    return {
      messages: {
        ...state.messages,
        [message.conversationId]: {
          items: sortMessagesAscending([...currentItems, message]),
          hasMore: current?.hasMore ?? false,
          nextCursor: current?.nextCursor ?? undefined,
        },
      },
      conversations: state.conversations.map((conversation) =>
        conversation._id === message.conversationId
          ? {
            ...conversation,
            lastMessage: message,
            lastMessageAt: message.createdAt,
            updatedAt: message.createdAt,
          }
          : conversation
      ),
    };
  });
};

const reconcileOptimisticMessage = (
  set: (partial: any) => void,
  tempId: string | null,
  serverMessage?: Message
) => {
  if (!tempId) {
    return;
  }

  set((state: ChatState) => {
    const nextMessages = { ...state.messages };
    let touchedConvoId: string | null = null;

    Object.entries(state.messages).forEach(([conversationId, convoMessages]) => {
      const hasTemp = convoMessages.items.some((item) => item._id === tempId);
      const hasServer = serverMessage && convoMessages.items.some((item) => item._id === serverMessage._id);

      if (!hasTemp && !hasServer) {
        return;
      }

      touchedConvoId = conversationId;
      const withoutTempOrDuplicate = convoMessages.items.filter(
        (item) => item._id !== tempId && item._id !== serverMessage?._id
      );

      nextMessages[conversationId] = {
        ...convoMessages,
        items: serverMessage
          ? sortMessagesAscending([...withoutTempOrDuplicate, { ...serverMessage, isOwn: true, clientTempId: tempId }])
          : withoutTempOrDuplicate,
      };
    });

    return {
      messages: nextMessages,
      conversations: serverMessage && touchedConvoId
        ? state.conversations.map((conversation) =>
          conversation._id === touchedConvoId
            ? {
              ...conversation,
              lastMessage: serverMessage,
              lastMessageAt: serverMessage.createdAt,
              updatedAt: serverMessage.createdAt,
            }
            : conversation
        )
        : state.conversations,
    };
  });
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      deferMarkAsSeenConversationId: null,
      replyingMessage: null,
      convoLoading: false,
      messageLoading: false,
      loading: false,

      setActiveConversation: (id) => set({ activeConversationId: id, replyingMessage: null }),
      setDeferMarkAsSeenConversation: (id) => set({ deferMarkAsSeenConversationId: id }),
      setReplyingMessage: (message) => set({ replyingMessage: message }),
      clearReplyingMessage: () => set({ replyingMessage: null }),

      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          deferMarkAsSeenConversationId: null,
          replyingMessage: null,
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
          const sortedConversations = uniqueById(conversations).sort(
            (left, right) => getConversationTimestamp(right) - getConversationTimestamp(left)
          );

          set({
            conversations: sortedConversations,
            convoLoading: false,
          });

          sortedConversations.forEach((conversation) => {
            socketEmitter.emit("join-conversation", conversation._id);
          });
        } catch (error) {
          if (!isUnauthorizedError(error)) {
            console.error("Lỗi xảy ra khi fetchConversations:", error);
          }
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

          const processed = fetched.map((m: Message) => ({
            ...m,
            isOwn: m.senderId === currentUserId,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = sortMessagesAscending(
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
          if (!isUnauthorizedError(error)) {
            console.error("Lỗi xảy ra khi fetchMessages:", error);
          }
        } finally {
          set({ messageLoading: false });
        }
      },
      updateMessage: (messageOrId: Message | string, updatedMessage?: Partial<Message>) => {
        const patch = typeof messageOrId === "string"
          ? { _id: messageOrId, ...(updatedMessage ?? {}) }
          : messageOrId;

        if (!patch?._id) {
          return;
        }

        set((state) => {
          if (patch.conversationId) {
            const convoId = patch.conversationId;
            const current = state.messages[convoId];

            if (!current) {
              return state;
            }

            const exists = current.items.some((msg) => msg._id === patch._id);

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...current,
                  items: sortMessagesAscending(
                    exists
                      ? current.items.map((msg) =>
                        msg._id === patch._id
                          ? { ...msg, ...patch }
                          : msg
                      )
                      : [...current.items, patch as Message]
                  ),
                },
              },
            };
          }

          const nextMessages: typeof state.messages = {};
          let found = false;

          Object.entries(state.messages).forEach(([convoId, convoData]) => {
            const exists = convoData.items.some((msg) => msg._id === patch._id);

            if (!exists) {
              return;
            }

            found = true;
            nextMessages[convoId] = {
              ...convoData,
              items: convoData.items.map((msg) =>
                msg._id === patch._id
                  ? { ...msg, ...patch }
                  : msg
              ),
            };
          });

          return found
            ? { messages: { ...state.messages, ...nextMessages } }
            : state;
        });
      },

      sendDirectMessage: async (recipientId, content, files, voiceDurationSeconds) => {
        let optimisticId: string | null = null;
        try {
          const { activeConversationId, replyingMessage } = get();
          const currentUserId = authSession.getCurrentUserId();

          if (
            activeConversationId &&
            currentUserId &&
            content.trim() &&
            !files?.length &&
            typeof voiceDurationSeconds !== "number"
          ) {
            const optimisticMessage = buildOptimisticTextMessage({
              conversationId: activeConversationId,
              senderId: currentUserId,
              content,
              replyingMessage,
            });
            optimisticId = optimisticMessage._id;
            appendOptimisticMessage(set, optimisticMessage);
          }

          const message = await chatService.sendDirectMessage(recipientId, {
            content,
            conversationId: activeConversationId || undefined,
            replyToMessageId: replyingMessage?._id,
            voiceDurationSeconds,
            files: files?.map((file) => ({
              uri: file.uri,
              name: file.name,
              type: file.type,
            })),
          });

          if (message) {
            if (optimisticId) {
              reconcileOptimisticMessage(set, optimisticId, message);
            } else {
              await get().addMessage(message);
            }
          }

        } catch (error) {
          reconcileOptimisticMessage(set, optimisticId);
          console.error("Lỗi xảy ra khi gửi direct message", error);
          throw error;
        }
      },

      sendGroupMessage: async (conversationId, content, files, voiceDurationSeconds) => {
        let optimisticId: string | null = null;
        try {
          const { replyingMessage } = get();
          const currentUserId = authSession.getCurrentUserId();
          const formData = new FormData();

          formData.append("content", content);

          if (
            currentUserId &&
            content.trim() &&
            !files?.length &&
            typeof voiceDurationSeconds !== "number"
          ) {
            const optimisticMessage = buildOptimisticTextMessage({
              conversationId,
              senderId: currentUserId,
              content,
              replyingMessage,
            });
            optimisticId = optimisticMessage._id;
            appendOptimisticMessage(set, optimisticMessage);
          }

          if (files?.length) {
            files.forEach((file) => {
              formData.append("files", {
                uri: file.uri,
                name: file.name || "file.jpg",
                type: file.type || "image/jpeg",
              } as any);
            });
          }

          const message = await chatService.sendGroupMessage(conversationId, formData, voiceDurationSeconds, replyingMessage?._id);

          if (message) {
            if (optimisticId) {
              reconcileOptimisticMessage(set, optimisticId, message);
            } else {
              await get().addMessage(message);
            }
          }
        } catch (error) {
          reconcileOptimisticMessage(set, optimisticId);
          console.error("Lỗi xảy ra khi gửi group message", error);
          throw error;
        }
      },

      createGroupPoll: async (conversationId, payload) => {
        try {
          await chatService.createGroupPoll({
            conversationId,
            question: payload.question,
            options: payload.options,
            hideVoters: payload.hideVoters ?? false,
            hideResultsUntilVote: payload.hideResultsUntilVote ?? false,
            allowMultipleChoices: payload.allowMultipleChoices ?? false,
            allowUserAddedOptions: payload.allowUserAddedOptions ?? true,
            expiresAt: payload.expiresAt ?? null,
          });
        } catch (error) {
          console.error("Lỗi khi tạo bình chọn nhóm:", error);
          throw error;
        }
      },

      addOptionToGroupPoll: async (messageId, text) => {
        try {
          const updatedMessage = await chatService.addOptionToGroupPoll(messageId, text);
          get().updateMessage(updatedMessage);
        } catch (error) {
          console.error("Lỗi khi thêm lựa chọn cho bình chọn:", error);
          throw error;
        }
      },

      voteOnGroupPoll: async (messageId, optionId) => {
        try {
          const updatedMessage = await chatService.voteOnGroupPoll(messageId, optionId);
          get().updateMessage(updatedMessage);
        } catch (error) {
          console.error("Lỗi khi vote bình chọn:", error);
          throw error;
        }
      },

      closeGroupPoll: async (messageId) => {
        try {
          const updatedMessage = await chatService.closeGroupPoll(messageId);
          get().updateMessage(updatedMessage);
        } catch (error) {
          console.error("Lỗi khi đóng bình chọn:", error);
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
          console.error("Lỗi khi tạo lịch hẹn nhóm:", error);
          throw error;
        }
      },

      respondToGroupAppointment: async (messageId, status) => {
        try {
          const updatedMessage = await chatService.respondToGroupAppointment(messageId, status);
          get().updateMessage(updatedMessage);
        } catch (error) {
          console.error("Lỗi khi xác nhận lịch hẹn:", error);
          throw error;
        }
      },

      deleteGroupAppointment: async (messageId) => {
        try {
          const updatedMessage = await chatService.deleteGroupAppointment(messageId);
          get().updateMessage(updatedMessage);
        } catch (error) {
          console.error("Lỗi khi xóa lịch hẹn:", error);
          throw error;
        }
      },

      forwardMessage: async (targetConversationId, messageId) => {
        try {
          const conversations = get().conversations;
          const currentUserId = authSession.getCurrentUserId();
          const targetConversation = conversations.find(
            (conversation) => conversation._id === targetConversationId
          );

          if (!targetConversation || !currentUserId) {
            throw new Error("Không tìm thấy cuộc trò chuyện để chuyển tiếp");
          }

          if (targetConversation.type === "direct") {
            const recipient = targetConversation.participants.find(
              (participant) => participant._id !== currentUserId
            );

            if (!recipient) {
              throw new Error("Không tìm thấy người nhận để chuyển tiếp");
            }

            await chatService.sendDirectMessage(recipient._id, {
              conversationId: targetConversationId,
              forwardedFromMessageId: messageId,
            });
            return;
          }

          await chatService.sendGroupMessage(
            targetConversationId,
            buildForwardGroupFormData(messageId)
          );
        } catch (error) {
          console.error("Lỗi khi chuyển tiếp tin nhắn:", error);
          throw error;
        }
      },

      addMessage: async (message) => {
        try {
          const currentUserId = authSession.getCurrentUserId();
          const { fetchMessages } = get();

          (message as any).isOwn = message.senderId === currentUserId;

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
                  items: sortMessagesAscending([...currentItems, message]),
                  hasMore: current?.hasMore ?? false,
                  nextCursor: current?.nextCursor ?? undefined,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi add message:", error);
        }
      },

      recallMessage: async (messageId: string) => {
        const { messages, activeConversationId, fetchMessages } = get();
        const convoId = activeConversationId!;
        const now = new Date();
        const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();

        const msg = messages[convoId].items.find(m => m._id === messageId);
        if (!msg?.isOwn) {
          toast.error("Chỉ có thể thu hồi tin nhắn của bạn trong 2 phút");
          return;
        }

        try {
          set((state) => ({
            messages: {
              ...state.messages,
              [convoId]: {
                ...state.messages[convoId],
                items: state.messages[convoId].items.map((m: Message) =>
                  m._id === messageId
                    ? { ...m, isRecalled: true, recalledAt: now.toISOString(), content: null }
                    : m
                ),
              },
            },
          }));

          await chatService.recallMessage(messageId);

        } catch (error) {
          console.error("Lỗi thu hồi tin nhắn:", error);
          toast.error("Thu hồi thất bại");
          fetchMessages(convoId);
        }
      },

      togglePinMessage: async (messageId: string) => {
        const { messages, activeConversationId, fetchMessages } = get();
        const convoId = activeConversationId!;
        const userId = authSession.getCurrentUserId()!;

        try {
          set((state) => ({
            messages: {
              ...state.messages,
              [convoId]: {
                ...state.messages[convoId],
                items: state.messages[convoId].items.map((m: Message) =>
                  m._id === messageId
                    ? {
                      ...m,
                      isPinned: !m.isPinned,
                      ...(m.isPinned
                        ? { pinnedBy: undefined, pinnedAt: undefined }
                        : { pinnedBy: userId, pinnedAt: new Date().toISOString() }
                      )
                    }
                    : m
                ),
              },
            },
          }));

          await chatService.togglePinMessage(messageId);

        } catch (error) {
          console.error("Lỗi ghim tin nhắn:", error);
          toast.error("Ghim tin nhắn thất bại");
          fetchMessages(convoId);
        }
      },

      updateConversation: (conversation) => {
        set((state) => {
          const existingConversation = state.conversations.find(
            (item) => item._id === conversation._id
          );

          if (!existingConversation) {
            return state;
          }

          return {
            conversations: mergeConversationList(state.conversations, {
              ...existingConversation,
              ...conversation,
            }),
          };
        });
      },

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
          const currentUserId = authSession.getCurrentUserId();
          const { activeConversationId, conversations, deferMarkAsSeenConversationId } = get();

          if (!activeConversationId || !currentUserId) {
            return;
          }

          if (deferMarkAsSeenConversationId === activeConversationId) {
            return;
          }

          if (!conversations.some((c) => c._id === activeConversationId)) {
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
          if (!isUnauthorizedError(error)) {
            console.error("Lỗi xảy ra khi gọi markAsSeen trong store:", error);
          }
        }
      },

      toggleConversationPin: async (conversationId) => {
        try {
          const conversation = await chatService.toggleConversationPin(conversationId);
          get().upsertConversation(conversation);
        } catch (error) {
          console.error("Lỗi khi ghim cuộc trò chuyện:", error);
          throw error;
        }
      },

      addConvo: (convo) => {
        set((state) => {
          return {
            conversations: mergeConversationList(state.conversations, convo),
            activeConversationId: convo._id,
          };
        });
      },

      createConversation: async (type, name, memberIds, privacy: "public" | "private" = "public") => {
        try {
          set({ loading: true });
          const conversation = await chatService.createConversation(
            type,
            name,
            memberIds,
            privacy
          );

          get().addConvo(conversation);

          socketEmitter.emit("join-conversation", conversation._id);

          return conversation;
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi createConversation trong store", error);
          return undefined;
        } finally {
          set({ loading: false });
        }
      },

      addGroupMembers: async (conversationId, memberIds) => {
        try {
          set({ loading: true });
          const data = await chatService.addGroupMembers(conversationId, memberIds);
          if (data?.conversation) {
            get().upsertConversation(data.conversation);
          }
        } catch (error) {
          console.error("Lỗi khi thêm thành viên nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      reviewGroupJoinRequest: async (conversationId, userId, action) => {
        try {
          set({ loading: true });
          const data = await chatService.reviewGroupJoinRequest(conversationId, userId, action);
          if (data?.conversation) {
            get().upsertConversation(data.conversation);
          }
        } catch (error) {
          console.error("Lỗi khi duyệt yêu cầu tham gia nhóm:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      removeGroupMember: async (conversationId, memberId) => {
        try {
          set({ loading: true });
          const currentUserId = authSession.getCurrentUserId();

          if (currentUserId === memberId) {
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

      deleteMessageForMe: async (messageId: string) => {
        const { messages, activeConversationId, fetchMessages } = get();
        const convoId = activeConversationId!;
        const currentUserId = authSession.getCurrentUserId()!;

        // Optimistic update
        set((state) => ({
          messages: {
            ...state.messages,
            [convoId]: {
              ...state.messages[convoId],
              items: state.messages[convoId].items.map((m: Message) =>
                m._id === messageId
                  ? {
                    ...m,
                    deletedForUsers: [...(m.deletedForUsers || []), currentUserId]
                  }
                  : m
              ),
            },
          },
        }));

        try {
          await chatService.deleteMessageForMe(messageId);
        } catch (error) {
          console.error("Lỗi xóa tin nhắn:", error);
          toast.error("Xóa tin nhắn thất bại");
          fetchMessages(convoId);
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

