import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { ImagePlus, Send, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

interface FileItem {
  uri: string;
  name: string;
  type: string;
}

interface MessageInputProps {
  selectedConvo: Conversation;
}

export default function MessageInput({
  selectedConvo,
}: MessageInputProps) {
  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage } =
    useChatStore();
  const { isDark } = useThemeStore();

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [sending, setSending] = useState(false);

  const placeholderColor = isDark
    ? "#94a3b8"
    : "#64748b";

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  const otherUser = useMemo(() => {
    if (!user || selectedConvo.type !== "direct")
      return null;

    return (
      selectedConvo.participants.find(
        (p) => p._id !== user._id
      ) ?? null
    );
  }, [selectedConvo, user]);

  if (!user) return null;

  useEffect(() => {
    setFiles([]);
    setValue("");
  }, [selectedConvo._id]);

  // ======================
  // PICK IMAGE
  // ======================
  const pickImage = async () => {
    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

    if (!result.canceled) {
      const selected: FileItem[] =
        result.assets.map((a) => ({
          uri: a.uri,
          name: a.fileName || "image.jpg",
          type: "image/jpeg",
        }));

      setFiles((prev) => [...prev, ...selected]);
    }
  };

  // ======================
  // PICK FILE
  // ======================
  const pickFile = async () => {
    const result =
      await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });

    if (!result.canceled) {
      const selected: FileItem[] =
        result.assets.map((f) => ({
          uri: f.uri,
          name: f.name,
          type:
            f.mimeType ||
            "application/octet-stream",
        }));

      setFiles((prev) => [...prev, ...selected]);
    }
  };

  // ======================
  // REMOVE FILE
  // ======================
  const removeFile = (index: number) => {
    setFiles((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  // ======================
  // SEND MESSAGE
  // ======================
  const handleSend = async () => {
    const trimmed = value.trim();

    if (!trimmed && files.length === 0)
      return;

    if (sending) return;

    setSending(true);
    setValue("");

    try {
      if (selectedConvo.type === "direct") {
        if (!otherUser)
          throw new Error(
            "Không tìm thấy người nhận"
          );

        await sendDirectMessage(
          otherUser._id,
          trimmed,
          files
        );
      } else {
        await sendGroupMessage(
          selectedConvo._id,
          trimmed,
          files
        );
      }

      setFiles([]);
    } catch (error) {
      console.error(error);
      setValue(trimmed);
      toast.error(
        "Gửi tin nhắn thất bại"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark
            ? "#111827"
            : "#ffffff",
          borderTopColor: isDark
            ? "#1f2937"
            : "#e2e8f0",
        },
      ]}
    >
      {/* PREVIEW FILES */}
      {files.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewContainer}
        >
          {files.map((file, index) => (
            <View
              key={index}
              style={[
                styles.previewItem,
                {
                  backgroundColor: isDark
                    ? "#1f2937"
                    : "#f1f5f9",
                },
              ]}
            >
              {file.type.startsWith(
                "image"
              ) ? (
                <Image
                  source={{ uri: file.uri }}
                  style={styles.imageThumb}
                />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.previewText,
                    {
                      color: isDark
                        ? "#fff"
                        : "#111",
                    },
                  ]}
                >
                  {file.name}
                </Text>
              )}

              <Pressable
                onPress={() =>
                  removeFile(index)
                }
                style={styles.removeBtn}
              >
                <X size={14} color="red" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* IMAGE BUTTON */}
      <Pressable
        onPress={pickImage}
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? "#1f2937"
              : "#f1f5f9",
          },
        ]}
      >
        <ImagePlus
          size={18}
          color={
            isDark
              ? "#cbd5e1"
              : "#475569"
          }
        />
      </Pressable>

      {/* INPUT */}
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: isDark
              ? "#0f172a"
              : "#f8fafc",
            borderColor: isDark
              ? "#334155"
              : "#e2e8f0",
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Soạn tin nhắn..."
          placeholderTextColor={
            placeholderColor
          }
          multiline
          style={[
            styles.input,
            {
              color: isDark
                ? "#f8fafc"
                : "#0f172a",
            },
          ]}
        />
      </View>

      {/* FILE BUTTON */}
      <Pressable
        onPress={pickFile}
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? "#1f2937"
              : "#f1f5f9",
          },
        ]}
      >
        <Text>📎</Text>
      </Pressable>

      {/* SEND BUTTON */}
      <Pressable
        onPress={handleSend}
        style={[
          styles.sendButton,
          {
            backgroundColor:
              value.trim().length > 0 ||
              files.length > 0
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

  // PREVIEW
  previewContainer: {
    position: "absolute",
    bottom: 60,
    left: 10,
    right: 10,
    flexDirection: "row",
  },

  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 10,
    marginRight: 6,
    maxWidth: 140,
    gap: 6,
  },

  previewText: {
    fontSize: 12,
  },

  imageThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },

  removeBtn: {
    marginLeft: 4,
  },
});