import type { CallType } from "@/types/call";
import { getRtcConfiguration, warnIfLocalOnlyRealtimeConfig } from "./runtimeConfig";

warnIfLocalOnlyRealtimeConfig();

const rtcConfig: RTCConfiguration = getRtcConfiguration();

export const createCallId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getBrowserUserMedia = async (callType: CallType) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trinh duyet hien tai khong ho tro goi WebRTC.");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video" ? { facingMode: "user" } : false,
  });
};

export const createBrowserPeerConnection = ({
  onIceCandidate,
  onRemoteStream,
  onConnectionStateChange,
}: {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (connectionState: RTCPeerConnectionState) => void;
}) => {
  const peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;

    if (stream) {
      onRemoteStream(stream);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange?.(peerConnection.connectionState);
  };

  return peerConnection;
};