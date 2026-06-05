import { createCallId, createMobilePeerConnection, getMobileUserMedia, serializeIceCandidate } from "@/lib/callWebRTC";
import { toast } from "@/lib/toast";
import type { CallMediaStatePayload, CallRejoinPayload, CallStatus } from "@/types/call";
import type { Conversation, Participant } from "@/types/chat";
import type { CallState } from "@/types/store";
import type { MediaStream, RTCPeerConnection } from "react-native-webrtc";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useSocketStore } from "./useSocketStore";

const peerConnections = new Map<string, RTCPeerConnection>();

const stopStream = (stream: MediaStream | null) => {
	stream?.getTracks().forEach((track) => track.stop());
};

const pickPrimaryRemoteStream = (remoteStreams: Record<string, MediaStream>) =>
	Object.values(remoteStreams)[0] ?? null;

const createInitialRemoteCameraStates = (
	participantIds: string[],
	currentUserId?: string | null,
	callType?: "audio" | "video"
) => {
	if (callType !== "video") {
		return {};
	}

	return participantIds.reduce<Record<string, boolean>>((cameraStates, participantId) => {
		if (participantId !== currentUserId) {
			cameraStates[participantId] = true;
		}

		return cameraStates;
	}, {});
};

const emitCameraState = (currentCall: CallState["currentCall"], enabled: boolean) => {
	if (!currentCall || currentCall.callType !== "video") {
		return;
	}

	useSocketStore.getState().socket?.emit("call:media-state", {
		callId: currentCall.callId,
		conversationId: currentCall.conversationId,
		mediaType: "camera",
		enabled,
	});
};

const resolvePeerFromConversation = (conversation: Conversation, currentUserId?: string | null) =>
	conversation.participants.find((participant) => participant._id !== currentUserId) ?? null;

const resolveCallLabelPeer = (conversation: Conversation): Participant => ({
	_id: conversation._id,
	displayName: conversation.group?.name || "Nhóm chat",
	avatarUrl: null,
	role: "member",
	joinedAt: new Date().toISOString(),
});

const resolvePeerForIncomingCall = (
	conversationId: string,
	callerId: string,
	isGroup: boolean,
	conversationName?: string | null
): Participant => {
	const conversation = useChatStore
		.getState()
		.conversations
		.find((item) => item._id === conversationId);

	if (isGroup) {
		return {
			_id: callerId,
			displayName: conversation?.group?.name || conversationName || "Nhóm chat",
			avatarUrl: null,
			role: "member",
			joinedAt: new Date().toISOString(),
		};
	}

	const peer = conversation?.participants.find((participant) => participant._id === callerId);

	return {
		_id: callerId,
		displayName: peer?.displayName ?? "Người dùng",
		avatarUrl: peer?.avatarUrl ?? null,
		role: peer?.role ?? "member",
		joinedAt: peer?.joinedAt ?? new Date().toISOString(),
	};
};

const toNativeSessionDescription = (description: RTCSessionDescriptionInit) => ({
	type: description.type,
	sdp: description.sdp ?? "",
}) as any;

const getCallEndMessage = (reason?: string) => {
	switch (reason) {
		case "busy":
			return "Người dùng đang trong một cuộc gọi khác.";
		case "declined":
			return "Cuộc gọi đã bị từ chối.";
		case "missed":
			return "Không có phản hồi cho cuộc gọi.";
		case "disconnected":
			return "Đối phương đã mất kết nối.";
		case "cancelled":
			return "Cuộc gọi đã bị hủy.";
		case "reconnect-timeout":
			return "Cuộc gọi đã kết thúc do không thể khôi phục kết nối.";
		default:
			return "Cuộc gọi đã kết thúc.";
	}
};

const closePeerConnection = (remoteUserId: string) => {
	const peerConnection = peerConnections.get(remoteUserId);

	if (!peerConnection) {
		return;
	}

	(peerConnection as any).onicecandidate = null;
	(peerConnection as any).ontrack = null;
	(peerConnection as any).onconnectionstatechange = null;
	peerConnection.close();
	peerConnections.delete(remoteUserId);
};

const setCurrentCallStatus = (
	set: (partial: Partial<CallState> | ((state: CallState) => Partial<CallState>)) => void,
	status: CallStatus
) => {
	set((state) => ({
		currentCall: state.currentCall
			? {
				...state.currentCall,
				status,
			}
			: null,
	}));
};

