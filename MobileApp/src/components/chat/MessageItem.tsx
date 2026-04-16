import { formatMessageTime } from "@/lib/utils";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import UserAvatar from "./UserAvatar";
import { useState } from "react";

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isOwn = !!message.isOwn;

  const previousCreatedAt = previousMessage?.createdAt
    ? new Date(previousMessage.createdAt).getTime()
    : 0;

  const currentCreatedAt = new Date(message.createdAt).getTime();

  const isShowTime =
    !previousMessage || currentCreatedAt - previousCreatedAt > 300000;

  const isGroupBreak =
    isShowTime || message.senderId !== previousMessage?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) => p._id === message.senderId
  );

  return (
    <View style={styles.wrapper}>
      {/* TIME */}
      {isShowTime && (
        <Text
          style={[
            styles.timeText,
            { color: isDark ? "#94a3b8" : "#64748b" },
          ]}
        >
          {formatMessageTime(new Date(message.createdAt))}
        </Text>
      )}

      <View
        style={[
          styles.row,
          { justifyContent: isOwn ? "flex-end" : "flex-start" },
        ]}
      >
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
                ? { backgroundColor: isDark ? "#a855f7" : "#8b5cf6" }
                : {
                  backgroundColor: isDark ? "#1f2937" : "#ffffff",
                  borderColor: isDark ? "#334155" : "#e2e8f0",
                  borderWidth: 1,
                },
            ]}
          >
            {/* TEXT */}
            {message.content ? (
              <Text
                style={[
                  styles.messageText,
                  {
                    color: isOwn
                      ? "#fff"
                      : isDark
                        ? "#f8fafc"
                        : "#0f172a",
                  },
                ]}
              >
                {message.content}
              </Text>
            ) : null}

            {/* IMAGES */}
            {message.imgUrls?.map((url, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  console.log("CLICK IMAGE:", url); // DEBUG
                  setPreviewImage(url);
                }}
              >
                <Image source={{ uri: url }} style={styles.image} />
              </Pressable>
            ))}

            {/* FILES */}
            {message.fileUrls?.map((file, index) => (
              <Pressable key={index} style={styles.fileBox}>
                <Text
                  style={{
                    color: isDark ? "#cbd5e1" : "#0f172a",
                  }}
                >
                  📎 {file.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* IMAGE PREVIEW MODAL */}
      <Modal visible={!!previewImage} transparent>
        <Pressable
          style={styles.modal}
          onPress={() => setPreviewImage(null)}
        >
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
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginTop: 6,
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
  fullImage: {
    width: "100%",
    height: "100%",
  },
});