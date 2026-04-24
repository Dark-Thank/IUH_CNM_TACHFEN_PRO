export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  role: "owner" | "deputy" | "member";
  joinedAt: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
  avatar?: string | null;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  createdAt: string;
  // ĐỔI TÊN TỪ sender THÀNH senderId ĐỂ KHỚP VỚI BACKEND
  senderId: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface CallMeta {
  callType: "audio" | "video";
  outcome: "completed" | "busy" | "declined" | "missed" | "cancelled" | "disconnected" | "reconnect-timeout";
  callerId: string;
  recipientId: string;
  durationSeconds: number;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface VoiceMeta {
  durationSeconds: number;
  mimeType?: string | null;
}

export interface ReactionUser {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface PollOption {
  _id: string;
  text: string;
  voterIds: string[];
}

export interface PollMeta {
  question: string;
  options: PollOption[];
  hideVoters?: boolean;
  hideResultsUntilVote?: boolean;
  allowMultipleChoices?: boolean;
  allowUserAddedOptions?: boolean;
  expiresAt?: string | null;
  createdBy: string;
  closedAt?: string | null;
  closedBy?: string | null;
}

export type AppointmentResponseStatus = "going" | "maybe" | "declined";

export interface AppointmentResponse {
  userId: string;
  status: AppointmentResponseStatus;
  respondedAt: string;
}

export interface AppointmentMeta {
  title: string;
  description?: string | null;
  location?: string | null;
  scheduledAt: string;
  createdBy: string;
  responses: AppointmentResponse[];
}

export interface ReplyToMessage {
  messageId: string;
  senderId: string;
  content: string | null;
  messageType?: "text" | "call" | "voice" | "poll" | "appointment";
  imgUrls?: string[];
  fileUrls?: {
    url: string;
    name: string;
    size: number;
    type: string;
  }[];
  createdAt: string;
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  deliveredTo?: string[];
  seenBy?: string[];
  messageType?: "text" | "call" | "voice" | "poll" | "appointment";
  callMeta?: CallMeta | null;
  voiceMeta?: VoiceMeta | null;
  pollMeta?: PollMeta | null;
  appointmentMeta?: AppointmentMeta | null;

  forwardedFrom?: {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string | null;
    imgUrls?: string[];
    fileUrls?: {
      url: string;
      name: string;
      size: number;
      type: string;
    }[];
    createdAt: string;
  } | null;
  replyTo?: ReplyToMessage | null;

  imgUrls?: string[];
  fileUrls?: {
    url: string;
    name: string;
    size: number;
    type: string;
  }[];

  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: string;
  isRecalled?: boolean;
  recalledAt?: string;
  deletedForUsers?: string[];

  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
  reactions?: {
    [emoji: string]: ReactionUser[];
  };
}
