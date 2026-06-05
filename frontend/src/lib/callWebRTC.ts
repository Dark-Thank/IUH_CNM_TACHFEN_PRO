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
    return "Không thể truy cập microphone/camera trên trình duyệt.";
  }

  switch (error.name) {
    case "NotAllowedError": {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "";
      const isAllowedOrigin = typeof window === "undefined" || window.isSecureContext || isLocalhostHostname(hostname);

      if (!isAllowedOrigin) {
        return "Trình duyệt web chỉ cho phép camera và microphone trên HTTPS hoặc localhost.";
      }

      return "Trình duyệt đã từ chối quyền camera/microphone. Hãy cấp quyền camera và microphone cho trang web này.";
    }
    case "NotFoundError":
      return "Không tìm thấy microphone/camera trên thiết bị này.";
    case "NotReadableError":
      return "Microphone/camera đang được ứng dụng khác sử dụng.";
    case "OverconstrainedError":
      return "Camera hiện tại không phù hợp với cấu hình được yêu cầu trên web.";
    default:
      return `Không thể truy cập microphone/camera: ${error.message || error.name}`;
  }
};

export const getBrowserUserMedia = async (callType: CallType) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt hiện tại không hỗ trợ gọi WebRTC.");
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