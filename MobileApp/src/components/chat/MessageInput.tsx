import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { ImagePlus, Send } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

interface MessageInputProps {
  selectedConvo: Conversation;
}

export default function MessageInput({ selectedConvo }: MessageInputProps) {
  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage } = useChatStore();
  const { isDark } = useThemeStore();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const placeholderColor = isDark ? "#94a3b8" : "#64748b";

  const otherUser = useMemo(() => {
    if (!user || selectedConvo.type !== "direct") {
      return null;
    }

    return (
      selectedConvo.participants.find((participant) => participant._id !== user._id) ??
      null
    );
  }, [selectedConvo, user]);

  if (!user) {
    return null;
  }

  const handleSend = async () => {
    const trimmed = value.trim();

    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    setValue("");

    try {
      if (selectedConvo.type === "direct") {
        if (!otherUser) {
          throw new Error("Không tìm thấy người nhận.");
        }

        await sendDirectMessage(otherUser._id, trimmed);
      } else {
        await sendGroupMessage(selectedConvo._id, trimmed);
      }
    } catch (error) {
      console.error(error);
      setValue(trimmed);
      toast.error("Gửi tin nhắn thất bại. Hãy thử lại.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#111827" : "#ffffff",
            borderTopColor: isDark ? "#1f2937" : "#e2e8f0",
          },
        ]}
      >
        <Pressable
          style={[
            styles.iconButton,
            { backgroundColor: isDark ? "#1f2937" : "#f1f5f9" },
          ]}
        >
          <ImagePlus
            size={18}
            color={isDark ? "#cbd5e1" : "#475569"}
          />
        </Pressable>

        <View
          style={[
            styles.inputShell,
            {
              backgroundColor: isDark ? "#0f172a" : "#f8fafc",
              borderColor: isDark ? "#334155" : "#e2e8f0",
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Soạn tin nhắn..."
            placeholderTextColor={placeholderColor}
            multiline
            style={[
              styles.input,
              { color: isDark ? "#f8fafc" : "#0f172a" },
            ]}
          />
        </View>

        <Pressable
          onPress={handleSend}
          style={[
            styles.sendButton,
            {
              backgroundColor:
                value.trim().length > 0 && !sending
                  ? isDark
                    ? "#a855f7"
                    : "#8b5cf6"
                  : isDark
                    ? "#374151"
                    : "#cbd5e1",
            },
          ]}
        >
          <Send
            size={18}
            color="#ffffff"
          />
        </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  inputShell: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 96,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
