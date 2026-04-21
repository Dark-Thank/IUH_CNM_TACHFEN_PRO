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
}

export interface LastMessage {
  _id: string;
  content: string | null;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface ReplyToMessage {
  messageId: string;
  senderId: string;
  content: string | null;
  messageType?: "text" | "call" | "voice";
  imgUrls?: string[];
  fileUrls?: {
    url: string;
    name: string;
    size?: number;
    type?: string;
  }[];
  createdAt: string;
}

export interface VoiceMeta {
  durationSeconds: number;
  mimeType?: string | null;
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

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = unread count
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
  replyTo?: ReplyToMessage | null;
  forwardedFrom?: {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string | null;
    imgUrls?: string[];
    fileUrls?: {
      url: string;
      name: string;
      size?: number;
      type?: string;
    }[];
    createdAt: string;
  } | null;
  messageType?: "text" | "call" | "voice";
  callMeta?: CallMeta | null;
  voiceMeta?: VoiceMeta | null;
  isRecalled?: boolean;
  recalledAt?: string | null;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: string | null;
  updatedAt?: string | null;
  deletedForUsers?: string[];

  imgUrls?: string[];
  fileUrls?: {
    url: string;
    name: string;
    size?: number;
    type?: string;
  }[];
  createdAt: string;
  isOwn?: boolean;
  reactions?: {
    [emoji: string]: string[];
  };
}
