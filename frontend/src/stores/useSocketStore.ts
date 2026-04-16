import type { SocketState } from "@/types/store";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

const baseURL = import.meta.env.VITE_SOCKET_URL;

const joinKnownConversations = (socket: Socket) => {
  useChatStore
    .getState()
    .conversations
    .forEach((conversation) => {
      socket.emit("join-conversation", conversation._id);
    });
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (!accessToken) {
      return;
    }

    if (existingSocket) {
      existingSocket.auth = { token: accessToken };

      if (!existingSocket.connected) {
        existingSocket.connect();
      }

      return;
    }

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");
      joinKnownConversations(socket);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket đã ngắt kết nối:", reason);
      set({ onlineUsers: [] });
    });

    socket.on("connect_error", (error) => {
      console.error("Lỗi kết nối socket:", error.message);
    });

    // online users
    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("conversation-upsert", (conversation) => {
      useChatStore.getState().upsertConversation(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    // new message
    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      useChatStore.getState().addMessage(message);

      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id: conversation.lastMessage.senderId,
          displayName: "",
          avatarUrl: null,
        },
      };

      const updatedConversation = {
        ...conversation,
        lastMessage,
        unreadCounts,
      };

      if (useChatStore.getState().activeConversationId === message.conversationId) {
        useChatStore.getState().markAsSeen();
      }

      useChatStore.getState().updateConversation(updatedConversation);
    });

    // read message
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    })

    // new group chat
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    // message pinned
    socket.on("messagePinned", ({ messageId, isPinned, pinnedBy, pinnedAt }) => {
      useChatStore.setState((state) => {
        const { activeConversationId, messages } = state;
        if (!activeConversationId) return state;

        const convoKey = activeConversationId;
        const convoMessages = messages[convoKey];
        if (!convoMessages) return state;

        const updatedItems = convoMessages.items.map((m) =>
          m._id === messageId
            ? { ...m, isPinned, pinnedBy, pinnedAt: pinnedAt?.toString() }
            : m
        );

        return {
          ...state,
          messages: {
            ...messages,
            [convoKey]: {
              ...convoMessages,
              items: updatedItems
            }
          }
        };
      });
    });

    // message recalled
    socket.on("messageRecalled", ({ messageId, content, isRecalled, recalledAt }) => {
      useChatStore.setState((state) => {
        const { activeConversationId, messages } = state;
        if (!activeConversationId) return state;

        const convoKey = activeConversationId;
        const convoMessages = messages[convoKey];
        if (!convoMessages) return state;

        const updatedItems = convoMessages.items.map((m) =>
          m._id === messageId
            ? { ...m, content, isRecalled, recalledAt }
            : m
        );

        return {
          ...state,
          messages: {
            ...messages,
            [convoKey]: {
              ...convoMessages,
              items: updatedItems
            }
          }
        };
      });
    });

    // update message (for pin/recall realtime)
    socket.on("update-message", ({ message }) => {
      useChatStore.setState((state) => {
        const { activeConversationId, messages } = state;
        if (!activeConversationId || !message.conversationId || message.conversationId.toString() !== activeConversationId) return state;

        const convoKey = activeConversationId;
        const convoMessages = messages[convoKey];
        if (!convoMessages) return state;

        const updatedItems = convoMessages.items.map((m) =>
          m._id === message._id ? { ...m, ...message } : m
        );

        return {
          ...state,
          messages: {
            ...messages,
            [convoKey]: {
              ...convoMessages,
              items: updatedItems
            }
          }
        };
      });
    });
  },


  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
