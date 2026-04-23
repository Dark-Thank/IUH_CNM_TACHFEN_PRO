import { createBrowserPeerConnection, createCallId, getBrowserUserMedia } from "@/lib/callWebRTC";
import type {
    CallAcceptPayload,
    CallDeclinePayload,
    CallEndPayload,
    CallInvitePayload,
    CallParticipantPayload,
    CallSession,
    CallSignalCandidatePayload,
    CallSignalDescriptionPayload,
    CallStatePayload,
    CallStatus,
    CallType,
} from "@/types/call";
import type { Conversation, Participant } from "@/types/chat";
import { toast } from "sonner";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useSocketStore } from "./useSocketStore";

type CallStore = {
  currentCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  startOutgoingCall: (conversation: Conversation, callType: CallType) => Promise<void>;
  receiveIncomingCall: (payload: CallInvitePayload) => void;
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
  handleRemoteOffer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteAnswer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteIceCandidate: (payload: CallSignalCandidatePayload) => Promise<void>;
  resetCall: () => void;
};

const peerConnections = new Map<string, RTCPeerConnection>();

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const pickPrimaryRemoteStream = (remoteStreams: Record<string, MediaStream>) =>
  Object.values(remoteStreams)[0] ?? null;

const resolvePeerFromConversation = (conversation: Conversation, currentUserId?: string | null) =>
  conversation.participants.find((participant) => participant._id !== currentUserId) ?? null;

const resolveCallLabelPeer = (conversation: Conversation) => ({
  _id: conversation._id,
  displayName: conversation.group?.name || "Nhom chat",
  avatarUrl: null,
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
      displayName: conversation?.group?.name || conversationName || "Nhom chat",
      avatarUrl: null,
      joinedAt: new Date().toISOString(),
    };
  }

  const peer = conversation?.participants.find((participant) => participant._id === callerId);

  return {
    _id: callerId,
    displayName: peer?.displayName ?? "Nguoi dung",
    avatarUrl: peer?.avatarUrl ?? null,
    joinedAt: peer?.joinedAt ?? new Date().toISOString(),
  };
};

const getCallEndMessage = (reason?: string) => {
  switch (reason) {
    case "busy":
      return "Nguoi dung dang trong mot cuoc goi khac.";
    case "declined":
      return "Cuoc goi da bi tu choi.";
    case "missed":
      return "Khong co phan hoi cho cuoc goi.";
    case "disconnected":
      return "Doi phuong da mat ket noi.";
    case "cancelled":
      return "Cuoc goi da bi huy.";
    case "reconnect-timeout":
      return "Cuoc goi da ket thuc do khong the khoi phuc ket noi.";
    default:
      return "Cuoc goi da ket thuc.";
  }
};

const getConversationParticipant = (conversationId: string, participantId: string) => {
  const conversation = useChatStore
    .getState()
    .conversations
    .find((item) => item._id === conversationId);

  return conversation?.participants.find((participant) => participant._id === participantId) ?? null;
};

const closePeerConnection = (remoteUserId: string) => {
  const peerConnection = peerConnections.get(remoteUserId);

  if (!peerConnection) {
    return;
  }

  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onconnectionstatechange = null;
  peerConnection.close();
  peerConnections.delete(remoteUserId);
};

const setCurrentCallStatus = (
  set: (partial: Partial<CallStore> | ((state: CallStore) => Partial<CallStore>)) => void,
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

const getHangupReason = (call: CallSession) => {
  if (call.status === "incoming") {
    return "declined";
  }

  if (
    call.direction === "outgoing" &&
    (call.status === "acquiring-media" || call.status === "outgoing-ringing")
  ) {
    return "cancelled";
  }

  return "ended";
};

const buildPeerConnection = (
  callId: string,
  conversationId: string,
  remoteUserId: string,
  set: (partial: Partial<CallStore> | ((state: CallStore) => Partial<CallStore>)) => void
) => {
  const existingConnection = peerConnections.get(remoteUserId);

  if (existingConnection) {
    return existingConnection;
  }

  const peerConnection = createBrowserPeerConnection({
    onIceCandidate: (candidate) => {
      useSocketStore.getState().socket?.emit("call:ice-candidate", {
        callId,
        conversationId,
        targetId: remoteUserId,
        candidate: candidate.toJSON(),
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
  });

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
  currentCall: CallSession,
  localStream: MediaStream,
  remoteUserId: string,
  set: (partial: Partial<CallStore> | ((state: CallStore) => Partial<CallStore>)) => void
) => {
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

export const useCallStore = create<CallStore>((set, get) => ({
  currentCall: null,
  localStream: null,
  remoteStream: null,
  remoteStreams: {},
  isMicrophoneEnabled: true,
  isCameraEnabled: true,

  startOutgoingCall: async (conversation, callType) => {
    const { currentCall } = get();

    if (currentCall) {
      toast.info("Hay ket thuc cuoc goi hien tai truoc.");
      return;
    }

    if (conversation.type === "group" && callType !== "video") {
      toast.info("Group chat hien chi ho tro goi video.");
      return;
    }

    const authUserId = useAuthStore.getState().user?._id;
    const peer = resolvePeerFromConversation(conversation, authUserId);
    const isGroup = conversation.type === "group";
    const callPeer = isGroup ? resolveCallLabelPeer(conversation) : peer;

    if (!callPeer || (!isGroup && !peer)) {
      toast.error("Khong tim thay nguoi nhan cuoc goi.");
      return;
    }

    const socket = useSocketStore.getState().socket;

    if (!socket) {
      toast.error("Socket chua san sang.");
      return;
    }

    try {
      const callId = createCallId();
      const callerId = authUserId ?? "";

      set({
        localStream: null,
        remoteStream: null,
        remoteStreams: {},
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

      const localStream = await getBrowserUserMedia(callType);

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
      console.error("Khong the bat dau cuoc goi:", error);
      toast.error(error instanceof Error ? error.message : "Khong the truy cap microphone/camera.");
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
      isMicrophoneEnabled: true,
      isCameraEnabled: payload.callType === "video",
    });

    toast.info(`${peer.displayName} dang goi ${payload.callType === "video" ? "video" : "thoai"}.`);
  },

  acceptIncomingCall: async () => {
    const { currentCall } = get();
    const socket = useSocketStore.getState().socket;

    if (!currentCall || currentCall.status !== "incoming" || !socket) {
      return;
    }

    try {
      setCurrentCallStatus(set, "acquiring-media");

      const localStream = await getBrowserUserMedia(currentCall.callType);

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
      console.error("Khong the chap nhan cuoc goi:", error);
      toast.error(error instanceof Error ? error.message : "Khong the truy cap microphone/camera.");
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

    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !isCameraEnabled;
    });

    set({ isCameraEnabled: !isCameraEnabled });
  },

  handleCallAccepted: async (payload) => {
    const { currentCall, localStream } = get();

    if (!currentCall || currentCall.callId !== payload.callId || !localStream || currentCall.isGroup) {
      return;
    }

    await createOfferForParticipant(currentCall, localStream, currentCall.peer._id, set);
  },

  handleCallDeclined: (payload) => {
    if (get().currentCall?.callId !== payload.callId) {
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
      delete remoteStreams[payload.participantId];

      return {
        remoteStreams,
        remoteStream: pickPrimaryRemoteStream(remoteStreams),
      };
    });
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

    await connection.setRemoteDescription(payload.description);

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

    await connection.setRemoteDescription(payload.description);
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
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
    });
  },
}));