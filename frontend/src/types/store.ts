import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";
import type { Friend, FriendRequest, User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;
  pendingOtpEmail: string | null;
  pendingOtpForReset: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => Promise<boolean>;
  signIn: (username: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
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
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null; // phân trang
    }
  >;
  activeConversationId: string | null;
  replyingMessage: Message | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  setReplyingMessage: (message: Message | null) => void;
  clearReplyingMessage: () => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;

  sendDirectMessage: (userId: string, formData: FormData) => Promise<void>;
  sendGroupMessage: (conversationId: string, formData: FormData) => Promise<void>;
  forwardMessage: (targetConversationId: string, messageId: string) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  recallMessage: (messageId: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;


  addMessage: (message: Message) => Promise<void>;

  // update convo
  upsertConversation: (conversation: Conversation) => void;
  updateConversation: (
    conversation: Partial<Conversation> & { _id: string }
  ) => void;
  removeConversation: (conversationId: string) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<void>;
  addGroupMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeGroupMember: (conversationId: string, memberId: string) => Promise<void>;
  updateGroupMemberRole: (
    conversationId: string,
    memberId: string,
    role: "deputy" | "member"
  ) => Promise<void>;
  transferGroupOwnership: (conversationId: string, newOwnerId: string) => Promise<void>;
  leaveGroup: (conversationId: string) => Promise<void>;
  disbandGroup: (conversationId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  typingByConversation: Record<
    string,
    {
      userId: string;
      displayName: string;
    }[]
  >;
  connectSocket: () => void;
  disconnectSocket: () => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
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
  searchByUsername: (username: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
}

