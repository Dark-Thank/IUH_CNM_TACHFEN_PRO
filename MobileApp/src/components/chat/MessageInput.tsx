import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Conversation } from "@/types/chat";
import { Audio } from "expo-av";
import { AtSign, FileAudio, ImagePlus, Mic, Paperclip, Send, Sparkles, Square, Trash2, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import GroupFeatureBar from "./GroupFeatureBar";
import UserAvatar from "./UserAvatar";
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

type MentionOption =
  | { type: "all"; id: "all"; label: string; insertText: string }
  | { type: "member"; id: string; label: string; avatarUrl?: string | null; insertText: string };

// interface MessageInputProps {
// interface MessageInputProps {
//   selectedConvo: Conversation;
// }
interface Props {
  selectedConvo: Conversation;
  disabled?: boolean;
  extraActions?: ReactNode;
  smartReplies?: string[];
  smartReplyLoading?: boolean;
  canRequestSmartReplies?: boolean;
  onRequestSmartReplies?: () => void;
}


// export default function MessageInput({
//   selectedConvo,
// }: MessageInputProps) {

export default function MessageInput({
  selectedConvo,
  disabled,
  extraActions,
  smartReplies = [],
  smartReplyLoading = false,
  canRequestSmartReplies = false,
  onRequestSmartReplies,
}: Props) {

  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage, replyingMessage, clearReplyingMessage } =
    useChatStore();
  const { startTyping, stopTyping } = useSocketStore();
  const { isDark } = useThemeStore();

  const [value, setValue] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [voiceDraft, setVoiceDraft] = useState<FileItem | null>(null);
  const [sending, setSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingConversationIdRef = useRef(selectedConvo._id);
  const isTypingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceCaptureBusy, setIsVoiceCaptureBusy] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceCaptureBusyRef = useRef(false);

  const placeholderColor = isDark
    ? "#94a3b8"
    : "#64748b";
  const conversationType = String(selectedConvo.type ?? "").toLowerCase();
  const isGroupConversation =
    conversationType === "group" ||
    Boolean(selectedConvo.group?.name) ||
    selectedConvo.participants.length > 2;
  const hasComposerContent = value.trim().length > 0 || files.length > 0 || !!voiceDraft;
  const isVoiceCaptureActive = isVoiceCaptureBusy || isRecording;
  const mentionSearch = useMemo(() => {
    if (!isGroupConversation) {
      return null;
    }

    const cursorPosition = Math.min(selectionStart || value.length, value.length);
    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(^|\s)@([^@\s]*)$/);

    if (!match) {
      return null;
    }

    return {
      query: match[2].toLowerCase(),
      start: textBeforeCursor.length - match[2].length - 1,
      end: cursorPosition,
    };
  }, [isGroupConversation, selectionStart, value]);

  const mentionOptions = useMemo<MentionOption[]>(() => {
    if (!mentionSearch) {
      return [];
    }

    const options: MentionOption[] = [
      { type: "all", id: "all", label: "All", insertText: "@All" },
      ...selectedConvo.participants.map((participant) => ({
        type: "member" as const,
        id: participant._id,
        label: participant.displayName,
        avatarUrl: participant.avatarUrl,
        insertText: `@${participant.displayName}`,
      })),
    ];

    if (!mentionSearch.query) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(mentionSearch.query)
    );
  }, [mentionSearch, selectedConvo.participants]);

  const showMentionPicker = !disabled && mentionOptions.length > 0;

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

  const setVoiceCaptureBusyState = (nextValue: boolean) => {
    voiceCaptureBusyRef.current = nextValue;
    setIsVoiceCaptureBusy(nextValue);
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
    setSelectionStart(0);
    setVoiceDraft(null);
    clearReplyingMessage();
    setIsRecording(false);
    setVoiceCaptureBusyState(false);
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

  const handleChangeText = (nextValue: string) => {
    setValue(nextValue);
    setSelectionStart(nextValue.length);
  };

  const handleSelectMention = (option: MentionOption) => {
    if (!mentionSearch) {
      return;
    }

    const beforeMention = value.slice(0, mentionSearch.start);
    const afterMention = value.slice(mentionSearch.end);
    const shouldAddSpace = afterMention.length === 0 || !afterMention.startsWith(" ");
    const nextValue = `${beforeMention}${option.insertText}${shouldAddSpace ? " " : ""}${afterMention}`;
    const nextCursor = beforeMention.length + option.insertText.length + (shouldAddSpace ? 1 : 0);

    setValue(nextValue);
    setSelectionStart(nextCursor);
  };

  const handleSelectSmartReply = (reply: string) => {
    setValue(reply);
    setSelectionStart(reply.length);
  };

  const startRecording = async () => {
    if (disabled) {
      toast.error("Bạn không thể gửi tin nhắn trong cuộc trò chuyện này");
      return;
    }

    if (voiceCaptureBusyRef.current) {
      return;
    }

    if (files.length > 0) {
      toast.error("Hãy bỏ file đính kèm trước khi ghi âm");
      return;
    }

    try {
      setVoiceCaptureBusyState(true);
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        setVoiceCaptureBusyState(false);
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
      setVoiceCaptureBusyState(false);
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
      setVoiceCaptureBusyState(false);
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

    if (voiceCaptureBusyRef.current || isRecording) {
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
    setSelectionStart(0);

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
      setSelectionStart(trimmed.length);
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

      {(smartReplyLoading || smartReplies.length > 0) && !disabled ? (
        <View
          style={[
            styles.smartReplyBar,
            {
              backgroundColor: isDark ? "#111827" : "#f8fafc",
              borderColor: isDark ? "#334155" : "#e2e8f0",
            },
          ]}
        >
          {smartReplyLoading ? (
            <Text style={[styles.smartReplyStatus, { color: isDark ? "#94a3b8" : "#64748b" }]}>
              Dang tao goi y...
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {smartReplies.map((reply) => (
                <Pressable
                  key={reply}
                  onPress={() => handleSelectSmartReply(reply)}
                  style={[
                    styles.smartReplyChip,
                    {
                      backgroundColor: isDark ? "#312e81" : "#ede9fe",
                      borderColor: isDark ? "#6d28d9" : "#c4b5fd",
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.smartReplyText, { color: isDark ? "#ddd6fe" : "#5b21b6" }]}
                  >
                    {reply}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {showMentionPicker ? (
        <View
          style={[
            styles.mentionPicker,
            {
              backgroundColor: isDark ? "#111827" : "#ffffff",
              borderColor: isDark ? "#334155" : "#e2e8f0",
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            style={styles.mentionList}
          >
            {mentionOptions.map((option) => (
              <Pressable
                key={`${option.type}-${option.id}`}
                onPress={() => handleSelectMention(option)}
                style={({ pressed }) => [
                  styles.mentionRow,
                  {
                    backgroundColor: pressed
                      ? isDark ? "#1f2937" : "#f1f5f9"
                      : "transparent",
                  },
                ]}
              >
                {option.type === "all" ? (
                  <View style={[styles.mentionAllIcon, { backgroundColor: isDark ? "#312e81" : "#ede9fe" }]}>
                    <AtSign size={18} color={isDark ? "#ddd6fe" : "#6d28d9"} />
                  </View>
                ) : (
                  <UserAvatar
                    name={option.label}
                    avatarUrl={option.avatarUrl}
                    size={34}
                  />
                )}

                <View style={styles.mentionTextBlock}>
                  <Text
                    numberOfLines={1}
                    style={[styles.mentionName, { color: isDark ? "#f8fafc" : "#0f172a" }]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.mentionMeta, { color: isDark ? "#94a3b8" : "#64748b" }]}
                  >
                    {option.type === "all" ? "Tag tat ca thanh vien" : "Thanh vien nhom"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.composerRow}>

      {/* IMAGE BUTTON */}
      <Pressable
        onPress={pickImage}
        disabled={disabled || isVoiceCaptureActive || !!voiceDraft}
        style={[
          styles.iconButton,
          {
            backgroundColor: isDark
              ? "#1f2937"
              : "#f1f5f9",
            opacity: disabled || isVoiceCaptureActive || !!voiceDraft ? 0.5 : 1,
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
          onChangeText={handleChangeText}
          onSelectionChange={(event) => {
            setSelectionStart(event.nativeEvent.selection.start);
          }}
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

      {canRequestSmartReplies ? (
        <Pressable
          onPress={onRequestSmartReplies}
          disabled={disabled || smartReplyLoading}
          style={[
            styles.iconButton,
            {
              backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
              opacity: disabled || smartReplyLoading ? 0.5 : 1,
            },
          ]}
        >
          <Sparkles size={18} color={isDark ? "#ddd6fe" : "#7c3aed"} />
        </Pressable>
      ) : null}

      {isGroupConversation ? (
        <GroupFeatureBar
          conversationId={selectedConvo._id}
          disabled={disabled}
          mode="inline"
          extraMenuActions={[
            {
              key: "file",
              title: "Gửi tệp",
              description: "Chọn tài liệu hoặc tệp để gửi vào nhóm.",
              icon: <Paperclip size={18} color={isDark ? "#cbd5e1" : "#475569"} />,
              onPress: () => {
                void pickFile();
              },
            },
            {
              key: isRecording ? "stop-recording" : "record-voice",
              title: isRecording ? "Dừng ghi âm" : "Ghi âm",
              description: isRecording ? "Kết thúc bản ghi âm hiện tại." : "Tạo tin nhắn thoại cho nhóm.",
              icon: isRecording
                ? <Square size={18} color="#ffffff" fill="#ffffff" />
                : <Mic size={18} color={isDark ? "#cbd5e1" : "#475569"} />,
              onPress: () => {
                if (isRecording) {
                  void stopRecording();
                  return;
                }

                void startRecording();
              },
            },
          ]}
        />
      ) : (
        <>
          <Pressable
            onPress={pickFile}
            disabled={disabled || isVoiceCaptureActive || !!voiceDraft}
            style={[
              styles.iconButton,
              {
                backgroundColor: isDark
                  ? "#1f2937"
                  : "#f1f5f9",
                opacity: disabled || isVoiceCaptureActive || !!voiceDraft ? 0.5 : 1,
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
            disabled={disabled || !!voiceDraft || (isVoiceCaptureBusy && !isRecording)}
            style={[
              styles.iconButton,
              {
                backgroundColor: isRecording
                  ? "#ef4444"
                  : isDark
                    ? "#1f2937"
                    : "#f1f5f9",
                opacity: disabled || !!voiceDraft || (isVoiceCaptureBusy && !isRecording) ? 0.5 : 1,
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

          {extraActions}
        </>
      )}

      {/* SEND BUTTON */}
      {hasComposerContent ? (
        <Pressable
          onPress={handleSend}
          disabled={
            disabled ||
            sending ||
            isVoiceCaptureActive ||
            !hasComposerContent
          }
          style={[
            styles.sendButton,
            {
              backgroundColor:
                !disabled &&
                  !sending &&
                  !isVoiceCaptureActive &&
                  hasComposerContent
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
      ) : null}

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  smartReplyBar: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smartReplyStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  smartReplyChip: {
    maxWidth: 220,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  smartReplyText: {
    fontSize: 13,
    fontWeight: "700",
  },
  previewStack: {
    position: "absolute",
    bottom: 60,
    left: 10,
    right: 10,
    gap: 8,
    zIndex: 40,
    elevation: 40,
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
  mentionPicker: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 50,
    marginBottom: 10,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  mentionList: {
    maxHeight: 220,
  },
  mentionRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mentionAllIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  mentionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: "700",
  },
  mentionMeta: {
    marginTop: 2,
    fontSize: 12,
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
