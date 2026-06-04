import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant, ReactionUser } from "@/types/chat";
import { Check, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Pin, UserPlus, Video, X } from "lucide-react-native";
import { memo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,

} from "react-native";
import AppointmentMessageCard from "./AppointmentMessageCard";
import PollMessageCard from "./PollMessageCard";
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

const getReplyPreviewContent = (replyTo?: Message["replyTo"]) => {
  const trimmedContent = typeof replyTo?.content === "string" ? replyTo.content.trim() : "";

  if (trimmedContent) {
    return trimmedContent;
  }

  if (replyTo?.messageType === "voice") {
    return "Tin nhắn thoại";
  }

  if (replyTo?.messageType === "call") {
    return "Cuộc gọi";
  }

  if ((replyTo?.imgUrls?.length ?? 0) > 0) {
    return replyTo?.imgUrls?.length === 1 ? "Ảnh đính kèm" : `${replyTo?.imgUrls?.length} ảnh đính kèm`;
  }

  if ((replyTo?.fileUrls?.length ?? 0) > 0) {
    return replyTo?.fileUrls?.length === 1 ? "Tệp đính kèm" : `${replyTo?.fileUrls?.length} tệp đính kèm`;
  }

  return "Tin nhắn";
};

const getCallTypeLabel = (callType?: "audio" | "video") =>
  callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";

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
    return message.content ?? "Cuộc gọi";
  }

  const typeLabel = getCallTypeLabel(callMeta.callType);
  const isCaller = callMeta.callerId === viewerId;

  switch (callMeta.outcome) {
    case "busy":
      return isCaller ? "Người nhận đang bận" : "Bạn đang bận";
    case "declined":
      return isCaller ? `${typeLabel} bị từ chối` : `Đã từ chối ${typeLabel.toLowerCase()}`;
    case "missed":
      return isCaller ? `${typeLabel} không được trả lời` : `${typeLabel} nhỡ`;
    case "cancelled":
      return `${typeLabel} đã hủy`;
    case "disconnected":
      return `${typeLabel} bị gián đoạn`;
    case "reconnect-timeout":
      return `${typeLabel} mất kết nối`;
    case "completed":
      return isCaller ? `${typeLabel} đi` : `${typeLabel} đến`;
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
  previousMessage?: Message;
  selectedConvo: Conversation;
  isSearchFocused?: boolean;
  translation?: string;
  isTranslating?: boolean;
  onTranslateMessage?: (message: Message) => void;
}

const MESSAGE_RECEIPT_LABELS = {
  sent: "Đã gửi",
  delivered: "Đã nhận",
  seen: "Đã xem",
} as const;

type MessageReceiptStatus = keyof typeof MESSAGE_RECEIPT_LABELS;

const getReceiptTone = (status: MessageReceiptStatus, isDark: boolean) => {
  if (status === "seen") {
    return {
      backgroundColor: isDark ? "#312e81" : "#ede9fe",
      textColor: isDark ? "#c4b5fd" : "#6d28d9",
    };
  }

  if (status === "delivered") {
    return {
      backgroundColor: isDark ? "#0f3b4c" : "#e0f2fe",
      textColor: isDark ? "#67e8f9" : "#0369a1",
    };
  }

  return {
    backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
    textColor: isDark ? "#94a3b8" : "#64748b",
  };
};

const getReactionUsersLabel = (users: ReactionUser[], currentUserId?: string) => {
  if (users.length === 0) {
    return "Chưa có ai thả cảm xúc này.";
  }

  return users
    .map((item) => (item._id === currentUserId ? "Bạn" : item.displayName || "Thành viên"))
    .join(", ");
};

const GROUP_NOTICE_PATTERN = /(đã tạo nhóm|đã thêm .+ vào nhóm|đã xóa .+ khỏi nhóm|đã rời nhóm|đã tham gia nhóm|đã duyệt .+ tham gia nhóm)/i;

