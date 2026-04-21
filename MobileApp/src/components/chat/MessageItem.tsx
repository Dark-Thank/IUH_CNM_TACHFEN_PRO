import { formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Pin } from "lucide-react-native";
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

const getReplyPreviewContent = (replyTo?: Message["replyTo"]) => {
  const trimmedContent = typeof replyTo?.content === "string" ? replyTo.content.trim() : "";

  if (trimmedContent) {
    return trimmedContent;
  }

  if (replyTo?.messageType === "voice") {
    return "Tin nhan thoai";
  }

  if (replyTo?.messageType === "call") {
    return "Cuoc goi";
  }

  if ((replyTo?.imgUrls?.length ?? 0) > 0) {
    return replyTo?.imgUrls?.length === 1 ? "Anh dinh kem" : `${replyTo?.imgUrls?.length} anh dinh kem`;
  }

  if ((replyTo?.fileUrls?.length ?? 0) > 0) {
    return replyTo?.fileUrls?.length === 1 ? "Tep dinh kem" : `${replyTo?.fileUrls?.length} tep dinh kem`;
  }

  return "Tin nhan";
};

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  previousMessage?: Message;
  selectedConvo: Conversation;
}

const MESSAGE_RECEIPT_LABELS = {
  sent: "Da gui",
  delivered: "Da nhan",
  seen: "Da xem",
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

export default function MessageItem({
  message,
  index,
  messages,
  previousMessage,
  selectedConvo,
}: MessageItemProps) {
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
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);
  const previous = previousMessage ?? messages[index - 1];
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
      ? "Ban"
      : selectedConvo.participants.find((item) => item._id === message.replyTo?.senderId)?.displayName || "Thanh vien")
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
  const showTimeSeparator = isShowTime && !isLastOwnMessage;
  const receiptTone = getReceiptTone(receiptStatus, isDark);

  const closeActions = () => setShowActions(false);

  const getConversationLabel = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.group?.name || "Nhom chat";
    }

    return (
      conversation.participants.find((participant) => participant._id !== currentUserId)
        ?.displayName || "Tro chuyen truc tiep"
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
      updateMessage(res.message);
    } catch (err) {
      console.error("React lỗi:", err);
    } finally {
      setShowActions(false);
    }
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
      console.error("Loi khi chuyen tiep tin nhan:", error);
      Alert.alert("Chuyen tiep that bai", "Khong the chuyen tiep tin nhan nay.");
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
      console.error("Loi khi tai file:", error);
      Alert.alert("Tai file that bai", "Khong the tai tep dinh kem nay.");
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

    if (isDeletedForMe) {
      return (
        <View style={styles.recalledBubble}>
          <Text
            style={[
              styles.recalledText,
              { color: isDark ? "#94a3b8" : "#64748b" },
            ]}
          >
            Ban da xoa tin nhan nay
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
              Da chuyen tiep
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
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <View style={styles.reactionRow}>
              {Object.entries(message.reactions).map(([emoji, users]) => {
                const isMine = users.includes(currentUserId!);

                return (
                  <Pressable
                    key={emoji}
                    onPress={() => handleReact(emoji)}
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
                    <Text style={{ fontSize: 12 }}>
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
                  Tra loi
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
                  Chuyen tiep
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
                  Xem trang thai
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
                Dong
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
              Chuyen tiep den
            </Text>

            {availableConversations.length === 0 ? (
              <View style={styles.emptyForwardState}>
                <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                  Chua co cuoc tro chuyen nao khac de chuyen tiep.
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
                      {conversation.type === "group" ? "Nhom" : "Tro chuyen truc tiep"}
                    </Text>
                  </View>

                  <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}>
                    {forwardingConversationId === conversation._id ? "Dang gui..." : "Chon"}
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
                Dong
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
              Trang thai tin nhan
            </Text>

            <Text style={[styles.receiptMessageTime, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              {formatMessageTime(new Date(message.createdAt))}
            </Text>

            {renderReceiptSection(
              `Da xem (${seenParticipants.length})`,
              seenParticipants,
              "Chua co ai xem tin nhan nay."
            )}
            {renderReceiptSection(
              `Da nhan (${deliveredOnlyParticipants.length})`,
              deliveredOnlyParticipants,
              "Chua co ai chi moi nhan ma chua xem."
            )}
            {renderReceiptSection(
              `Da gui (${pendingParticipants.length})`,
              pendingParticipants,
              "Tat ca thanh vien con lai da nhan tin nhan nay."
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
    gap: 6,
    marginTop: 4,
  },

  reactionItem: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
});
