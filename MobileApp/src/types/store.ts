import type { MediaStream } from "react-native-webrtc";
import type { Socket } from "socket.io-client";
import type { AppointmentResponseStatus, Conversation, Message } from "./chat";
import type {
  CallAcceptPayload,
  CallDeclinePayload,
  CallEndPayload,
  CallInvitePayload,
  CallMediaStatePayload,
  CallParticipantPayload,
  CallRejoinPayload,
  CallSession,
  CallSignalCandidatePayload,
  CallSignalDescriptionPayload,
  CallStatePayload,
  CallType,
} from "./call";
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
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signIn: (username: string, password: string) => Promise<{ message: string; userId: string; email: string } | null>;
  forgotPassword: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
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
  replyingMessage: Message | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;
  updateMessage: {
    (message: Message): void;
    (messageId: string, updatedMessage: Partial<Message>): void;
  };
  setActiveConversation: (id: string | null) => void;
  setReplyingMessage: (message: Message | null) => void;
  clearReplyingMessage: () => void;
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
  createGroupPoll: (
    conversationId: string,
    payload: {
      question: string;
      options: string[];
      hideVoters?: boolean;
      hideResultsUntilVote?: boolean;
      allowMultipleChoices?: boolean;
      allowUserAddedOptions?: boolean;
      expiresAt?: string | null;
    }
  ) => Promise<void>;
  addOptionToGroupPoll: (messageId: string, text: string) => Promise<void>;
  voteOnGroupPoll: (messageId: string, optionId: string) => Promise<void>;
  closeGroupPoll: (messageId: string) => Promise<void>;
  createGroupAppointment: (
    conversationId: string,
    payload: {
      title: string;
      description?: string;
      location?: string;
      scheduledAt: string;
    }
  ) => Promise<void>;
  respondToGroupAppointment: (
    messageId: string,
    status: AppointmentResponseStatus
  ) => Promise<void>;
  deleteGroupAppointment: (messageId: string) => Promise<void>;
  forwardMessage: (targetConversationId: string, messageId: string) => Promise<void>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  recallMessage: (messageId: string) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  deleteMessageForMe: (messageId: string) => Promise<void>;
  upsertConversation: (conversation: Conversation) => void;
  updateConversation: (conversation: Partial<Conversation> & { _id: string }) => void;
  removeConversation: (conversationId: string) => void;
  markAsSeen: () => Promise<void>;
  toggleConversationPin: (conversationId: string) => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<Conversation | undefined>;
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
  reactToMessage?: (messageId: string, emoji: string) => Promise<void>;
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
  isConnected: boolean;
  connectSocket: () => void;
  disconnectSocket: () => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  registerAppStateListener: () => void;
  unregisterAppStateListener: () => void;
}

export interface CallState {
  currentCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteCameraStates: Record<string, boolean>;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  startOutgoingCall: (conversation: Conversation, callType: CallType) => Promise<void>;
  receiveIncomingCall: (payload: CallInvitePayload) => void;
  handleCallRejoin: (payload: CallRejoinPayload) => void;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: (reason?: string) => void;
  endCall: (reason?: string) => void;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  handleCallAccepted: (payload: CallAcceptPayload) => Promise<void>;
  handleCallDeclined: (payload: CallDeclinePayload) => void;
  handleCallEnded: (payload: CallEndPayload) => void;
  handleCallState: (payload: CallStatePayload) => void;
  handleParticipantJoined: (payload: CallParticipantPayload) => Promise<void>;
  handleParticipantLeft: (payload: CallParticipantPayload) => void;
  handleRemoteMediaState: (payload: CallMediaStatePayload) => void;
  handleRemoteOffer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteAnswer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteIceCandidate: (payload: CallSignalCandidatePayload) => Promise<void>;
  resetCall: () => void;
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