const isGroupNoticeMessage = (message: Message, conversation: Conversation) => (
  conversation.type === "group"
  && message.messageType === "text"
  && typeof message.content === "string"
  && GROUP_NOTICE_PATTERN.test(message.content.trim())
  && !message.replyTo
  && !message.forwardedFrom
  && (message.imgUrls?.length ?? 0) === 0
  && (message.fileUrls?.length ?? 0) === 0
);

const getSenderId = (message: Message) => {
  const sender = message.senderId as unknown;

  if (typeof sender === "string") {
    return sender;
  }

  if (sender && typeof sender === "object" && "_id" in sender) {
    return String((sender as { _id?: string })._id ?? "");
  }

  return "";
};

function MessageItem({
  message,
  previousMessage,
  selectedConvo,
  isSearchFocused = false,
  translation,
  isTranslating = false,
  onTranslateMessage,
}: MessageItemProps) {
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const {
    conversations,
    forwardMessage,
    recallMessage,
    togglePinMessage,
    deleteMessageForMe,
    voteOnGroupPoll,
    addOptionToGroupPoll,
    closeGroupPoll,
    respondToGroupAppointment,
    deleteGroupAppointment,
    setReplyingMessage,
    updateMessage,
    upsertConversation,
  } = useChatStore();
  const currentCall = useCallStore((state) => state.currentCall);
  const startOutgoingCall = useCallStore((state) => state.startOutgoingCall);
  const currentUserId = user?._id;


  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [reactionDetailEmoji, setReactionDetailEmoji] = useState<string | null>(null);
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);
  const [groupInviteAction, setGroupInviteAction] = useState<"accept" | "decline" | null>(null);
  const previous = previousMessage;
  const previousCreatedAt = previous?.createdAt
    ? new Date(previous.createdAt).getTime()
    : 0;
  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isOwn = !!message.isOwn || getSenderId(message) === currentUserId;
  const isLastOwnMessage = isOwn && message._id === selectedConvo.lastMessage?._id;
  const isShowTime = !previous || currentCreatedAt - previousCreatedAt > 300000;
  const isGroupBreak = isShowTime || message.senderId !== previous?.senderId;

  const participant = selectedConvo.participants.find(
    (item: Participant) => item._id === message.senderId
  );
  const isCallMessage = message.messageType === "call" && Boolean(message.callMeta);

  const isDeletedForMe = message.deletedForUsers?.includes(currentUserId || "");
  const isPollMessage = message.messageType === "poll" && Boolean(message.pollMeta);
  const isAppointmentMessage = message.messageType === "appointment" && Boolean(message.appointmentMeta);
  const isGroupInviteMessage = message.messageType === "group_invite" && Boolean(message.groupInviteMeta);
  const isStructuredMessage = isPollMessage || isAppointmentMessage || isGroupInviteMessage;
  const useOwnAccentBubble = isOwn && !isStructuredMessage;
  const canTogglePin = !message.isRecalled && !isDeletedForMe;
  const canReply = !message.isRecalled && !isDeletedForMe;
  const canForward = !message.isRecalled && !isDeletedForMe && !isStructuredMessage && Boolean(
    message.content || message.imgUrls?.length || message.fileUrls?.length
  );
  const canTranslate = !isOwn &&
    !message.isRecalled &&
    !isDeletedForMe &&
    typeof message.content === "string" &&
    Boolean(message.content.trim());
  const canRecall =
    isOwn &&
    !message.isRecalled &&
    !isDeletedForMe &&
    currentCreatedAt > Date.now() - 2 * 60 * 1000;
  const availableConversations = conversations.filter(
    (conversation) => conversation._id !== message.conversationId
  );
  const canDeleteForMe = !message.isRecalled && !isDeletedForMe;
  const voiceAttachment = getVoiceAttachment(message);
  const isVoice = isVoiceMessage(message);
  const otherFiles = (message.fileUrls || []).filter((file) => file.url !== voiceAttachment?.url);
  const replySenderName = message.replyTo
    ? (message.replyTo.senderId === currentUserId
      ? "Bạn"
      : selectedConvo.participants.find((item) => item._id === message.replyTo?.senderId)?.displayName || "Thành viên")
    : "";
  const receiptTargets = selectedConvo.participants.filter((item) => item._id !== message.senderId);
  const deliveredSet = new Set((message.deliveredTo || []).map((item) => item.toString()));
  const seenSet = new Set((message.seenBy || []).map((item) => item.toString()));
  const seenParticipants = receiptTargets.filter((item) => seenSet.has(item._id));
  const deliveredOnlyParticipants = receiptTargets.filter(
    (item) => deliveredSet.has(item._id) && !seenSet.has(item._id)
  );
  const pendingParticipants = receiptTargets.filter((item) => !deliveredSet.has(item._id));
  const receiptStatus: MessageReceiptStatus = seenParticipants.length > 0
    ? "seen"
    : deliveredSet.size > 0
      ? "delivered"
      : "sent";
  const receiptProgress = receiptTargets.length > 1
    ? `${receiptStatus === "seen" ? seenParticipants.length : deliveredSet.size}/${receiptTargets.length}`
    : "";
  const receiptSummary = receiptProgress
    ? `${MESSAGE_RECEIPT_LABELS[receiptStatus]} ${receiptProgress}`
    : MESSAGE_RECEIPT_LABELS[receiptStatus];
  const canViewReceiptDetails = isOwn && selectedConvo.type === "group";
  const reactionEntries = Object.entries(message.reactions || {}).filter(([, users]) => users.length > 0);
  const activeReactionUsers = reactionDetailEmoji ? message.reactions?.[reactionDetailEmoji] || [] : [];
  const showTimeSeparator = isShowTime && !isLastOwnMessage;
  const receiptTone = getReceiptTone(receiptStatus, isDark);
  const isGroupNotice = isGroupNoticeMessage(message, selectedConvo);

  const closeActions = () => setShowActions(false);

  const getConversationLabel = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.group?.name || "Nhóm chat";
    }

    return (
      conversation.participants.find((participant) => participant._id !== currentUserId)
        ?.displayName || "Trò chuyện trực tiếp"
    );
  };

  const handleLongPress = () => {
    setShowActions(true);
  };
  const handleReply = () => {
    closeActions();
    setReplyingMessage(message);
  };
  const handleReact = async (emoji: string) => {
    try {
      const res = await chatService.reactMessage(message._id, emoji);
      updateMessage(res);
    } catch (err) {
      console.error("React lỗi:", err);
    } finally {
      setShowActions(false);
    }
  };
  const handleReactionPress = (emoji: string) => {
    if (selectedConvo.type === "group") {
      setReactionDetailEmoji(emoji);
      return;
    }

    void handleReact(emoji);
  };

  const handleVotePoll = async (optionId: string) => {
    await voteOnGroupPoll(message._id, optionId);
  };
  const handleAddPollOption = async (text: string) => {
    await addOptionToGroupPoll(message._id, text);
  };
  const handleClosePoll = async () => {
    await closeGroupPoll(message._id);
  };
  const handleAppointmentResponse = async (status: "going" | "maybe" | "declined") => {
    await respondToGroupAppointment(message._id, status);
  };
  const handleDeleteAppointment = async () => {
    await deleteGroupAppointment(message._id);
  };
  const handleGroupInviteResponse = async (action: "accept" | "decline") => {
    if (groupInviteAction) {
      return;
    }

    try {
      setGroupInviteAction(action);
      const data = await chatService.respondToGroupInvitation(message._id, action);

      if (data?.inviteMessage) {
        updateMessage(data.inviteMessage);
      }

      if (data?.conversation) {
        upsertConversation(data.conversation);
      }

      if (data?.pendingApproval) {
        Alert.alert("Yeu cau dang cho duyet", data?.message || "Yeu cau tham gia nhom da duoc gui den truong/phó nhom.");
        return;
      }

      Alert.alert(
        action === "accept" ? "Da tham gia nhom" : "Da tu choi loi moi",
        data?.message || (action === "accept" ? "Ban da chap nhan loi moi tham gia nhom." : "Ban da tu choi loi moi tham gia nhom.")
      );
    } catch (error: any) {
      Alert.alert("Khong the xu ly loi moi", error?.response?.data?.message || "Vui long thu lai sau.");
    } finally {
      setGroupInviteAction(null);
    }
  };
  const handleTogglePin = () => {
    closeActions();
    void togglePinMessage(message._id);
  };

  const handleRecall = () => {
    closeActions();
    Alert.alert(
      "Thu hồi",
      "Tin nhắn sẽ bị thu hồi cho tất cả thành viên. Tiếp tục?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Thu hồi",
          style: "destructive",
          onPress: () => {
            void recallMessage(message._id);
          },
        },
      ]
    );
  };

  const handleOpenForwardPicker = () => {
    closeActions();
    setShowForwardPicker(true);
  };

  const handleForwardMessage = async (conversationId: string) => {
    try {
      setForwardingConversationId(conversationId);
      await forwardMessage(conversationId, message._id);
      setShowForwardPicker(false);
    } catch (error) {
      console.error("Lỗi khi chuyển tiếp tin nhắn:", error);
      Alert.alert("Chuyển tiếp thất bại", "Không thể chuyển tiếp tin nhắn này.");
    } finally {
      setForwardingConversationId(null);
    }
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
      console.error("Lỗi khi tải tệp:", error);
      Alert.alert("Tải tệp thất bại", "Không thể tải tệp đính kèm này.");
    }
  };

  const handleShowReceiptDetails = () => {
    setShowReceiptModal(true);
  };

  const renderReceiptSection = (
    title: string,
    participants: Participant[],
    emptyText: string
  ) => (
    <View style={styles.receiptSection}>
      <Text style={[styles.receiptSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
        {title}
      </Text>

      {participants.length === 0 ? (
        <Text style={[styles.receiptEmptyText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          {emptyText}
        </Text>
      ) : (
        participants.map((item) => (
          <View
            key={item._id}
            style={[
              styles.receiptUserRow,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
              },
            ]}
          >
            <UserAvatar
              name={item.displayName}
              avatarUrl={item.avatarUrl}
              size={32}
            />
            <Text style={[styles.receiptUserName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              {item.displayName}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  const renderReactionSection = (
    title: string,
    users: ReactionUser[]
  ) => (
    <View style={styles.receiptSection}>
      <Text style={[styles.receiptSectionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
        {title}
      </Text>

      {users.length === 0 ? (
        <Text style={[styles.receiptEmptyText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          Chưa có ai thả cảm xúc này.
        </Text>
      ) : (
        users.map((item) => (
          <View
            key={item._id}
            style={[
              styles.receiptUserRow,
              {
                backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                borderColor: isDark ? "#334155" : "#e2e8f0",
              },
            ]}
          >
            <UserAvatar
              name={item.displayName}
              avatarUrl={item.avatarUrl}
              size={32}
            />
            <View style={styles.reactionUserTextGroup}>
              <Text style={[styles.receiptUserName, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                {item._id === currentUserId ? "Bạn" : item.displayName}
              </Text>
              <Text style={[styles.reactionUserMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                Đã thả {reactionDetailEmoji}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

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
            Tin nhắn đã thu hồi
          </Text>
        </View>
      );
    }

    if (isDeletedForMe) {
      return (
        <View style={styles.recalledBubble}>
          <Text
            style={[
              styles.recalledText,
              { color: isDark ? "#94a3b8" : "#64748b" },
            ]}
          >
            Bạn đã xóa tin nhắn này
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
                Gọi lại
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    if (isDeletedForMe) {
      return (
        <View style={styles.recalledBubble}>
          <Text
            style={[
              styles.recalledText,
              { color: isDark ? "#94a3b8" : "#64748b" },
            ]}
          >
            Bạn đã xóa tin nhắn này
          </Text>
        </View>
      );
    }

    return (
      <View>
        {message.replyTo ? (
          <View style={[styles.replyPreview, { borderLeftColor: useOwnAccentBubble ? "#ffffff80" : isDark ? "#475569" : "#94a3b8" }]}>
            <Text style={[styles.replySender, { color: useOwnAccentBubble ? "#ffffff" : isDark ? "#e2e8f0" : "#0f172a" }]}>
              {replySenderName}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.replyText, { color: useOwnAccentBubble ? "#ffffffcc" : isDark ? "#cbd5e1" : "#475569" }]}
            >
              {getReplyPreviewContent(message.replyTo)}
            </Text>
          </View>
        ) : null}

        {message.forwardedFrom ? (
          <View style={styles.forwardedBadge}>
            <Text
              style={[
                styles.forwardedBadgeText,
                { color: useOwnAccentBubble ? "#ffffffcc" : isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              Đã chuyển tiếp
            </Text>
          </View>
        ) : null}

        {isPollMessage ? (
          <PollMessageCard
            message={message}
            viewerId={currentUserId}
            participants={selectedConvo.participants}
            onVote={handleVotePoll}
            onAddOption={handleAddPollOption}
            onClose={handleClosePoll}
          />
        ) : null}

        {isAppointmentMessage ? (
          <AppointmentMessageCard
            message={message}
            viewerId={currentUserId}
            onRespond={handleAppointmentResponse}
            onDelete={handleDeleteAppointment}
          />
        ) : null}

        {isGroupInviteMessage && message.groupInviteMeta ? (
          <View
            style={[
              styles.groupInviteCard,
              {
                backgroundColor: isDark ? "#111827" : "#faf7ff",
                borderColor: isDark ? "#475569" : "#c4b5fd",
              },
            ]}
          >
            <View style={styles.groupInviteHeader}>
              <View style={[styles.groupInviteIcon, { backgroundColor: isDark ? "#312e81" : "#ede9fe" }]}>
                <UserPlus size={20} color={isDark ? "#ddd6fe" : "#7c3aed"} />
              </View>
              <View style={styles.groupInviteTextBlock}>
                <Text style={[styles.groupInviteKicker, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Loi moi tham gia nhom
                </Text>
                <Text style={[styles.groupInviteTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  {message.groupInviteMeta.groupName}
                </Text>
                {message.groupInviteMeta.invitationUrl ? (
                  <Pressable onPress={() => Linking.openURL(message.groupInviteMeta?.invitationUrl || "")}>
                    <Text
                      numberOfLines={2}
                      style={[styles.groupInviteLink, { color: isDark ? "#c4b5fd" : "#6d28d9" }]}
                    >
                      {message.groupInviteMeta.invitationUrl}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {message.groupInviteMeta.responseStatus && message.groupInviteMeta.responseStatus !== "pending" ? (
              <View
                style={[
                  styles.groupInviteStatus,
                  {
                    backgroundColor: message.groupInviteMeta.responseStatus === "accepted"
                      ? isDark ? "#064e3b" : "#dcfce7"
                      : isDark ? "#3f1d24" : "#ffe4e6",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.groupInviteStatusText,
                    {
                      color: message.groupInviteMeta.responseStatus === "accepted"
                        ? isDark ? "#bbf7d0" : "#166534"
                        : isDark ? "#fecdd3" : "#be123c",
                    },
                  ]}
                >
                  {message.groupInviteMeta.responseStatus === "accepted"
                    ? "Loi moi da duoc chap nhan"
                    : "Loi moi da bi tu choi"}
                </Text>
              </View>
            ) : (
              <View style={styles.groupInviteActions}>
                <Pressable
                  onPress={() => void handleGroupInviteResponse("accept")}
                  disabled={Boolean(groupInviteAction)}
                  style={[styles.groupInvitePrimaryButton, groupInviteAction && { opacity: 0.65 }]}
                >
                  <Check size={16} color="#ffffff" />
                  <Text style={styles.groupInvitePrimaryText}>
                    {groupInviteAction === "accept" ? "Dang tham gia..." : "Tham gia"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleGroupInviteResponse("decline")}
                  disabled={Boolean(groupInviteAction)}
                  style={[
                    styles.groupInviteSecondaryButton,
                    { borderColor: isDark ? "#475569" : "#94a3b8" },
                    groupInviteAction && { opacity: 0.65 },
                  ]}
                >
                  <X size={16} color={isDark ? "#f8fafc" : "#0f172a"} />
                  <Text style={[styles.groupInviteSecondaryText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                    {groupInviteAction === "decline" ? "Dang tu choi..." : "Tu choi"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {isVoice && voiceAttachment ? (
          <View style={styles.voiceBlock}>
            <VoiceMessagePlayer
              uri={voiceAttachment.url}
              durationSeconds={message.voiceMeta?.durationSeconds}
              isOwn={isOwn}
            />

            {message.content ? (
              <View style={styles.textBlock}>
                <Text
                  style={[
                    styles.voiceCaption,
                    { color: useOwnAccentBubble ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
                  ]}
                >
                  {message.content}
                </Text>

                {(translation || isTranslating) && !isOwn ? (
                  <Text
                    style={[
                      styles.translationText,
                      { color: isDark ? "#94a3b8" : "#64748b" },
                    ]}
                  >
                    {translation || "Đang dịch..."}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {!isVoice && !isStructuredMessage && message.content ? (
          <View style={styles.textBlock}>
            <Text
              style={[
                styles.messageText,
                { color: useOwnAccentBubble ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              {message.content}
            </Text>

            {(translation || isTranslating) && !isOwn ? (
              <Text
                style={[
                  styles.translationText,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                  {translation || "Đang dịch..."}
              </Text>
            ) : null}
          </View>
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
          color={useOwnAccentBubble ? "#ffffff80" : isDark ? "#94a3b8" : "#64748b"}
        />
      </View>
    );
  };

  if (isGroupNotice) {
    return (
      <View style={styles.wrapper}>
        {showTimeSeparator ? (
          <Text
            style={[styles.timeText, { color: isDark ? "#94a3b8" : "#64748b" }]}
          >
            {formatMessageTime(new Date(message.createdAt))}
          </Text>
        ) : null}

        <View style={styles.systemNoticeRow}>
          <View
            style={[
              styles.systemNoticePill,
              {
                backgroundColor: isDark ? "rgba(51, 65, 85, 0.72)" : "#e2e8f0",
                borderColor: isDark ? "#475569" : "#cbd5e1",
              },
            ]}
          >
            <Text style={[styles.systemNoticeText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
              {message.content}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isSearchFocused && styles.searchFocusedWrapper]}>
      {showTimeSeparator ? (
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
                : useOwnAccentBubble
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
          {reactionEntries.length > 0 && (
            <View style={styles.reactionRow}>
              {reactionEntries.map(([emoji, users]) => {
                const isMine = users.some((item) => item._id === currentUserId);

                return (
                  <Pressable
                    key={emoji}
                    onPress={() => handleReactionPress(emoji)}
                    accessibilityHint={getReactionUsersLabel(users, currentUserId)}
                    style={[
                      styles.reactionItem,
                      {
                        backgroundColor: isMine
                          ? "#a78bfa"
                          : isDark
                            ? "#1f2937"
                            : "#e5e7eb",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600" }}>
                      {emoji} {users.length}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isLastOwnMessage ? (
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                {formatMessageTime(new Date(message.createdAt))}
              </Text>
              <Text style={[styles.metaDot, { color: isDark ? "#64748b" : "#94a3b8" }]}>•</Text>
              <Pressable
                disabled={!canViewReceiptDetails}
                onPress={canViewReceiptDetails ? handleShowReceiptDetails : undefined}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: receiptTone.backgroundColor,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: receiptTone.textColor,
                    fontWeight: "600",
                  }}
                >
                  {receiptSummary}
                </Text>
              </Pressable>
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
            <View style={styles.reactionPicker}>
              {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => handleReact(emoji)}
                  style={styles.reactionBtn}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Text
              style={[
                styles.actionTitle,
                { color: isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              Tùy chọn tin nhắn
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
                  {message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                </Text>
              </Pressable>
            ) : null}

            {canReply ? (
              <Pressable
                onPress={handleReply}
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
                  Trả lời
                </Text>
              </Pressable>
            ) : null}

            {canTranslate ? (
              <Pressable
                onPress={() => {
                  closeActions();
                  onTranslateMessage?.(message);
                }}
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
                  {translation ? "Dịch lại tin nhắn" : "Dịch tin nhắn"}
                </Text>
              </Pressable>
            ) : null}

            {canForward ? (
              <Pressable
                onPress={handleOpenForwardPicker}
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
                  Chuyển tiếp
                </Text>
              </Pressable>
            ) : null}

            {canViewReceiptDetails ? (
              <Pressable
                onPress={() => {
                  closeActions();
                  handleShowReceiptDetails();
                }}
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
                  Xem trạng thái
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
                  Thu hồi
                </Text>
              </Pressable>
            ) : null}

            {canDeleteForMe ? (
              <Pressable
                onPress={() => {
                  closeActions();
                  void deleteMessageForMe(message._id);
                }}
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
                  Xóa cho tôi
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
                Đóng
              </Text>
            </Pressable>

          </View>
        </View>
      </Modal>

      <Modal
        visible={showForwardPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForwardPicker(false)}
      >
        <View style={styles.actionRoot}>
          <Pressable
            style={styles.actionBackdrop}
            onPress={() => setShowForwardPicker(false)}
          />

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
              Chuyển tiếp đến
            </Text>

            {availableConversations.length === 0 ? (
              <View style={styles.emptyForwardState}>
                <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  Chưa có cuộc trò chuyện nào khác để chuyển tiếp.
                </Text>
              </View>
            ) : (
              availableConversations.map((conversation) => (
                <Pressable
                  key={conversation._id}
                  onPress={() => void handleForwardMessage(conversation._id)}
                  disabled={forwardingConversationId === conversation._id}
                  style={[
                    styles.actionButton,
                    styles.forwardTargetButton,
                    {
                      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                      borderColor: isDark ? "#334155" : "#e2e8f0",
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: isDark ? "#f8fafc" : "#0f172a" },
                      ]}
                    >
                      {getConversationLabel(conversation)}
                    </Text>
                    <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                      {conversation.type === "group" ? "Nhóm" : "Trò chuyện trực tiếp"}
                    </Text>
                  </View>

                  <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                    {forwardingConversationId === conversation._id ? "Đang gửi..." : "Chọn"}
                  </Text>
                </Pressable>
              ))
            )}

            <Pressable
              onPress={() => setShowForwardPicker(false)}
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
                Đóng
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReceiptModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.actionRoot}>
          <Pressable style={styles.actionBackdrop} onPress={() => setShowReceiptModal(false)} />

          <View
            style={[
              styles.receiptModalCard,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.actionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Trạng thái tin nhắn
            </Text>

            <Text style={[styles.receiptMessageTime, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {formatMessageTime(new Date(message.createdAt))}
            </Text>

            {renderReceiptSection(
              `Đã xem (${seenParticipants.length})`,
              seenParticipants,
              "Chưa có ai xem tin nhắn này."
            )}
            {renderReceiptSection(
              `Đã nhận (${deliveredOnlyParticipants.length})`,
              deliveredOnlyParticipants,
              "Chưa có ai chỉ mới nhận mà chưa xem."
            )}
            {renderReceiptSection(
              `Đã gửi (${pendingParticipants.length})`,
              pendingParticipants,
              "Tất cả thành viên còn lại đã nhận tin nhắn này."
            )}

            <Pressable
              onPress={() => setShowReceiptModal(false)}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                Đóng
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(reactionDetailEmoji)}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionDetailEmoji(null)}
      >
        <View style={styles.actionRoot}>
          <Pressable style={styles.actionBackdrop} onPress={() => setReactionDetailEmoji(null)} />

          <View
            style={[
              styles.receiptModalCard,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.actionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Phản ứng {reactionDetailEmoji}
            </Text>

            <Text style={[styles.receiptMessageTime, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {activeReactionUsers.length} thành viên đã thả cảm xúc này
            </Text>

            {renderReactionSection(
              `Danh sách (${activeReactionUsers.length})`,
              activeReactionUsers
            )}

            {reactionDetailEmoji ? (
              <Pressable
                onPress={() => void handleReact(reactionDetailEmoji)}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                  },
                ]}
              >
                <Text style={[styles.actionButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                  {activeReactionUsers.some((item) => item._id === currentUserId)
                    ? `Bỏ ${reactionDetailEmoji}`
                    : `Thả ${reactionDetailEmoji}`}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setReactionDetailEmoji(null)}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                },
              ]}
            >
              <Text style={[styles.actionButtonText, { color: isDark ? "#cbd5e1" : "#475569" }]}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default memo(MessageItem, (prevProps, nextProps) => {
  return (
    prevProps.message === nextProps.message &&
    prevProps.previousMessage === nextProps.previousMessage &&
    prevProps.selectedConvo === nextProps.selectedConvo &&
    prevProps.isSearchFocused === nextProps.isSearchFocused &&
    prevProps.translation === nextProps.translation &&
    prevProps.isTranslating === nextProps.isTranslating
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10, borderRadius: 18 },
  systemNoticeRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 6,
  },
  systemNoticePill: {
    maxWidth: "82%",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  systemNoticeText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  searchFocusedWrapper: {
    borderWidth: 2,
    borderColor: "#fbbf24",
    padding: 4,
  },
  timeText: { fontSize: 12, textAlign: "center", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avatarSlot: { width: 34, alignItems: "center" },
  messageColumn: { maxWidth: "78%" },
  receiptModalCard: {
    width: "85%",
    maxHeight: "80%",
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  receiptMessageTime: {
    fontSize: 12,
    textAlign: "center",
  },
  receiptSection: {
    gap: 8,
  },
  receiptSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  receiptEmptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  receiptUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  receiptUserName: {
    fontSize: 14,
    fontWeight: "600",
  },
  reactionUserTextGroup: {
    flex: 1,
  },
  reactionUserMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  metaText: { fontSize: 11, lineHeight: 14 },
  metaDot: { fontSize: 12, lineHeight: 14 },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
  },
  textBlock: {
    gap: 6,
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  translationText: {
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.24)",
    paddingTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  forwardedBadge: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#00000020",
  },
  replyPreview: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
  replySender: {
    fontSize: 12,
    fontWeight: "700",
  },
  replyText: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  forwardedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fileBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#00000010",
  },
  groupInviteCard: {
    minWidth: 260,
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 14,
  },
  groupInviteHeader: {
    flexDirection: "row",
    gap: 12,
  },
  groupInviteIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  groupInviteTextBlock: {
    flex: 1,
    gap: 4,
  },
  groupInviteKicker: {
    fontSize: 12,
    fontWeight: "700",
  },
  groupInviteTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  groupInviteLink: {
    fontSize: 12,
    lineHeight: 17,
  },
  groupInviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  groupInvitePrimaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  groupInvitePrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  groupInviteSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  groupInviteSecondaryText: {
    fontSize: 14,
    fontWeight: "800",
  },
  groupInviteStatus: {
    minHeight: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  groupInviteStatusText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: "80%", height: "80%" },
  actionRoot: {
    flex: 1,
    justifyContent: "center", // 
    alignItems: "center",
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  actionSheet: {
    width: "85%",
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
  forwardTargetButton: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  emptyForwardState: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: "#00000010",
  },
  actionDangerText: {
    color: "#ef4444",
  },
  reactionPicker: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#00000010",
    borderRadius: 16,
  },

  reactionBtn: {
    padding: 6,
  },

  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },

  reactionItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
