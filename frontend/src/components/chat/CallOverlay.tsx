import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import type { CallSession } from "@/types/call";
import { ChevronDown, ChevronUp, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const statusLabelMap = {
  incoming: "Cuộc gọi đến",
  "acquiring-media": "Đang mở thiết bị...",
  "outgoing-ringing": "Đang đổ chuông...",
  negotiating: "Đang thương lượng kết nối...",
  connected: "Đã kết nối",
  reconnecting: "Đang khôi phục kết nối...",
  idle: "Sẵn sàng",
} as const;

const hasActiveVideoTrack = (stream: MediaStream | null) =>
  Boolean(stream?.getVideoTracks().some((track) => track.enabled));

const RINGTONE_PLAYBACK_RATE = 0.82;

const attachStream = (element: HTMLMediaElement | null, stream: MediaStream | null) => {
  if (!element) {
    return;
  }

  if (element.srcObject === stream) {
    return;
  }

  element.srcObject = stream;

  if (!stream) {
    element.pause();
    return;
  }

  void element.play().catch(() => {
    // Ignore autoplay rejections until the next explicit user interaction.
  });
};

const getInitial = (displayName: string) => displayName.trim().charAt(0).toUpperCase() || "U";

const getParticipantFallbackName = (participantId: string) =>
  `User ${participantId.slice(Math.max(0, participantId.length - 4))}`;

const getVideoGridClassName = (count: number) => {
  if (count <= 1) {
    return "grid-cols-1";
  }

  if (count === 2) {
    return "grid-cols-1 md:grid-cols-2";
  }

  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
};

const getRemoteVideoStatusMessage = (status: keyof typeof statusLabelMap) => {
  switch (status) {
    case "incoming":
      return "Cuộc gọi video đến. Sẵn sàng để trả lời.";
    case "acquiring-media":
      return "Đang mở microphone và camera...";
    case "outgoing-ringing":
      return "Đang gọi video. Chờ đối phương trả lời...";
    case "negotiating":
      return "Đang thiết lập kết nối video...";
    case "connected":
      return "Đối phương đang tắt camera hoặc video chưa sẵn sàng.";
    case "reconnecting":
      return "Kết nối video bị gián đoạn. Đang thử kết nối lại...";
    default:
      return "Cuộc gọi video sẵn sàng.";
  }
};

const getAudioStatusMessage = (status: keyof typeof statusLabelMap) => {
  switch (status) {
    case "incoming":
      return "Cuộc gọi thoại đến. Sẵn sàng để trả lời.";
    case "acquiring-media":
      return "Đang mở microphone...";
    case "outgoing-ringing":
      return "Đang gọi thoại. Chờ đối phương trả lời...";
    case "negotiating":
      return "Đang kết nối âm thanh...";
    case "connected":
      return "Microphone đã được kết nối.";
    case "reconnecting":
      return "Kết nối âm thanh bị gián đoạn. Đang thử kết nối lại...";
    default:
      return "Cuộc gọi sẵn sàng.";
  }
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

const RemoteVideoTile = ({
  displayName,
  stream,
  isCameraEnabled,
  className,
}: {
  displayName: string;
  stream: MediaStream | null;
  isCameraEnabled: boolean;
  className?: string;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const isVideoVisible = isCameraEnabled && hasActiveVideoTrack(stream);

  useEffect(() => {
    attachStream(videoRef.current, stream);

    if (!stream || !isVideoVisible) {
      setIsPortrait(false);
    }
  }, [stream, isVideoVisible]);

  const syncAspectRatio = () => {
    const videoElement = videoRef.current;

    if (!videoElement?.videoWidth || !videoElement.videoHeight) {
      return;
    }

    setIsPortrait(videoElement.videoHeight > videoElement.videoWidth);
  };

  return (
    <div className={`relative min-h-[220px] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 ${className ?? ""}`}>
      {isVideoVisible ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            onLoadedMetadata={syncAspectRatio}
            onResize={syncAspectRatio}
            className={`absolute inset-0 h-full w-full ${isPortrait ? "object-contain" : "object-cover"}`}
          />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.22),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_40%)] px-6 text-center">
          <div className="flex size-24 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold uppercase text-white">
            {getInitial(displayName)}
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-white">{displayName}</h3>
            <p className="mt-2 text-sm text-slate-300">
              {isCameraEnabled ? "Đang chờ video từ thành viên này..." : "Thành viên này đang tắt camera."}
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-10 text-sm font-medium text-white">
        {displayName}
      </div>
    </div>
  );
};

const ControlButton = ({
  isActive,
  activeIcon,
  inactiveIcon,
  activeLabel,
  inactiveLabel,
  onClick,
}: {
  isActive: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeLabel: string;
  inactiveLabel: string;
  onClick: () => void;
}) => (
  <Button
    variant="ghost"
    className="h-auto min-w-20 rounded-2xl border border-white/10 bg-slate-900/85 px-4 py-3 text-white shadow-lg shadow-black/20 backdrop-blur hover:bg-slate-800/95"
    onClick={onClick}
  >
    <span className="flex flex-col items-center gap-2">
      <span
        className={`flex size-11 items-center justify-center rounded-full ${
          isActive ? "bg-white/10 text-white" : "bg-rose-500/20 text-rose-200"
        }`}
      >
        {isActive ? activeIcon : inactiveIcon}
      </span>
      <span className="text-xs font-medium text-slate-100">{isActive ? activeLabel : inactiveLabel}</span>
    </span>
  </Button>
);

const CallControls = ({
  canAnswer,
  currentCall,
  isCameraEnabled,
  isMicrophoneEnabled,
  acceptIncomingCall,
  declineIncomingCall,
  endCall,
  toggleCamera,
  toggleMicrophone,
}: {
  canAnswer: boolean;
  currentCall: CallSession;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: (reason?: string) => void;
  endCall: (reason?: string) => void;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-white/10 bg-slate-950/78 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
    <ControlButton
      isActive={isMicrophoneEnabled}
      activeIcon={<Mic className="size-5" />}
      inactiveIcon={<MicOff className="size-5" />}
      activeLabel="Tắt mic"
      inactiveLabel="Mở mic"
      onClick={toggleMicrophone}
    />

    {currentCall.callType === "video" && (
      <ControlButton
        isActive={isCameraEnabled}
        activeIcon={<Video className="size-5" />}
        inactiveIcon={<VideoOff className="size-5" />}
        activeLabel="Tắt video"
        inactiveLabel="Mở video"
        onClick={toggleCamera}
      />
    )}

    {canAnswer && (
      <Button
        className="h-auto min-w-20 rounded-2xl bg-emerald-500 px-4 py-3 text-white hover:bg-emerald-400"
        onClick={() => void acceptIncomingCall()}
      >
        <span className="flex flex-col items-center gap-2">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/15">
            <Phone className="size-5" />
          </span>
          <span className="text-xs font-medium">Nhận</span>
        </span>
      </Button>
    )}

    <Button
      className="h-auto min-w-20 rounded-2xl bg-rose-500 px-4 py-3 text-white hover:bg-rose-400"
      onClick={() => {
        if (canAnswer) {
          declineIncomingCall("declined");
          return;
        }

        endCall(getHangupReason(currentCall));
      }}
    >
      <span className="flex flex-col items-center gap-2">
        <span className="flex size-11 items-center justify-center rounded-full bg-white/15">
          <PhoneOff className="size-5" />
        </span>
        <span className="text-xs font-medium">Kết thúc</span>
      </span>
    </Button>
  </div>
);

const CallOverlay = () => {
  const {
    currentCall,
    localStream,
    remoteStream,
    remoteStreams,
    remoteCameraStates,
    isCameraEnabled,
    isMicrophoneEnabled,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleCamera,
    toggleMicrophone,
  } = useCallStore();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const conversations = useChatStore((state) => state.conversations);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  const conversation = useMemo(
    () => conversations.find((item) => item._id === currentCall?.conversationId),
    [conversations, currentCall?.conversationId]
  );

  useEffect(() => {
    const ringtoneElement = ringtoneAudioRef.current;

    if (!ringtoneElement) {
      return;
    }

    ringtoneElement.defaultPlaybackRate = RINGTONE_PLAYBACK_RATE;
    ringtoneElement.playbackRate = RINGTONE_PLAYBACK_RATE;

    const shouldPlayRingtone =
      currentCall?.status === "incoming" || currentCall?.status === "outgoing-ringing";

    if (!shouldPlayRingtone) {
      ringtoneElement.pause();
      ringtoneElement.currentTime = 0;
      return;
    }

    ringtoneElement.currentTime = 0;
    void ringtoneElement.play().catch(() => {
      // Ignore autoplay rejections until the next explicit user interaction.
    });

    return () => {
      ringtoneElement.pause();
      ringtoneElement.currentTime = 0;
    };
  }, [currentCall?.callId, currentCall?.status]);

  useEffect(() => {
    attachStream(remoteAudioRef.current, currentCall?.callType === "audio" ? remoteStream : null);
  }, [currentCall?.callType, remoteStream]);

  useEffect(() => {
    attachStream(localVideoRef.current, localStream);
  }, [localStream, isCameraEnabled, currentCall?.callId]);

  if (!currentCall) {
    return null;
  }

  const isVideoCall = currentCall.callType === "video";
  const canAnswer = currentCall.status === "incoming";
  const showVideoLayout = isVideoCall;
  const showLocalPreview = isVideoCall;
  const isLocalVideoVisible = hasActiveVideoTrack(localStream);
  const directRemoteCameraEnabled = remoteCameraStates[currentCall.peer._id] ?? true;
  const isDirectRemoteUnavailable = currentCall.status === "reconnecting" || !directRemoteCameraEnabled;
  const isRemoteVideoVisible = !isDirectRemoteUnavailable && hasActiveVideoTrack(remoteStream);
  const remoteVideoEntries = currentCall.isGroup
    ? currentCall.participantIds
        .filter((participantId) => participantId !== currentUserId)
        .map((participantId) => {
          const participant = conversation?.participants.find((item) => item._id === participantId);

          return {
            participantId,
            displayName: participant?.displayName || getParticipantFallbackName(participantId),
            stream: remoteStreams[participantId] ?? null,
            isCameraEnabled: remoteCameraStates[participantId] ?? true,
          };
        })
    : [
        {
          participantId: currentCall.peer._id,
          displayName: currentCall.peer.displayName,
          stream: remoteStream,
          isCameraEnabled: directRemoteCameraEnabled,
        },
      ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <audio ref={ringtoneAudioRef} src="/universfield-ringtone-035-480585.mp3" preload="auto" loop />
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-slate-50 shadow-2xl md:h-[92vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_45%)]" />

        <div className="relative z-20 flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{statusLabelMap[currentCall.status]}</p>
            <h2 className="mt-2 text-2xl font-semibold">{currentCall.peer.displayName}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {currentCall.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"}
            </p>
            {currentCall.isGroup && (
              <p className="mt-1 text-sm text-slate-400">
                {Object.keys(remoteStreams).length} thành viên đang kết nối
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/8 text-white hover:bg-white/16"
            onClick={() => endCall(getHangupReason(currentCall))}
          >
            <PhoneOff className="size-5" />
          </Button>
        </div>

        <div className={`relative z-10 flex flex-1 flex-col ${currentCall.isGroup ? "p-5" : "p-3 md:p-4"}`}>
          {showVideoLayout ? (
            <div
              className={`relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 ${
                isControlsCollapsed ? "pb-16 md:pb-20" : "pb-28 md:pb-32"
              }`}
            >
              {currentCall.isGroup ? (
                <div className={`grid h-full gap-4 p-4 ${getVideoGridClassName(remoteVideoEntries.length)}`}>
                  {remoteVideoEntries.map((entry) => (
                    <RemoteVideoTile
                      key={entry.participantId}
                      displayName={entry.displayName}
                      stream={entry.stream}
                      isCameraEnabled={entry.isCameraEnabled}
                    />
                  ))}
                </div>
              ) : isRemoteVideoVisible ? (
                <div className="h-full p-2 md:p-3">
                  <RemoteVideoTile
                    displayName={currentCall.peer.displayName}
                    stream={remoteStream}
                    isCameraEnabled={directRemoteCameraEnabled}
                    className="h-full min-h-0 rounded-[2rem]"
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.22),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_40%)] px-6 text-center">
                  <div className="flex size-28 items-center justify-center rounded-full bg-white/10 text-4xl font-semibold uppercase text-white">
                    {getInitial(currentCall.peer.displayName)}
                  </div>
                  <div>
                    <h3 className="text-3xl font-semibold">{currentCall.peer.displayName}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      {directRemoteCameraEnabled
                        ? getRemoteVideoStatusMessage(currentCall.status)
                        : "Đối phương đang tắt camera."}
                    </p>
                  </div>
                </div>
              )}

              {showLocalPreview && (
                <div className="absolute right-4 top-4 z-20 h-36 w-24 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/35 md:h-48 md:w-32">
                  {isLocalVideoVisible ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-900 px-3 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-lg font-semibold uppercase text-white">
                        {getInitial("Ban")}
                      </div>
                      <p className="text-xs font-medium text-slate-200">
                        {isCameraEnabled ? "Đang chuẩn bị camera" : "Camera đang tắt"}
                      </p>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-3 py-2">
                    <p className="text-xs font-medium text-white">Bạn</p>
                  </div>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mb-3 size-10 rounded-full border border-white/10 bg-slate-950/78 text-white shadow-xl shadow-black/30 backdrop-blur hover:bg-slate-900/90"
                  onClick={() => setIsControlsCollapsed((value) => !value)}
                >
                  {isControlsCollapsed ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
                </Button>

                {!isControlsCollapsed && (
                  <CallControls
                    canAnswer={canAnswer}
                    currentCall={currentCall}
                    isCameraEnabled={isCameraEnabled}
                    isMicrophoneEnabled={isMicrophoneEnabled}
                    acceptIncomingCall={acceptIncomingCall}
                    declineIncomingCall={declineIncomingCall}
                    endCall={endCall}
                    toggleCamera={toggleCamera}
                    toggleMicrophone={toggleMicrophone}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-white/10 bg-white/5 px-6 text-center">
              <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-4xl font-semibold uppercase">
                {getInitial(currentCall.peer.displayName)}
              </div>
              <div>
                <h3 className="text-3xl font-semibold">{currentCall.peer.displayName}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {getAudioStatusMessage(currentCall.status)}
                </p>
              </div>

              <div className="pt-4">
                <CallControls
                  canAnswer={canAnswer}
                  currentCall={currentCall}
                  isCameraEnabled={isCameraEnabled}
                  isMicrophoneEnabled={isMicrophoneEnabled}
                  acceptIncomingCall={acceptIncomingCall}
                  declineIncomingCall={declineIncomingCall}
                  endCall={endCall}
                  toggleCamera={toggleCamera}
                  toggleMicrophone={toggleMicrophone}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