const buildPeerConnection = (
	callId: string,
	conversationId: string,
	remoteUserId: string,
	set: (partial: Partial<CallState> | ((state: CallState) => Partial<CallState>)) => void
): RTCPeerConnection => {
	const existingConnection = peerConnections.get(remoteUserId);

	if (existingConnection) {
		return existingConnection;
	}

	const peerConnection = createMobilePeerConnection({
		onIceCandidate: (candidate) => {
			useSocketStore.getState().socket?.emit("call:ice-candidate", {
				callId,
				conversationId,
				targetId: remoteUserId,
				candidate: serializeIceCandidate(candidate),
			});
		},
		onRemoteStream: (stream) => {
			set((state) => {
				const remoteStreams = {
					...state.remoteStreams,
					[remoteUserId]: stream,
				};

				return {
					remoteStreams,
					remoteStream: pickPrimaryRemoteStream(remoteStreams),
				};
			});
		},
		onConnectionStateChange: (connectionState) => {
			if (connectionState === "connected") {
				setCurrentCallStatus(set, "connected");
				return;
			}

			if (connectionState === "connecting") {
				setCurrentCallStatus(set, "negotiating");
				return;
			}

			if (connectionState === "disconnected" || connectionState === "failed") {
				setCurrentCallStatus(set, "reconnecting");
			}
		},
	}) as RTCPeerConnection;

	peerConnections.set(remoteUserId, peerConnection);
	return peerConnection;
};

const ensureLocalTracks = (connection: RTCPeerConnection, localStream: MediaStream) => {
	if (connection.getSenders().length > 0) {
		return;
	}

	localStream.getTracks().forEach((track) => {
		connection.addTrack(track, localStream);
	});
};

const createOfferForParticipant = async (
	currentCall: CallState["currentCall"],
	localStream: MediaStream,
	remoteUserId: string,
	set: (partial: Partial<CallState> | ((state: CallState) => Partial<CallState>)) => void
) => {
	if (!currentCall) {
		return;
	}

	const connection = buildPeerConnection(
		currentCall.callId,
		currentCall.conversationId,
		remoteUserId,
		set
	);

	ensureLocalTracks(connection, localStream);
	setCurrentCallStatus(set, "negotiating");

	const offer = await connection.createOffer({
		offerToReceiveAudio: true,
		offerToReceiveVideo: currentCall.callType === "video",
	});

	await connection.setLocalDescription(offer);

	useSocketStore.getState().socket?.emit("call:offer", {
		callId: currentCall.callId,
		conversationId: currentCall.conversationId,
		targetId: remoteUserId,
		description: offer,
	});
};

