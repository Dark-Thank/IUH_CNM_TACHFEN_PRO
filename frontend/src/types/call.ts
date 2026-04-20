import type { Participant } from "./chat";

export type CallType = "audio" | "video";
export type CallDirection = "incoming" | "outgoing";
export type CallStatus =
  | "idle"
  | "incoming"
  | "acquiring-media"
  | "outgoing-ringing"
  | "negotiating"
  | "connected"
  | "reconnecting";

export interface CallPeer extends Pick<Participant, "_id" | "displayName" | "avatarUrl"> {}

export interface CallSession {
  callId: string;
  conversationId: string;
  callType: CallType;
  direction: CallDirection;
  status: CallStatus;
  peer: CallPeer;
  callerId: string;
  recipientId: string;
  createdAt: string;
}

export interface CallInvitePayload {
  callId: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  callType: CallType;
  createdAt: string;
}

export interface CallAcceptPayload {
  callId: string;
  conversationId: string;
  callerId: string;
  recipientId: string;
  callType: CallType;
}

export interface CallDeclinePayload {
  callId: string;
  conversationId: string;
  senderId: string;
  targetId: string;
  reason?: string;
}

export interface CallEndPayload {
  callId: string;
  conversationId: string;
  senderId: string;
  targetId: string;
  reason?: string;
}

export interface CallSignalDescriptionPayload {
  callId: string;
  conversationId: string;
  senderId: string;
  targetId: string;
  description: RTCSessionDescriptionInit;
}

export interface CallSignalCandidatePayload {
  callId: string;
  conversationId: string;
  senderId: string;
  targetId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallStatePayload {
  callId: string;
  conversationId: string;
  state: "connected" | "reconnecting";
  affectedUserId?: string;
}