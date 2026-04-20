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
  const {
    conversations,
    forwardMessage,
    recallMessage,
    togglePinMessage,
    deleteMessageForMe,
    updateMessage,
  } = useChatStore();
  const currentUserId = user?._id;


  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);
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

  const isDeletedForMe = message.deletedForUsers?.includes(currentUserId || "");
  const canTogglePin = !message.isRecalled && !isDeletedForMe;
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
  forwardedBadge: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#00000020",
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
