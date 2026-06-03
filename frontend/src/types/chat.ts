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
  privacy?: "public" | "private";
}

export interface JoinRequestUser {
  _id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
}

export interface JoinRequest {
  user: JoinRequestUser;
  requestedBy: JoinRequestUser;
  addedBy?: JoinRequestUser | null;
  source: "invite" | "add";
  requestedAt: string;
}

export interface LastMessage {
  _id: string;
  content: string | null;
  createdAt: string;
  sender?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
  senderId?: string | {
    _id: string;
    displayName?: string;
    avatarUrl?: string | null;
  } | null;
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

export interface GroupInviteMeta {
  conversationId: string;
  groupName: string;
  invitationToken: string;
  invitationUrl: string;
  invitedBy: string;
  responseStatus?: "pending" | "accepted" | "declined" | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  expiresAt?: string | null;
}

export interface ReplyToMessage {
  messageId: string;
  senderId: string;
  content: string | null;
  messageType?: "text" | "call" | "voice" | "poll" | "appointment" | "group_invite";
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
  joinRequests?: JoinRequest[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>;
  pinnedBy?: {
    userId: string;
    pinnedAt: string | null;
  }[];
  isPinned?: boolean;
  pinnedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface ConversationSummary {
  provider: string;
  model?: string;
  summary: string;
  bullets: string[];
  actionItems: string[];
  messageCount: number;
  scope?: "recent" | "unread";
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  deliveredTo?: string[];
  seenBy?: string[];
  messageType?: "text" | "call" | "voice" | "poll" | "appointment" | "group_invite";
  callMeta?: CallMeta | null;
  voiceMeta?: VoiceMeta | null;
  pollMeta?: PollMeta | null;
  appointmentMeta?: AppointmentMeta | null;
  groupInviteMeta?: GroupInviteMeta | null;

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
