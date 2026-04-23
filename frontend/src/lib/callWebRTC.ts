import type { CallType } from "@/types/call";
import { getRtcConfiguration, warnIfLocalOnlyRealtimeConfig } from "./runtimeConfig";

warnIfLocalOnlyRealtimeConfig();

const rtcConfig: RTCConfiguration = getRtcConfiguration();

export const createCallId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isLocalhostHostname = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const buildMediaConstraints = (callType: CallType, includeFacingMode = true): MediaStreamConstraints => ({
  audio: true,
  video:
    callType === "video"
      ? includeFacingMode
        ? { facingMode: "user" }
        : true
      : false,
});

const getBrowserMediaErrorMessage = (error: unknown) => {
  if (!(error instanceof DOMException)) {
    return "Khong the truy cap microphone/camera tren trinh duyet.";
  }

  switch (error.name) {
    case "NotAllowedError": {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "";
      const isAllowedOrigin = typeof window === "undefined" || window.isSecureContext || isLocalhostHostname(hostname);

      if (!isAllowedOrigin) {
        return "Trinh duyet web chi cho phep camera va microphone tren HTTPS hoac localhost.";
      }

      return "Trinh duyet da tu choi quyen camera/microphone. Hay cap quyen camera va microphone cho trang web nay.";
    }
    case "NotFoundError":
      return "Khong tim thay microphone/camera tren thiet bi nay.";
    case "NotReadableError":
      return "Microphone/camera dang duoc ung dung khac su dung.";
    case "OverconstrainedError":
      return "Camera hien tai khong phu hop voi cau hinh duoc yeu cau tren web.";
    default:
      return `Khong the truy cap microphone/camera: ${error.message || error.name}`;
  }
};

export const getBrowserUserMedia = async (callType: CallType) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trinh duyet hien tai khong ho tro goi WebRTC.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia(buildMediaConstraints(callType));
  } catch (error) {
    if (callType === "video" && error instanceof DOMException && error.name === "OverconstrainedError") {
      try {
        return await navigator.mediaDevices.getUserMedia(buildMediaConstraints(callType, false));
      } catch (fallbackError) {
        throw new Error(getBrowserMediaErrorMessage(fallbackError));
      }
    }

    throw new Error(getBrowserMediaErrorMessage(error));
  }
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