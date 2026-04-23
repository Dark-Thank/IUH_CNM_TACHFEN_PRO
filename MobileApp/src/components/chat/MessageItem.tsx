import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Pin, Video } from "lucide-react-native";
import { useState } from "react";
import {
    Alert,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import UserAvatar from "./UserAvatar";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

const isVoiceMessage = (message: Message) => {
  if (message.messageType === "voice") {
    return true;
  }

  const audioFiles = (message.fileUrls || []).filter((file) => file.type?.startsWith("audio/"));
  return audioFiles.length === 1 && (message.imgUrls?.length ?? 0) === 0;
};

const getVoiceAttachment = (message: Message) =>
  message.fileUrls?.find((file) => file.type?.startsWith("audio/")) ?? null;

const getCallTypeLabel = (callType?: "audio" | "video") =>
  callType === "video" ? "Cuoc goi video" : "Cuoc goi thoai";

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((value) => value.toString().padStart(2, "0")).join(":");
  }

  return [minutes, remainingSeconds].map((value) => value.toString().padStart(2, "0")).join(":");
};

const getCallSummaryTitle = (message: Message, viewerId?: string) => {
  const callMeta = message.callMeta;

  if (!callMeta) {
    return message.content ?? "Cuoc goi";
  }

  const typeLabel = getCallTypeLabel(callMeta.callType);
  const isCaller = callMeta.callerId === viewerId;

  switch (callMeta.outcome) {
    case "busy":
      return isCaller ? "Nguoi nhan dang ban" : "Ban dang ban";
    case "declined":
      return isCaller ? `${typeLabel} bi tu choi` : `Da tu choi ${typeLabel.toLowerCase()}`;
    case "missed":
      return isCaller ? `${typeLabel} khong duoc tra loi` : `${typeLabel} nho`;
    case "cancelled":
      return `${typeLabel} da huy`;
    case "disconnected":
      return `${typeLabel} bi gian doan`;
    case "reconnect-timeout":
      return `${typeLabel} mat ket noi`;
    case "completed":
      return isCaller ? `${typeLabel} di` : `${typeLabel} den`;
    default:
      return typeLabel;
  }
};

const getCallDetailText = (message: Message) => {
  const callMeta = message.callMeta;

  if (!callMeta) {
    return message.content ?? "";
  }

  const baseLabel = getCallTypeLabel(callMeta.callType);

  if (callMeta.outcome === "completed") {
    return `${baseLabel} • ${formatCallDuration(callMeta.durationSeconds)}`;
  }

  return baseLabel;
};

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  previousMessage?: Message;
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
}

