import { formatOnlineTime } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { ChevronRight, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

interface ChatCardProps {
  conversation: Conversation;
  currentUserId?: string;
  isActive?: boolean;
  isOnline?: boolean;
  onPress: (conversationId: string) => void;
}

const getConversationName = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhom chat";
  }

  const otherUser = conversation.participants.find((p) => p._id !== currentUserId);
  return otherUser?.displayName || "Tin nhan";
};

const getConversationPreview = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.lastMessage?.content) {
    return conversation.lastMessage.content;
  }

  if (conversation.type === "group") {
    return `${conversation.participants.length} thanh vien`;
  }

  const otherUser = conversation.participants.find((p) => p._id !== currentUserId);
  return otherUser ? `Bat dau tro chuyen voi ${otherUser.displayName}` : "Bat dau tro chuyen";
};

export default function ChatCard({
  conversation,
  currentUserId,
  isActive = false,
  isOnline = false,
  onPress,
}: ChatCardProps) {
  const { isDark } = useThemeStore();

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
          <View
            style={[
              styles.groupBadge,
              { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
            ]}
          >
            <UsersRound
              size={20}
              color={isDark ? "#c4b5fd" : "#6d28d9"}
            />
          </View>
        ) : (
          <UserAvatar
            name={otherUser?.displayName || "Moji"}
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
            ) : (
              <ChevronRight
                size={18}
                color={isDark ? "#64748b" : "#94a3b8"}
              />
            )}
          </View>
        </View>
      </View>
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
    minWidth: 28,
    alignItems: "flex-end",
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
});
