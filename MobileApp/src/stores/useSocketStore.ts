import { authSession } from "@/lib/authSession";
import { getBackendOrigin } from "@/lib/backendUrl";
import { socketEmitter } from "@/lib/socketEmitter";
import type { SocketState } from "@/types/store";
import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import type { Socket } from "socket.io-client";
import { create } from "zustand";
import { useChatStore } from "./useChatStore";

const baseURL = process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || getBackendOrigin();

let appStateSubscription: NativeEventSubscription | null = null;
let currentAppState: AppStateStatus = "active";

const joinKnownConversations = (socket: Socket) => {
  useChatStore
    .getState()
    .conversations
    .forEach((conversation) => {
      socket.emit("join-conversation", conversation._id);
    });
};

const isAppActive = () => {
  const appState = AppState.currentState;
  return appState === "active" || appState === "unknown";
};

const refreshChatAfterForeground = async () => {
  const { activeConversationId, fetchConversations, fetchMessages, markAsSeen } =
    useChatStore.getState();

  await fetchConversations();

  if (activeConversationId) {
    await fetchMessages(activeConversationId ?? "");
    await markAsSeen();
  }
};

const updateTypingUsers = (
  currentUsers: { userId: string; displayName: string }[],
  nextUser: { userId: string; displayName: string },
  isTyping: boolean
) => {
  if (!isTyping) {
    return currentUsers.filter((user) => user.userId !== nextUser.userId);
  }

  const filteredUsers = currentUsers.filter((user) => user.userId !== nextUser.userId);
  return [...filteredUsers, nextUser];
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  typingByConversation: {},
  isConnected: false,

  connectSocket: () => {
    const accessToken = authSession.getAccessToken();
    const existingSocket = get().socket;

    if (!accessToken || !isAppActive()) {
      return;
    }

    if (existingSocket) {
      existingSocket.auth = { token: accessToken };

      if (!existingSocket.connected) {
        existingSocket.connect();
      }

      return;
    }

    const socketLib: any = (typeof window !== "undefined" && typeof document !== "undefined")
      ? require("socket.io-client/dist/socket.io.js")
      : require("socket.io-client");

    const ioClient = socketLib.io || socketLib.default || socketLib;

    const socket: Socket = ioClient(baseURL, {
      auth: { token: accessToken },
      autoConnect: false,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Da ket noi voi socket");
      set({ isConnected: true });
      joinKnownConversations(socket);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket da ngat ket noi:", reason);
      set({ isConnected: false, onlineUsers: [], typingByConversation: {} });
    });

    socket.on("connect_error", (error) => {
      console.log("Loi ket noi socket:", error.message);
      set({ isConnected: false });
    });

    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("typing:update", ({ conversationId, userId, displayName, isTyping }) => {
      set((state) => {
        const currentUsers = state.typingByConversation[conversationId] ?? [];
        const nextUsers = updateTypingUsers(
          currentUsers,
          { userId, displayName },
          Boolean(isTyping)
        );

        if (nextUsers.length === 0) {
          const { [conversationId]: _removed, ...rest } = state.typingByConversation;
          return { typingByConversation: rest };
        }

        return {
          typingByConversation: {
            ...state.typingByConversation,
            [conversationId]: nextUsers,
          },
        };
      });
    });

    socket.on("conversation-upsert", (conversation: any) => {
      useChatStore.getState().upsertConversation(conversation);
      socket.emit("join-conversation", conversation._id);
    });

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

    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    socket.on("update-message", ({ message }: { message: any }) => {
      const chatStore = useChatStore.getState();
      const activeConvoId = chatStore.activeConversationId;

      if (activeConvoId === message.conversationId) {
        chatStore.fetchMessages(activeConvoId ?? "");
      }

      Object.entries(chatStore.messages).forEach(([convoId, msgData]) => {
        if (convoId === message.conversationId) {
          console.log("Updated message in convo:", convoId);
        }
      });
    });

    socket.on("new-group", (conversation: any) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    socket.on("user-blocked", ({ blockerId }) => {
      import('./useBlockStore').then((mod) => {
        mod.useBlockStore.getState().setBlockedBy(blockerId);
      });
    });

    socket.connect();
  },

  disconnectSocket: () => {
    const socket = get().socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    set({ socket: null, onlineUsers: [], typingByConversation: {}, isConnected: false });
  },

  startTyping: (conversationId) => {
    const socket = get().socket;

    if (!socket?.connected || !conversationId) {
      return;
    }

    socket.emit("typing:start", { conversationId });
  },

  stopTyping: (conversationId) => {
    const socket = get().socket;

    if (!socket?.connected || !conversationId) {
      return;
    }

    socket.emit("typing:stop", { conversationId });
  },

  registerAppStateListener: () => {
    if (appStateSubscription) {
      return;
    }

    currentAppState = AppState.currentState;

    appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = currentAppState.match(/inactive|background/);
      currentAppState = nextState;

      if (nextState.match(/inactive|background/)) {
        get().disconnectSocket();
        return;
      }

      if (wasBackground && nextState === "active") {
        get().connectSocket();
        refreshChatAfterForeground().catch((error) => {
          console.log("Loi dong bo chat sau khi quay lai app:", error);
        });
      }
    });
  },

  unregisterAppStateListener: () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  },
}));

socketEmitter.setSocketGetter(() => useSocketStore.getState().socket);

