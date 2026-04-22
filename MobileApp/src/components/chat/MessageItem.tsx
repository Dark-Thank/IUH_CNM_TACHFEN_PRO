import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant, ReactionUser } from "@/types/chat";
import { Pin } from "lucide-react-native";
import { memo, useState } from "react";
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

interface MessageItemProps {
  message: Message;
  previousMessage?: Message;
  selectedConvo: Conversation;
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

function MessageItem({ message, previousMessage, selectedConvo }: MessageItemProps) {
  const { isDark } = useThemeStore();
  const { user } = useAuthStore();
  const {
    conversations,
    forwardMessage,
    recallMessage,
    togglePinMessage,
    deleteMessageForMe,
    setReplyingMessage,
    updateMessage,
  } = useChatStore();
  const currentUserId = user?._id;


  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [reactionDetailEmoji, setReactionDetailEmoji] = useState<string | null>(null);
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);
  const previous = previousMessage;
  const previousCreatedAt = previous?.createdAt
    ? new Date(previous.createdAt).getTime()
    : 0;
  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isOwn = !!message.isOwn || message.senderId === currentUserId;
  const isLastOwnMessage = isOwn && message._id === selectedConvo.lastMessage?._id;
  const isShowTime = !previous || currentCreatedAt - previousCreatedAt > 300000;
  const isGroupBreak = isShowTime || message.senderId !== previous?.senderId;

  const participant = selectedConvo.participants.find(
    (item: Participant) => item._id === message.senderId
  );

  const isDeletedForMe = message.deletedForUsers?.includes(currentUserId || "");
  const canTogglePin = !message.isRecalled && !isDeletedForMe;
  const canReply = !message.isRecalled && !isDeletedForMe;
  const canForward = !message.isRecalled && !isDeletedForMe && Boolean(
    message.content || message.imgUrls?.length || message.fileUrls?.length
  );
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
        { text: "Huy", style: "cancel" },
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

    return (
      <View>
        {message.replyTo ? (
          <View style={[styles.replyPreview, { borderLeftColor: isOwn ? "#ffffff80" : isDark ? "#475569" : "#94a3b8" }]}>
            <Text style={[styles.replySender, { color: isOwn ? "#ffffff" : isDark ? "#e2e8f0" : "#0f172a" }]}>
              {replySenderName}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.replyText, { color: isOwn ? "#ffffffcc" : isDark ? "#cbd5e1" : "#475569" }]}
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
                { color: isOwn ? "#ffffffcc" : isDark ? "#94a3b8" : "#64748b" },
              ]}
            >
              Đã chuyển tiếp
            </Text>
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
              isOwn
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
    prevProps.selectedConvo === nextProps.selectedConvo
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
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
  messageText: { fontSize: 15, lineHeight: 21 },
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
  modal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: { width: "100%", height: "100%" },
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