export default function MessageItem({
  message,
  index,
  messages,
  previousMessage,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) {
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const { recallMessage, togglePinMessage } = useChatStore();
  const currentCall = useCallStore((state) => state.currentCall);
  const startOutgoingCall = useCallStore((state) => state.startOutgoingCall);
  const currentUserId = user?._id;

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);

  const previous = previousMessage ?? messages[index - 1];
  const previousCreatedAt = previous?.createdAt
    ? new Date(previous.createdAt).getTime()
    : 0;
  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isOwn = !!message.isOwn || message.senderId === currentUserId;
  const isShowTime = !previous || currentCreatedAt - previousCreatedAt > 300000;
  const isGroupBreak = isShowTime || message.senderId !== previous?.senderId;

  const participant = selectedConvo.participants.find(
    (item: Participant) => item._id === message.senderId
  );
  const isCallMessage = message.messageType === "call" && Boolean(message.callMeta);

  const canTogglePin = !message.isRecalled;
  const canRecall =
    isOwn &&
    !message.isRecalled &&
    currentCreatedAt > Date.now() - 2 * 60 * 1000;

  const closeActions = () => setShowActions(false);

  const handleLongPress = () => {
    if (!canTogglePin && !canRecall) {
      return;
    }

    setShowActions(true);
  };

  const handleTogglePin = () => {
    closeActions();
    void togglePinMessage(message._id);
  };

  const handleRecall = () => {
    closeActions();
    Alert.alert(
      "Thu hoi",
      "Tin nhan se bi thu hoi cho tat ca thanh vien. Tiep tuc?",
      [
        { text: "Huy", style: "cancel" },
        {
          text: "Thu hoi",
          style: "destructive",
          onPress: () => {
            void recallMessage(message._id);
          },
        },
      ]
    );
  };

  const handleOpenFile = async (
    fileIndex: number,
    fileName: string,
    mimeType?: string
  ) => {
    try {
      await chatService.downloadMessageFile(
        message._id,
        fileIndex,
        fileName,
        mimeType
      );
    } catch (error) {
      console.error("Loi khi tai file:", error);
      Alert.alert("Tai file that bai", "Khong the tai tep dinh kem nay.");
    }
  };

  const handleRecallCall = () => {
    if (selectedConvo.type !== "direct" || !message.callMeta || currentCall) {
      return;
    }

    void startOutgoingCall(selectedConvo, message.callMeta.callType);
  };

  const renderCallIcon = () => {
    const callMeta = message.callMeta;

    if (!callMeta) {
      return <Phone size={18} color={isDark ? "#cbd5e1" : "#475569"} />;
    }

    const isCaller = callMeta.callerId === currentUserId;

    if (callMeta.outcome === "busy") {
      return <PhoneOff size={18} color="#f59e0b" />;
    }

    if (callMeta.outcome === "missed") {
      return <PhoneMissed size={18} color="#ef4444" />;
    }

    if (callMeta.callType === "video") {
      return <Video size={18} color="#0ea5e9" />;
    }

    if (callMeta.outcome === "completed") {
      return isCaller
        ? <PhoneOutgoing size={18} color="#10b981" />
        : <PhoneIncoming size={18} color="#10b981" />;
    }

    return <Phone size={18} color={isDark ? "#cbd5e1" : "#475569"} />;
  };

  const renderContent = () => {
    if (message.isRecalled) {
      return (
        <View style={styles.recalledBubble}>
          <Text
            style={[
              styles.recalledText,
              { color: isDark ? "#94a3b8" : "#64748b" },
            ]}
          >
            Tin nhan da thu hoi
          </Text>
        </View>
      );
    }

    if (isCallMessage && message.callMeta) {
      const canRecallCall = selectedConvo.type === "direct";

      return (
        <View style={styles.callCard}>
          <View
            style={[
              styles.callIconWrap,
              { backgroundColor: isDark ? "#0f172a" : "#eef2ff" },
            ]}
          >
            {renderCallIcon()}
          </View>

          <View style={styles.callContentWrap}>
            <Text style={[styles.callTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              {getCallSummaryTitle(message, currentUserId)}
            </Text>
            <Text style={[styles.callDetail, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {getCallDetailText(message)}
            </Text>
          </View>

          {canRecallCall ? (
            <Pressable
              onPress={handleRecallCall}
              disabled={Boolean(currentCall)}
              style={[
                styles.callActionButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#ede9fe",
                  opacity: currentCall ? 0.5 : 1,
                },
              ]}
            >
              {message.callMeta.callType === "video" ? (
                <Video size={15} color={isDark ? "#ddd6fe" : "#6d28d9"} />
              ) : (
                <Phone size={15} color={isDark ? "#ddd6fe" : "#6d28d9"} />
              )}
              <Text style={[styles.callActionLabel, { color: isDark ? "#ddd6fe" : "#6d28d9" }]}>
                Goi lai
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    const voiceAttachment = getVoiceAttachment(message);
    const isVoice = isVoiceMessage(message);
    const otherFiles = (message.fileUrls || []).filter((file) => file.url !== voiceAttachment?.url);

    return (
      <View>
        {isVoice && voiceAttachment ? (
          <View style={styles.voiceBlock}>
            <VoiceMessagePlayer
              uri={voiceAttachment.url}
              durationSeconds={message.voiceMeta?.durationSeconds}
              isOwn={isOwn}
            />

            {message.content ? (
              <Text
                style={[
                  styles.voiceCaption,
                  { color: isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
                ]}
              >
                {message.content}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isVoice && message.content ? (
          <Text
            style={[
              styles.messageText,
              { color: isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
            ]}
          >
            {message.content}
          </Text>
        ) : null}

        {message.imgUrls?.map((url, idx) => (
          <Pressable
            key={idx}
            onPress={() => setPreviewImage(url)}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </Pressable>
        ))}

        {otherFiles.map((file) => {
          const fileIndex = message.fileUrls?.findIndex((item) => item.url === file.url) ?? -1;

          if (fileIndex < 0) {
            return null;
          }

          return (
          <Pressable
            key={file.url}
            style={styles.fileBox}
            onPress={() => void handleOpenFile(fileIndex, file.name, file.type)}
          >
            <Text style={{ color: isDark ? "#cbd5e1" : "#0f172a" }}>
              File: {file.name}
            </Text>
          </Pressable>
          );
        })}
      </View>
    );
  };

  const renderPinIcon = () => {
    if (!message.isPinned || message.isRecalled) {
      return null;
    }

    return (
      <View style={styles.pinIconContainer}>
        <Pin
          size={12}
          color={isOwn ? "#ffffff80" : isDark ? "#94a3b8" : "#64748b"}
        />
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {isShowTime ? (
        <Text
          style={[styles.timeText, { color: isDark ? "#94a3b8" : "#64748b" }]}
        >
          {formatMessageTime(new Date(message.createdAt))}
        </Text>
      ) : null}

      <View
        style={[
          styles.row,
          { justifyContent: isOwn ? "flex-end" : "flex-start" },
        ]}
      >
        {!isOwn ? (
          <View style={styles.avatarSlot}>
            {isGroupBreak ? (
              <UserAvatar
                name={participant?.displayName ?? "User"}
                avatarUrl={participant?.avatarUrl}
                size={30}
              />
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.messageColumn,
            { alignItems: isOwn ? "flex-end" : "flex-start" },
          ]}
        >
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={260}
            style={[
              styles.bubble,
              isCallMessage
                ? {
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    borderWidth: 1,
                  }
                : isOwn
                ? { backgroundColor: isDark ? "#a855f7" : "#8b5cf6" }
                : {
                  backgroundColor: isDark ? "#1f2937" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  borderWidth: 1,
                },
            ]}
          >
            {renderContent()}
            {renderPinIcon()}
          </Pressable>

          {isOwn && message._id === selectedConvo.lastMessage?._id ? (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    lastMessageStatus === "seen"
                      ? isDark
                        ? "#312e81"
                        : "#ede9fe"
                      : isDark
                        ? "#1f2937"
                        : "#e2e8f0",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 10,
                  color:
                    lastMessageStatus === "seen"
                      ? isDark
                        ? "#c4b5fd"
                        : "#6d28d9"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b",
                }}
              >
                {lastMessageStatus === "seen" ? "Da xem" : "Da gui"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <Pressable style={styles.modal} onPress={() => setPreviewImage(null)}>
          <Image
            source={{ uri: previewImage ?? "" }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={closeActions}
      >
        <View style={styles.actionRoot}>
          <Pressable style={styles.actionBackdrop} onPress={closeActions} />

          <View
            style={[
              styles.actionSheet,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text
              style={[
                styles.actionTitle,
                { color: isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              Tuy chon tin nhan
            </Text>

            {canTogglePin ? (
              <Pressable
                onPress={handleTogglePin}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    { color: isDark ? "#f8fafc" : "#0f172a" },
                  ]}
                >
                  {message.isPinned ? "Bo ghim" : "Ghim tin nhan"}
                </Text>
              </Pressable>
            ) : null}

            {canRecall ? (
              <Pressable
                onPress={handleRecall}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark ? "#2b1216" : "#fef2f2",
                    borderColor: isDark ? "#7f1d1d" : "#fecaca",
                  },
                ]}
              >
                <Text
                  style={[styles.actionButtonText, styles.actionDangerText]}
                >
                  Thu hoi
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={closeActions}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                },
              ]}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isDark ? "#cbd5e1" : "#475569" },
                ]}
              >
                Dong
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  timeText: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatarSlot: { width: 34, alignItems: "center" },
  messageColumn: { maxWidth: "78%" },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  recalledBubble: { minWidth: 120 },
  recalledText: { fontSize: 14, fontStyle: "italic" },
  imageContainer: { marginTop: 4 },
  messageImage: { width: 200, height: 200, borderRadius: 12 },
  voiceBlock: { gap: 8 },
  voiceCaption: { fontSize: 14, lineHeight: 20 },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 240,
  },
  callIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  callContentWrap: {
    flex: 1,
    gap: 3,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  callDetail: {
    fontSize: 12,
    fontWeight: "600",
  },
  callActionButton: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  callActionLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  pinIconContainer: { position: "absolute", top: 4, right: 4 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  fileBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#00000010",
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: "100%", height: "100%" },
  actionRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  actionSheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 10,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 2,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionDangerText: {
    color: "#ef4444",
  },
});