export const useCallStore = create<CallState>((set, get) => ({
	currentCall: null,
	localStream: null,
	remoteStream: null,
	remoteStreams: {},
	remoteCameraStates: {},
	isMicrophoneEnabled: true,
	isCameraEnabled: true,

	startOutgoingCall: async (conversation, callType) => {
		const { currentCall } = get();

		if (currentCall) {
			toast.info("Hãy kết thúc cuộc gọi hiện tại trước.");
			return;
		}

		if (conversation.type === "group" && callType !== "video") {
			toast.info("Group chat hiện chỉ hỗ trợ gọi video.");
			return;
		}

		const authUserId = useAuthStore.getState().user?._id;
		const peer = resolvePeerFromConversation(conversation, authUserId);
		const isGroup = conversation.type === "group";
		const callPeer = isGroup ? resolveCallLabelPeer(conversation) : peer;

		if (!callPeer || (!isGroup && !peer)) {
			toast.error("Không tìm thấy người nhận cuộc gọi.");
			return;
		}

		const socket = useSocketStore.getState().socket;

		if (!socket) {
			toast.error("Socket chưa sẵn sàng.");
			return;
		}

		try {
			const callId = createCallId();
			const callerId = authUserId ?? "";

			set({
				localStream: null,
				remoteStream: null,
				remoteStreams: {},
				remoteCameraStates: createInitialRemoteCameraStates(
					conversation.participants.map((participant) => participant._id),
					authUserId,
					callType
				),
				isMicrophoneEnabled: true,
				isCameraEnabled: callType === "video",
				currentCall: {
					callId,
					conversationId: conversation._id,
					callType,
					direction: "outgoing",
					status: "acquiring-media",
					peer: callPeer,
					callerId,
					recipientId: peer?._id ?? "",
					isGroup,
					participantIds: conversation.participants.map((participant) => participant._id),
					conversationName: conversation.group?.name ?? null,
					createdAt: new Date().toISOString(),
				},
			});

			const localStream = await getMobileUserMedia(callType);

			set({
				localStream,
				remoteStream: null,
				remoteStreams: {},
				isMicrophoneEnabled: true,
				isCameraEnabled: callType === "video",
			});

			setCurrentCallStatus(set, "outgoing-ringing");

			socket.emit("call:invite", {
				callId,
				conversationId: conversation._id,
				recipientId: peer?._id,
				callType,
			});
		} catch (error) {
			console.error("Không thể bắt đầu cuộc gọi:", error);
			toast.error(error instanceof Error ? error.message : "Không thể truy cập microphone/camera.");
			get().resetCall();
		}
	},

	receiveIncomingCall: (payload) => {
		if (get().currentCall) {
			return;
		}

		const peer = resolvePeerForIncomingCall(
			payload.conversationId,
			payload.callerId,
			Boolean(payload.isGroup),
			payload.conversationName
		);

		set({
			currentCall: {
				...payload,
				peer,
				direction: "incoming",
				status: "incoming",
				isGroup: Boolean(payload.isGroup),
				participantIds: payload.participantIds ?? [payload.callerId, payload.recipientId],
				conversationName: payload.conversationName ?? null,
			},
			localStream: null,
			remoteStream: null,
			remoteStreams: {},
			remoteCameraStates: createInitialRemoteCameraStates(
				payload.participantIds ?? [payload.callerId, payload.recipientId],
				useAuthStore.getState().user?._id,
				payload.callType
			),
			isMicrophoneEnabled: true,
			isCameraEnabled: payload.callType === "video",
		});

		toast.info(`${peer.displayName} đang gọi ${payload.callType === "video" ? "video" : "thoại"}.`);
	},

	handleCallRejoin: (payload: CallRejoinPayload) => {
		const { currentCall, localStream } = get();

		if (!currentCall || !currentCall.isGroup || currentCall.conversationId !== payload.conversationId || !localStream) {
			return;
		}

		set((state) => ({
			currentCall: state.currentCall
				? {
					...state.currentCall,
					callId: payload.callId,
					callerId: payload.callerId,
					recipientId: payload.recipientId,
					participantIds: payload.participantIds ?? state.currentCall.participantIds,
					conversationName: payload.conversationName ?? state.currentCall.conversationName,
					status: "negotiating",
				}
				: null,
			remoteCameraStates: payload.participantIds
				? {
					...createInitialRemoteCameraStates(
						payload.participantIds,
						useAuthStore.getState().user?._id,
						state.currentCall?.callType
					),
					...state.remoteCameraStates,
				}
				: state.remoteCameraStates,
		}));

		toast.info("Đang vào lại cuộc gọi nhóm đang diễn ra.");
	},

	acceptIncomingCall: async () => {
		const { currentCall } = get();
		const socket = useSocketStore.getState().socket;

		if (!currentCall || currentCall.status !== "incoming" || !socket) {
			return;
		}

		try {
			setCurrentCallStatus(set, "acquiring-media");

			const localStream = await getMobileUserMedia(currentCall.callType);

			set({
				localStream,
				remoteStream: null,
				remoteStreams: {},
				isMicrophoneEnabled: true,
				isCameraEnabled: currentCall.callType === "video",
			});

			setCurrentCallStatus(set, "negotiating");

			if (!currentCall.isGroup) {
				const connection = buildPeerConnection(
					currentCall.callId,
					currentCall.conversationId,
					currentCall.peer._id,
					set
				);

				ensureLocalTracks(connection, localStream);
			}

			socket.emit("call:accept", {
				callId: currentCall.callId,
				conversationId: currentCall.conversationId,
				targetId: currentCall.isGroup ? currentCall.callerId : currentCall.peer._id,
			});
		} catch (error) {
			console.error("Không thể chấp nhận cuộc gọi:", error);
			toast.error(error instanceof Error ? error.message : "Không thể truy cập microphone/camera.");
			get().declineIncomingCall("failed");
		}
	},

	declineIncomingCall: (reason = "declined") => {
		const { currentCall } = get();
		const socket = useSocketStore.getState().socket;

		if (currentCall && socket) {
			socket.emit("call:decline", {
				callId: currentCall.callId,
				conversationId: currentCall.conversationId,
				targetId: currentCall.isGroup ? currentCall.callerId : currentCall.peer._id,
				reason,
			});
		}

		get().resetCall();
	},

	endCall: (reason = "ended") => {
		const { currentCall } = get();
		const socket = useSocketStore.getState().socket;

		if (currentCall && socket) {
			socket.emit("call:end", {
				callId: currentCall.callId,
				conversationId: currentCall.conversationId,
				targetId: currentCall.isGroup ? currentCall.callerId : currentCall.peer._id,
				reason,
			});
		}

		get().resetCall();
	},

	toggleMicrophone: () => {
		const { localStream, isMicrophoneEnabled } = get();

		localStream?.getAudioTracks().forEach((track) => {
			track.enabled = !isMicrophoneEnabled;
		});

		set({ isMicrophoneEnabled: !isMicrophoneEnabled });
	},

	toggleCamera: () => {
		const { currentCall, localStream, isCameraEnabled } = get();

		if (currentCall?.callType !== "video") {
			return;
		}

		const nextEnabled = !isCameraEnabled;

		localStream?.getVideoTracks().forEach((track) => {
			track.enabled = nextEnabled;
		});

		set({ isCameraEnabled: nextEnabled });
		emitCameraState(currentCall, nextEnabled);
	},

	handleCallAccepted: async (payload) => {
		const { currentCall, localStream } = get();

		if (!currentCall || currentCall.callId !== payload.callId || !localStream || currentCall.isGroup) {
			return;
		}

		await createOfferForParticipant(currentCall, localStream, currentCall.peer._id, set);
	},

	handleCallDeclined: (payload) => {
		const { currentCall } = get();

		if (currentCall?.callId !== payload.callId) {
			return;
		}

		if (currentCall.isGroup) {
			toast.info("Một thành viên đã từ chối cuộc gọi.");
			return;
		}

		toast.info(getCallEndMessage(payload.reason));
		get().resetCall();
	},

	handleCallEnded: (payload) => {
		if (get().currentCall?.callId !== payload.callId) {
			return;
		}

		toast.info(getCallEndMessage(payload.reason));
		get().resetCall();
	},

	handleCallState: (payload) => {
		const { currentCall } = get();

		if (!currentCall || currentCall.callId !== payload.callId) {
			return;
		}

		if (payload.state === "reconnecting") {
			setCurrentCallStatus(set, "reconnecting");
			return;
		}

		if (payload.state === "connected") {
			setCurrentCallStatus(set, "connected");
		}
	},

	handleParticipantJoined: async (payload) => {
		const { currentCall, localStream } = get();
		const currentUserId = useAuthStore.getState().user?._id;

		if (
			!currentCall ||
			!currentCall.isGroup ||
			currentCall.callId !== payload.callId ||
			!localStream ||
			payload.participantId === currentUserId
		) {
			return;
		}

		await createOfferForParticipant(currentCall, localStream, payload.participantId, set);
	},

	handleParticipantLeft: (payload) => {
		const { currentCall } = get();

		if (!currentCall || currentCall.callId !== payload.callId) {
			return;
		}

		closePeerConnection(payload.participantId);

		set((state) => {
			const remoteStreams = { ...state.remoteStreams };
			const remoteCameraStates = { ...state.remoteCameraStates };
			delete remoteStreams[payload.participantId];
			delete remoteCameraStates[payload.participantId];

			return {
				remoteStreams,
				remoteCameraStates,
				remoteStream: pickPrimaryRemoteStream(remoteStreams),
			};
		});
	},

	handleRemoteMediaState: (payload: CallMediaStatePayload) => {
		const { currentCall } = get();

		if (!currentCall || currentCall.callId !== payload.callId || payload.mediaType !== "camera") {
			return;
		}

		set((state) => ({
			remoteCameraStates: {
				...state.remoteCameraStates,
				[payload.senderId]: payload.enabled,
			},
		}));
	},

	handleRemoteOffer: async (payload) => {
		const { currentCall, localStream } = get();

		if (!currentCall || currentCall.callId !== payload.callId || !localStream) {
			return;
		}

		const connection = buildPeerConnection(
			currentCall.callId,
			currentCall.conversationId,
			payload.senderId,
			set
		);

		ensureLocalTracks(connection, localStream);
		setCurrentCallStatus(set, "negotiating");

		await connection.setRemoteDescription(toNativeSessionDescription(payload.description));

		const answer = await connection.createAnswer();
		await connection.setLocalDescription(answer);

		useSocketStore.getState().socket?.emit("call:answer", {
			callId: currentCall.callId,
			conversationId: currentCall.conversationId,
			targetId: payload.senderId,
			description: answer,
		});
	},

	handleRemoteAnswer: async (payload) => {
		const connection = peerConnections.get(payload.senderId);

		if (!connection || get().currentCall?.callId !== payload.callId) {
			return;
		}

		setCurrentCallStatus(set, "negotiating");
		await connection.setRemoteDescription(toNativeSessionDescription(payload.description));
	},

	handleRemoteIceCandidate: async (payload) => {
		const connection = peerConnections.get(payload.senderId);

		if (!connection || get().currentCall?.callId !== payload.callId) {
			return;
		}

		await connection.addIceCandidate(payload.candidate);
	},

	resetCall: () => {
		stopStream(get().localStream);
		Object.values(get().remoteStreams).forEach((stream) => {
			stopStream(stream);
		});

		Array.from(peerConnections.keys()).forEach((remoteUserId) => {
			closePeerConnection(remoteUserId);
		});

		set({
			currentCall: null,
			localStream: null,
			remoteStream: null,
			remoteStreams: {},
			remoteCameraStates: {},
			isMicrophoneEnabled: true,
			isCameraEnabled: true,
		});
	},
}));
