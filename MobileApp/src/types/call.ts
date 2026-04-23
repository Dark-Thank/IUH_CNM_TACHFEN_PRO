export type CallType = "audio" | "video";

export type CallDirection = "incoming" | "outgoing";

export type CallStatus =
	| "incoming"
	| "acquiring-media"
	| "outgoing-ringing"
	| "negotiating"
	| "connected"
	| "reconnecting"
	| "idle";

export interface CallPeer {
	_id: string;
	displayName: string;
	avatarUrl?: string | null;
	joinedAt: string;
}

export interface CallSession {
	callId: string;
	conversationId: string;
	callType: CallType;
	direction: CallDirection;
	status: CallStatus;
	peer: CallPeer;
	callerId: string;
	recipientId: string;
	isGroup: boolean;
	participantIds: string[];
	conversationName?: string | null;
	createdAt: string;
}

export interface CallInvitePayload {
	callId: string;
	conversationId: string;
	callerId: string;
	recipientId: string;
	callType: CallType;
	isGroup?: boolean;
	participantIds?: string[];
	conversationName?: string | null;
	createdAt: string;
}

export interface CallRejoinPayload {
	callId: string;
	conversationId: string;
	callerId: string;
	recipientId: string;
	callType: CallType;
	isGroup?: boolean;
	participantIds?: string[];
	conversationName?: string | null;
	createdAt: string;
}

export interface CallParticipantPayload {
	callId: string;
	conversationId: string;
	participantId: string;
	reason?: string;
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

export interface CallMediaStatePayload {
	callId: string;
	conversationId: string;
	senderId: string;
	mediaType: "camera";
	enabled: boolean;
}

export interface CallMeta {
	callType: CallType;
	outcome:
		| "busy"
		| "declined"
		| "missed"
		| "cancelled"
		| "disconnected"
		| "reconnect-timeout"
		| "completed";
	callerId: string;
	recipientId: string;
	durationSeconds?: number;
	startedAt?: string | null;
	endedAt?: string | null;
}
