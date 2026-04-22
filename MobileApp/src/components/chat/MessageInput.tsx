import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { Audio } from "expo-av";
import { FileAudio, ImagePlus, Mic, Paperclip, Send, Square, Trash2, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import VoiceMessagePlayer from "./VoiceMessagePlayer";

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

const getReplyPreviewContent = (message?: { content?: string | null; messageType?: string; imgUrls?: string[]; fileUrls?: { url: string }[] }) => {
  const trimmedContent = typeof message?.content === "string" ? message.content.trim() : "";

  if (trimmedContent) {
    return trimmedContent;
  }

  if (message?.messageType === "voice") {
    return "Tin nhắn thoại";
  }

  if (message?.messageType === "call") {
    return "Cuộc gọi";
  }

  if ((message?.imgUrls?.length ?? 0) > 0) {
    return message?.imgUrls?.length === 1 ? "Ảnh đính kèm" : `${message?.imgUrls?.length} ảnh đính kèm`;
  }

  if ((message?.fileUrls?.length ?? 0) > 0) {
    return message?.fileUrls?.length === 1 ? "Tệp đính kèm" : `${message?.fileUrls?.length} tệp đính kèm`;
  }

  return "Tin nhắn";
};

interface FileItem {
  uri: string;
  name: string;
  type: string;
  voiceDurationSeconds?: number;
}

// interface MessageInputProps {
// interface MessageInputProps {
//   selectedConvo: Conversation;
// }
interface Props {
  selectedConvo: Conversation;
  disabled?: boolean;
}


// export default function MessageInput({
//   selectedConvo,
// }: MessageInputProps) {

export default function MessageInput({ selectedConvo, disabled }: Props) {

  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage, replyingMessage, clearReplyingMessage } =
    useChatStore();
  const { startTyping, stopTyping } = useSocketStore();
  const { isDark } = useThemeStore();

  const [value, setValue] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [voiceDraft, setVoiceDraft] = useState<FileItem | null>(null);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingConversationIdRef = useRef(selectedConvo._id);
  const isTypingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const placeholderColor = isDark
    ? "#94a3b8"
    : "#64748b";

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
    Audio.requestPermissionsAsync();
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

  const stopTypingIndicator = (conversationId = typingConversationIdRef.current) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!isTypingRef.current) {
      return;
    }

    stopTyping(conversationId);
    isTypingRef.current = false;
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      void Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    stopRecordingTimer();
    void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    recordingRef.current = null;
    recordingStartedAtRef.current = null;
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => undefined);

    setFiles([]);
    setValue("");
    setVoiceDraft(null);
    clearReplyingMessage();
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [clearReplyingMessage, selectedConvo._id]);

  useEffect(() => {
    if (replyingMessage && replyingMessage.conversationId !== selectedConvo._id) {
      clearReplyingMessage();
    }
  }, [clearReplyingMessage, replyingMessage, selectedConvo._id]);

  useEffect(() => {
    const previousConversationId = typingConversationIdRef.current;

    if (previousConversationId !== selectedConvo._id) {
      stopTypingIndicator(previousConversationId);
      typingConversationIdRef.current = selectedConvo._id;
    }
  }, [selectedConvo._id]);

  useEffect(() => {
    if (disabled || !value.trim()) {
      stopTypingIndicator();
      return;
    }

    if (!isTypingRef.current) {
      startTyping(selectedConvo._id);
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTypingIndicator();
    }, 1500);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [disabled, selectedConvo._id, startTyping, stopTyping, value]);

  useEffect(() => () => stopTypingIndicator(), []);

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

  const removeVoiceDraft = () => {
    setVoiceDraft(null);
  };

  const startRecording = async () => {
    if (disabled) {
      toast.error("Bạn không thể gửi tin nhắn trong cuộc trò chuyện này");
      return;
    }

    if (files.length > 0) {
      toast.error("Hãy bỏ file đính kèm trước khi ghi âm");
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        toast.error("Bạn cần cấp quyền microphone để ghi âm");
        return;
      }

      setVoiceDraft(null);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current ?? Date.now();
        setRecordingSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250);
    } catch (error) {
      console.error(error);
      toast.error("Không thể bắt đầu ghi âm");
      stopRecordingTimer();
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const recording = recordingRef.current;

      if (!recording) {
        return;
      }

      stopRecordingTimer();
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const uri = recording.getURI();
      const startedAt = recordingStartedAtRef.current ?? Date.now();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

      if (uri) {
        setVoiceDraft({
          uri,
          name: `voice-${Date.now()}.m4a`,
          type: "audio/mp4",
          voiceDurationSeconds: durationSeconds,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Không thể dừng ghi âm");
    } finally {
      recordingRef.current = null;
      recordingStartedAtRef.current = null;
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  // ======================
  // SEND MESSAGE
  // ======================
  const handleSend = async () => {
    if (disabled) {
      toast.error("Bạn không thể gửi tin nhắn trong cuộc trò chuyện này");
      return;
    }

    if (sending) return;

    const trimmed = value.trim();

    if (isRecording) {
      toast.error("Hãy dừng ghi âm trước khi gửi");
      return;
    }

    if (!trimmed && files.length === 0 && !voiceDraft)
      return;

    stopTypingIndicator();



    // if (!trimmed || sending) {
    //   return;
    // }

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
          voiceDraft ? [voiceDraft] : files,
          voiceDraft?.voiceDurationSeconds
        );
      } else {
        await sendGroupMessage(
          selectedConvo._id,
          trimmed,
          voiceDraft ? [voiceDraft] : files,
          voiceDraft?.voiceDurationSeconds
        );
      }

      setFiles([]);
      setVoiceDraft(null);
      clearReplyingMessage();
    } catch (error) {
      console.error(error);
      setValue(trimmed);
      const serverMessage = (error as any)?.response?.data?.message;
      toast.error(
        serverMessage || "Gửi tin nhắn thất bại"
      );
    } finally {
      setSending(false);

      // setSending(true);
      // setValue("");

      // try {
      //   if (selectedConvo.type === "direct") {
      //     if (!otherUser) {
      //       throw new Error("Không tìm thấy người nhận.");
      //     }

      //     await sendDirectMessage(otherUser._id, trimmed);
      //   } else {
      //     await sendGroupMessage(selectedConvo._id, trimmed);

      //   }
      // } catch (error) {
      //   console.error(error);
      //   setValue(trimmed);
      //   toast.error("Gửi tin nhắn thất bại. Hãy thử lại.");
      // } finally {
      // setSending(false);
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
      <View pointerEvents="box-none" style={styles.previewStack}>
        {replyingMessage ? (
          <View
            style={[
              styles.replyPreviewBar,
              {
                backgroundColor: isDark ? "#111827" : "#eef2ff",
                borderColor: isDark ? "#334155" : "#c7d2fe",
              },
            ]}
          >
            <View style={styles.replyPreviewContent}>
              <Text style={[styles.replyPreviewLabel, { color: isDark ? "#c4b5fd" : "#4f46e5" }]}>
                Đang trả lời {replyingMessage.senderId === user._id ? "Bạn" : selectedConvo.participants.find((participant) => participant._id === replyingMessage.senderId)?.displayName || "Thành viên"}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.replyPreviewText, { color: isDark ? "#cbd5e1" : "#475569" }]}
              >
                {getReplyPreviewContent(replyingMessage)}
              </Text>
            </View>

            <Pressable onPress={clearReplyingMessage} style={styles.replyPreviewClose}>
              <X size={16} color={isDark ? "#f8fafc" : "#475569"} />
            </Pressable>
          </View>
        ) : null}

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

        {voiceDraft && (
          <View
            style={[
              styles.voicePreview,
              {
                backgroundColor: isDark ? "#111827" : "#ffffff",
                borderColor: isDark ? "#334155" : "#e2e8f0",
              },
            ]}
          >
            <View style={styles.voicePreviewHeader}>
              <View style={styles.voicePreviewTitleWrap}>
                <FileAudio size={16} color={isDark ? "#c084fc" : "#8b5cf6"} />
                <Text style={[styles.voicePreviewTitle, { color: isDark ? "#f8fafc" : "#0f172a" }]}>Tin nhắn thoại</Text>
              </View>

              <Pressable onPress={removeVoiceDraft} style={styles.removeVoiceButton}>
                <Trash2 size={16} color={isDark ? "#f8fafc" : "#475569"} />
              </Pressable>
            </View>

            <VoiceMessagePlayer
              uri={voiceDraft.uri}
              durationSeconds={voiceDraft.voiceDurationSeconds}
            />
          </View>
        )}

        {isRecording && (
          <View
            style={[
              styles.recordingBanner,
              { backgroundColor: isDark ? "#3f1d24" : "#fef2f2", borderColor: isDark ? "#7f1d1d" : "#fecaca" },
            ]}
          >
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={[styles.recordingText, { color: isDark ? "#fecaca" : "#b91c1c" }]}>Đang ghi âm {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}</Text>
            </View>

            <Pressable onPress={() => void stopRecording()} style={styles.stopRecordingButton}>
              <Square size={16} color="#ffffff" fill="#ffffff" />
            </Pressable>
          </View>
        )}
      </View>

      {/* IMAGE BUTTON */}
      <Pressable
        onPress={pickImage}
        disabled={disabled || isRecording || !!voiceDraft}
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? "#1f2937"
              : "#f1f5f9",
            opacity: disabled || isRecording || !!voiceDraft ? 0.5 : 1,
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
        disabled={disabled || isRecording || !!voiceDraft}
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? "#1f2937"
              : "#f1f5f9",
            opacity: disabled || isRecording || !!voiceDraft ? 0.5 : 1,
          },
        ]}
      >
        <Paperclip
          size={18}
          color={
            isDark
              ? "#cbd5e1"
              : "#475569"
          }
        />
      </Pressable>

      <Pressable
        onPress={isRecording ? () => void stopRecording() : () => void startRecording()}
        disabled={disabled || !!voiceDraft}
        style={[
          styles.iconButton,
          {
            backgroundColor: isRecording
              ? "#ef4444"
              : isDark
                ? "#1f2937"
                : "#f1f5f9",
            opacity: disabled || !!voiceDraft ? 0.5 : 1,
          },
        ]}
      >
        {isRecording ? (
          <Square size={18} color="#ffffff" fill="#ffffff" />
        ) : (
          <Mic
            size={18}
            color={
              isDark
                ? "#cbd5e1"
                : "#475569"
            }
          />
        )}
      </Pressable>

      {/* SEND BUTTON */}
      <Pressable
        onPress={handleSend}
        disabled={
          disabled ||
          sending ||
          isRecording ||
          (value.trim().length === 0 && files.length === 0 && !voiceDraft)
        }
        style={[
          styles.sendButton,
          {
            backgroundColor:
              !disabled &&
                !sending &&
                !isRecording &&
                (value.trim().length > 0 || files.length > 0 || !!voiceDraft)
                ? isDark
                  ? "#a855f7"
                  : "#8b5cf6"
                : isDark
                  ? "#374151"
                  : "#cbd5e1",
          },
        ]}
      >
        {/* <TextInput
  value={value}
  onChangeText={setValue}
  placeholder={
    disabled
      ? "Bạn không thể trả lời cuộc trò chuyện này"
      : "Soạn tin nhắn..."
  }
  editable={!disabled}
  placeholderTextColor={placeholderColor}
  multiline
  style={[
    styles.input,
    {
      color: disabled
        ? "#9ca3af"
        : isDark
        ? "#f8fafc"
        : "#0f172a",
    },
  ]}
/> */}
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
  previewStack: {
    position: "absolute",
    bottom: 60,
    left: 10,
    right: 10,
    gap: 8,
  },
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  replyPreviewContent: {
    flex: 1,
    marginRight: 12,
  },
  replyPreviewLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
  },
  replyPreviewClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
  voicePreview: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  voicePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voicePreviewTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voicePreviewTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  removeVoiceButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingBanner: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ef4444",
  },
  recordingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  stopRecordingButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
});