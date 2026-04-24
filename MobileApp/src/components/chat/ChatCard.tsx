import { formatOnlineTime } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { Ellipsis, Pin, PinOff } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import UserAvatar from "./UserAvatar";

interface ChatCardProps {
  conversation: Conversation;
  currentUserId?: string;
  isActive?: boolean;
  isOnline?: boolean;
  onPress: (conversationId: string) => void;
  onTogglePin?: (conversationId: string) => void | Promise<void>;
}

const getConversationName = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhóm chat";
  }

  const otherUser = conversation.participants.find((p) => p._id !== currentUserId);
  return otherUser?.displayName || "Tin nhắn";
};

const getConversationPreview = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.lastMessage?.content) {
    return conversation.lastMessage.content;
  }

  if (conversation.type === "group") {
    return `${conversation.participants.length} thành viên`;
  }

  const otherUser = conversation.participants.find((p) => p._id !== currentUserId);
  return otherUser ? `Bắt đầu trò chuyện với ${otherUser.displayName}` : "Bắt đầu trò chuyện";
};

export default function ChatCard({
  conversation,
  currentUserId,
  isActive = false,
  isOnline = false,
  onPress,
  onTogglePin,
}: ChatCardProps) {
  const { isDark } = useThemeStore();
  const [showActions, setShowActions] = useState(false);

  const otherUser = conversation.participants.find((p) => p._id !== currentUserId);
  const unreadCount = currentUserId
    ? conversation.unreadCounts?.[currentUserId] ?? 0
    : 0;

  const name = getConversationName(conversation, currentUserId);
  const subtitle = getConversationPreview(conversation, currentUserId);
  const timestamp = conversation.lastMessage?.createdAt
    ? formatOnlineTime(new Date(conversation.lastMessage.createdAt))
    : "";

  return (
    <Pressable
      onPress={() => onPress(conversation._id)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isDark ? "#111827" : "#ffffff",
          borderColor: isActive
            ? isDark
              ? "#c084fc"
              : "#8b5cf6"
            : isDark
              ? "#1f2937"
              : "#e2e8f0",
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.leading}>
        {conversation.type === "group" ? (
  <UserAvatar
    name={conversation.group?.name || "Group"}
    avatarUrl={conversation.group?.avatar} // ✅ avatar group
    size={46}
  />
) : (
          <UserAvatar
            name={otherUser?.displayName || "Tachfen"}
            avatarUrl={otherUser?.avatarUrl}
            size={46}
            isOnline={isOnline}
            showPresence
          />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: isDark ? "#f8fafc" : "#0f172a" },
              unreadCount > 0 && styles.nameUnread,
            ]}
          >
            {name}
          </Text>

          <Text style={[styles.time, { color: isDark ? "#94a3b8" : "#64748b" }]}>
            {timestamp}
          </Text>
        </View>

        <View style={styles.row}>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color:
                  unreadCount > 0
                    ? isDark
                      ? "#e2e8f0"
                      : "#334155"
                    : isDark
                      ? "#94a3b8"
                      : "#64748b",
              },
            ]}
          >
            {subtitle}
          </Text>

          <View style={styles.trailing}>
            {conversation.isPinned ? (
              <Pin size={14} color={isDark ? "#c084fc" : "#7c3aed"} fill={isDark ? "#c084fc" : "#7c3aed"} />
            ) : null}
            {unreadCount > 0 ? (
              <View
                style={[
                  styles.unreadBadge,
                  { backgroundColor: isDark ? "#c084fc" : "#8b5cf6" },
                ]}
              >
                <Text style={styles.unreadText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => setShowActions(true)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.menuButton,
                { backgroundColor: pressed ? (isDark ? "#1f2937" : "#f1f5f9") : "transparent" },
              ]}
            >
              <Ellipsis size={18} color={isDark ? "#94a3b8" : "#64748b"} />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowActions(false)} />
          <View
            style={[
              styles.actionSheet,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#1f2937" : "#e2e8f0",
              },
            ]}
          >
            <Text style={[styles.actionTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
              Tuy chon cuoc tro chuyen
            </Text>

            <Pressable
              onPress={() => {
                setShowActions(false);
                onTogglePin?.(conversation._id);
              }}
              style={[
                styles.actionButton,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                },
              ]}
            >
              {conversation.isPinned ? <PinOff size={16} color={isDark ? "#f8fafc" : "#0f172a"} /> : <Pin size={16} color={isDark ? "#f8fafc" : "#0f172a"} />}
              <Text style={[styles.actionButtonText, { color: isDark ? "#f8fafc" : "#0f172a" }]}>
                {conversation.isPinned ? "Bo ghim cuoc hoi thoai" : "Ghim cuoc hoi thoai"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowActions(false)}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  leading: {
    justifyContent: "center",
    alignItems: "center",
  },
  groupBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 12,
  },
  nameUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: 12,
    fontWeight: "500",
  },
  subtitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginRight: 12,
  },
  trailing: {
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  menuButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  actionSheet: {
    width: "82%",
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
    gap: 8,
    flexDirection: "row",
    paddingHorizontal: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
