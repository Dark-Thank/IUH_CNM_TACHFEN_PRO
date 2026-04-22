import { createBrowserPeerConnection, createCallId, getBrowserUserMedia } from "@/lib/callWebRTC";
import type {
  CallAcceptPayload,
  CallDeclinePayload,
  CallEndPayload,
  CallInvitePayload,
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
  handleRemoteOffer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteAnswer: (payload: CallSignalDescriptionPayload) => Promise<void>;
  handleRemoteIceCandidate: (payload: CallSignalCandidatePayload) => Promise<void>;
  resetCall: () => void;
};

let peerConnection: RTCPeerConnection | null = null;

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const resolvePeerFromConversation = (conversation: Conversation, currentUserId?: string | null) =>
  conversation.participants.find((participant) => participant._id !== currentUserId) ?? null;

const resolvePeerForIncomingCall = (conversationId: string, callerId: string): Participant => {
  const conversation = useChatStore
    .getState()
    .conversations
    .find((item) => item._id === conversationId);

  const peer = conversation?.participants.find((participant) => participant._id === callerId);

  return {
    _id: callerId,
    displayName: peer?.displayName ?? "Nguoi dung",
    avatarUrl: peer?.avatarUrl ?? null,
    role: peer?.role ?? "member",
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

const buildPeerConnection = (callId: string, conversationId: string, targetId: string, set: any) => {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = createBrowserPeerConnection({
    onIceCandidate: (candidate) => {
      useSocketStore.getState().socket?.emit("call:ice-candidate", {
        callId,
        conversationId,
        targetId,
        candidate: candidate.toJSON(),
      });
    },
    onRemoteStream: (stream) => {
      set({ remoteStream: stream });
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

  return peerConnection;
};

export const useCallStore = create<CallStore>((set, get) => ({
  currentCall: null,
  localStream: null,
  remoteStream: null,
  isMicrophoneEnabled: true,
  isCameraEnabled: true,

  startOutgoingCall: async (conversation, callType) => {
    const { currentCall } = get();

    if (currentCall) {
      toast.info("Hay ket thuc cuoc goi hien tai truoc.");
      return;
    }

    if (conversation.type !== "direct") {
      toast.info("Hien tai chi ho tro goi 1-1.");
      return;
    }

    const authUserId = useAuthStore.getState().user?._id;
    const peer = resolvePeerFromConversation(conversation, authUserId);

    if (!peer) {
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
        isMicrophoneEnabled: true,
        isCameraEnabled: callType === "video",
        currentCall: {
          callId,
          conversationId: conversation._id,
          callType,
          direction: "outgoing",
          status: "acquiring-media",
          peer,
          callerId,
          recipientId: peer._id,
          createdAt: new Date().toISOString(),
        },
      });

      const localStream = await getBrowserUserMedia(callType);

      set({
        localStream,
        remoteStream: null,
        isMicrophoneEnabled: true,
        isCameraEnabled: callType === "video",
      });

      setCurrentCallStatus(set, "outgoing-ringing");

      socket.emit("call:invite", {
        callId,
        conversationId: conversation._id,
        recipientId: peer._id,
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

    const peer = resolvePeerForIncomingCall(payload.conversationId, payload.callerId);

    set({
      currentCall: {
        ...payload,
        peer,
        direction: "incoming",
        status: "incoming",
      },
      localStream: null,
      remoteStream: null,
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
        isMicrophoneEnabled: true,
        isCameraEnabled: currentCall.callType === "video",
      });

      setCurrentCallStatus(set, "negotiating");

      const connection = buildPeerConnection(
        currentCall.callId,
        currentCall.conversationId,
        currentCall.peer._id,
        set
      );

      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });

      socket.emit("call:accept", {
        callId: currentCall.callId,
        conversationId: currentCall.conversationId,
        targetId: currentCall.peer._id,
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
        targetId: currentCall.peer._id,
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
        targetId: currentCall.peer._id,
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

    if (!currentCall || currentCall.callId !== payload.callId || !localStream) {
      return;
    }

    const connection = buildPeerConnection(
      currentCall.callId,
      currentCall.conversationId,
      currentCall.peer._id,
      set
    );

    if (connection.getSenders().length === 0) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    setCurrentCallStatus(set, "negotiating");

    const offer = await connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: currentCall.callType === "video",
    });

    await connection.setLocalDescription(offer);

    useSocketStore.getState().socket?.emit("call:offer", {
      callId: currentCall.callId,
      conversationId: currentCall.conversationId,
      targetId: currentCall.peer._id,
      description: offer,
    });
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

  handleRemoteOffer: async (payload) => {
    const { currentCall, localStream } = get();

    if (!currentCall || currentCall.callId !== payload.callId || !localStream) {
      return;
    }

    const connection = buildPeerConnection(
      currentCall.callId,
      currentCall.conversationId,
      currentCall.peer._id,
      set
    );

    if (connection.getSenders().length === 0) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    setCurrentCallStatus(set, "negotiating");

    await connection.setRemoteDescription(payload.description);

    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    useSocketStore.getState().socket?.emit("call:answer", {
      callId: currentCall.callId,
      conversationId: currentCall.conversationId,
      targetId: currentCall.peer._id,
      description: answer,
    });
  },

  handleRemoteAnswer: async (payload) => {
    if (!peerConnection || get().currentCall?.callId !== payload.callId) {
      return;
    }

    setCurrentCallStatus(set, "negotiating");

    await peerConnection.setRemoteDescription(payload.description);
  },

  handleRemoteIceCandidate: async (payload) => {
    if (!peerConnection || get().currentCall?.callId !== payload.callId) {
      return;
    }

    await peerConnection.addIceCandidate(payload.candidate);
  },

  resetCall: () => {
    stopStream(get().localStream);
    stopStream(get().remoteStream);

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
      peerConnection = null;
    }

    set({
      currentCall: null,
      localStream: null,
      remoteStream: null,
      isMicrophoneEnabled: true,
      isCameraEnabled: true,
    });
  },
}));