import { formatMessageTime } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "@/lib/toast";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Pin } from "lucide-react-native";
import { Alert, Image, Pressable, StyleSheet, Text, View, Modal } from "react-native";
import UserAvatar from "./UserAvatar";
import { useState } from "react";

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
  const currentUserId = user?._id;

  const isOwn = !!message.isOwn || message.senderId === currentUserId;
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const previousCreatedAt = previousMessage?.createdAt
    ? new Date(previousMessage.createdAt).getTime()
    : 0;
  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isShowTime = !previousMessage || currentCreatedAt - previousCreatedAt > 300000;
  const isGroupBreak = isShowTime || message.senderId !== previousMessage?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id === message.senderId
  );

  const handleLongPress = () => {
    if (message.isRecalled) return; // Không cho thao tác trên tin nhắn đã thu hồi

    const now = new Date();
    const msgTime = new Date(message.createdAt);
    const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const isRecentOwn = isOwn && msgTime > twoMinsAgo;
    const actions = [];

    if (isRecentOwn) {
      actions.push({
        text: "Thu hồi",
        style: "destructive" as const,
        onPress: () => {
          Alert.alert("Thu hồi", "Tin nhắn sẽ bị thu hồi cho tất cả thành viên. Tiếp tục?", [
            { text: "Hủy", style: "cancel" },
            { text: "Thu hồi", style: "destructive", onPress: () => recallMessage(message._id) },
          ]);
        },
      });
    }

    actions.push({
      text: message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn",
      onPress: () => togglePinMessage(message._id),
    });

    Alert.alert("Tùy chọn tin nhắn", "", [...actions, { text: "Hủy", style: "cancel" }]);
  };

  const renderContent = () => {
    if (message.isRecalled) {
      return (
        <View style={styles.recalledBubble}>
          <Text style={[styles.recalledText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            Tin nhắn đã thu hồi
          </Text>
        </View>
      );
    }

    return (
      <View>
        {message.content ? (
          <Text style={[styles.messageText, { color: isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" }]}>
            {message.content}
          </Text>
        ) : null}

        {message.imgUrls?.map((url, idx) => (
          <Pressable key={idx} onPress={() => setPreviewImage(url)} style={styles.imageContainer}>
            <Image source={{ uri: url }} style={styles.messageImage} resizeMode="cover" />
          </Pressable>
        ))}

        {message.fileUrls?.map((file, idx) => (
          <Pressable key={idx} style={styles.fileBox}>
            <Text style={{ color: isDark ? "#cbd5e1" : "#0f172a" }}>📎 {file.name}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderPinIcon = () => {
    if (message.isPinned && !message.isRecalled) {
      return (
        <View style={styles.pinIconContainer}>
          <Pin size={12} color={isOwn ? "#ffffff80" : isDark ? "#94a3b8" : "#64748b"} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.wrapper}>
      {/* THỜI GIAN */}
      {isShowTime && (
        <Text style={[styles.timeText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          {formatMessageTime(new Date(message.createdAt))}
        </Text>
      )}

      <View style={[styles.row, { justifyContent: isOwn ? "flex-end" : "flex-start" }]}>
        {!isOwn && (
          <View style={styles.avatarSlot}>
            {isGroupBreak && (
              <UserAvatar
                name={participant?.displayName ?? "User"}
                avatarUrl={participant?.avatarUrl}
                size={30}
              />
            )}
          </View>
        )}

        <View style={[styles.messageColumn, { alignItems: isOwn ? "flex-end" : "flex-start" }]}>
          <Pressable 
            onLongPress={handleLongPress} 
            style={[
              styles.bubble,
              isOwn
                ? { backgroundColor: isDark ? "#a855f7" : "#8b5cf6" }
                : { 
                    backgroundColor: isDark ? "#1f2937" : "#ffffff", 
                    borderColor: isDark ? "#334155" : "#e2e8f0", 
                    borderWidth: 1 
                  }
            ]}
          >
            {renderContent()}
            {renderPinIcon()}
          </Pressable>

          {/* TRẠNG THÁI ĐÃ XEM */}
          {isOwn && message._id === selectedConvo.lastMessage?._id && (
            <View style={[styles.statusPill, { 
              backgroundColor: lastMessageStatus === "seen" ? (isDark ? "#312e81" : "#ede9fe") : (isDark ? "#1f2937" : "#e2e8f0")
            }]}>
              <Text style={{ 
                fontSize: 10, 
                color: lastMessageStatus === "seen" ? (isDark ? "#c4b5fd" : "#6d28d9") : (isDark ? "#94a3b8" : "#64748b")
              }}>
                {lastMessageStatus === "seen" ? "Đã xem" : "Đã gửi"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* MODAL XEM ẢNH */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <Pressable style={styles.modal} onPress={() => setPreviewImage(null)}>
          <Image
            source={{ uri: previewImage ?? "" }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </Pressable>
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
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, position: "relative" },
  messageText: { fontSize: 15, lineHeight: 21 },
  recalledBubble: { minWidth: 120 },
  recalledText: { fontSize: 14, fontStyle: "italic" },
  imageContainer: { marginTop: 4 },
  messageImage: { width: 200, height: 200, borderRadius: 12 },
  pinIconContainer: { position: "absolute", top: 4, right: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  fileBox: { marginTop: 6, padding: 10, borderRadius: 10, backgroundColor: "#00000010" },
  modal: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  fullImage: { width: "100%", height: "100%" },
});