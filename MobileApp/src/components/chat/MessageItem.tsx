import { formatMessageTime } from "@/lib/utils";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "@/lib/toast";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Pin, Trash2 } from "lucide-react-native";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

interface MessageItemProps {
  message: Message;
  index: number;      // THÊM DÒNG NÀY
  messages: Message[]; // THÊM DÒNG NÀY
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

  const isOwn = !!message.isOwn || message.senderId === currentUserId; // Fix: or sender check
  const previousCreatedAt = previousMessage?.createdAt
    ? new Date(previousMessage.createdAt).getTime()
    : 0;
  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isShowTime =
    !previousMessage || currentCreatedAt - previousCreatedAt > 300000;
  const isGroupBreak = isShowTime || message.senderId !== previousMessage?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id.toString() === message.senderId.toString()
  );

  const handleLongPress = () => {
    console.log("Long press msg:", message._id, "isOwn:", isOwn, "sender:", message.senderId, "me:", currentUserId);
    
    const now = new Date();
    const msgTime = new Date(message.createdAt);
    const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const isRecentOwn = isOwn && msgTime > twoMinsAgo;

    const actions = [];
    if (isRecentOwn) {
      actions.push({
        title: "Thu hồi",
        onPress: () => {
          Alert.alert(
            "Thu hồi tin nhắn",
            "Tin nhắn sẽ bị thu hồi cho tất cả thành viên. Tiếp tục?",
            [
              { text: "Hủy", style: "cancel" },
              { 
                text: "Thu hồi", 
                style: "destructive", 
                onPress: () => recallMessage(message._id) 
              }
            ]
          );
        }
      });
    }

    // Ghim for own msgs only
    if (isOwn) {
      actions.push({
        title: message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn",
        onPress: () => togglePinMessage(message._id)
      });
    } else {
      // Ghim available for all (can pin others' msgs?)
      actions.push({
        title: message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn",
        onPress: () => togglePinMessage(message._id)
      });
    }

    if (actions.length === 0) {
      toast.info("Không có hành động nào khả dụng");
      return;
    }

    const buttons = actions.map(action => ({
      text: action.title,
      onPress: action.onPress
    }));
    buttons.push({ text: "Hủy", style: "cancel" });

    Alert.alert(
      "Tùy chọn tin nhắn",
      "",
      buttons
    );
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

    if (message.imgUrls && message.imgUrls.length > 0) {
      return message.imgUrls.map((url, index) => (
        <View key={index} style={styles.imageContainer}>
          <Image source={{ uri: url }} style={styles.messageImage} resizeMode="cover" />
        </View>
      ));
    }

    return (
      <Text
        style={[
          styles.messageText,
          { color: isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" }
        ]}
      >
        {message.content ?? ""}
      </Text>
    );
  };

  const renderPinIcon = () => {
    if (message.isPinned) {
      return (
        <View style={styles.pinIconContainer}>
          <Pin size={12} color={isOwn ? "#ffffff80" : isDark ? "#94a3b8" : "#64748b"} />
        </View>
      );
    }
    return null;
  };

  return (
    <Pressable onLongPress={handleLongPress} style={styles.wrapper}>
      {isShowTime ? (
        <Text style={[styles.timeText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
          {formatMessageTime(new Date(message.createdAt))}
        </Text>
      ) : null}

      <View
        style={[
          styles.row,
          { justifyContent: isOwn ? "flex-end" : "flex-start" }
        ]}
      >
        {!isOwn ? (
          <View style={styles.avatarSlot}>
            {isGroupBreak ? (
              <UserAvatar
                name={participant?.displayName ?? "Moji"}
                avatarUrl={participant?.avatarUrl}
                size={30}
              />
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.messageColumn,
            { alignItems: isOwn ? "flex-end" : "flex-start" }
          ]}
        >
          <View
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
          </View>

          {isOwn && message._id === selectedConvo.lastMessage?._id ? (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    lastMessageStatus === "seen"
                      ? isDark ? "#312e81" : "#ede9fe"
                      : isDark ? "#1f2937" : "#e2e8f0"
                }
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      lastMessageStatus === "seen"
                        ? isDark ? "#c4b5fd" : "#6d28d9"
                        : isDark ? "#cbd5e1" : "#475569"
                  }
                ]}
              >
                {lastMessageStatus}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  timeText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  avatarSlot: {
    width: 34,
    alignItems: "center",
  },
  messageColumn: {
    maxWidth: "78%",
    gap: 6,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "relative",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  recalledBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recalledText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  imageContainer: {
    marginTop: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  pinIconContainer: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
