import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";
import type { Friend, FriendRequest, User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;
  pendingOtpEmail?: string | null;
  pendingOtpForReset?: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  forgotPassword?: (email: string) => Promise<void>;
  verifyOtp?: (email: string, otp: string) => Promise<void>;
  resetPassword?: (email: string, otp: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean;
      nextCursor?: string | null;
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    files?: {
      uri: string;
      name?: string;
      type?: string;
    }[],
    voiceDurationSeconds?: number
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    files?: {
      uri: string;
      name?: string;
      type?: string;
    }[],
    voiceDurationSeconds?: number
  ) => Promise<void>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  recallMessage: (messageId: string) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Partial<Conversation> & { _id: string }) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  isConnected: boolean;
  connectSocket: () => void;
  disconnectSocket: () => void;
  registerAppStateListener: () => void;
  unregisterAppStateListener: () => void;
}

export interface UserState {
  updateAvatarUrl: (formData: FormData) => Promise<void>;
  updateProfile: (payload: {
    displayName?: string;
    bio?: string;
  }) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  blockedUsers: Set<string>;

setBlockedUsers: (ids: string[]) => void;
blockUser: (id: string) => void;
unblockUser: (id: string) => void;
  searchByUsername: (username: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}

