import { formatMessageTime } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { StyleSheet, Text, View } from "react-native";
import UserAvatar from "./UserAvatar";

interface MessageItemProps {
  message: Message;
  previousMessage?: Message;
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
}

export default function MessageItem({
  message,
  previousMessage,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) {
  const { isDark } = useThemeStore();

  const isOwn = !!message.isOwn;
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

  return (
    <View style={styles.wrapper}>
      {isShowTime ? (
        <Text style={[styles.timeText, { color: isDark ? "#94a3b8" : "#64748b" }]}>
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
            { alignItems: isOwn ? "flex-end" : "flex-start" },
          ]}
        >
          <View
            style={[
              styles.bubble,
              isOwn
                ? {
                    backgroundColor: isDark ? "#a855f7" : "#8b5cf6",
                  }
                : {
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    borderWidth: 1,
                  },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: isOwn ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              {message.content ?? ""}
            </Text>
          </View>

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
                style={[
                  styles.statusText,
                  {
                    color:
                      lastMessageStatus === "seen"
                        ? isDark
                          ? "#c4b5fd"
                          : "#6d28d9"
                        : isDark
                          ? "#cbd5e1"
                          : "#475569",
                  },
                ]}
              >
                {lastMessageStatus}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
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
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
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
