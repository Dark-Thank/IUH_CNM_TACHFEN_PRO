import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { useSocketStore } from '@/stores/useSocketStore';
import type { Conversation } from "@/types/chat";
import { AtSign, ImagePlus, Mic, Paperclip, Send, Square, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from "../ui/input";
import EmmojiPicker from './EmmojiPicker';
import UserAvatar from './UserAvatar';

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

const AUDIO_MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
];

type VoiceDraft = {
    file: File;
    durationSeconds: number;
    previewUrl: string;
};

type MentionOption =
    | { type: "all"; id: "all"; label: string; insertText: string }
    | { type: "member"; id: string; label: string; avatarUrl?: string | null; insertText: string };

const getSupportedAudioMimeType = () => {
    if (typeof MediaRecorder === "undefined") {
        return "";
    }

    return AUDIO_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
};

const getAudioFileExtension = (mimeType: string) => {
    if (mimeType.includes("ogg")) {
        return "ogg";
    }

    if (mimeType.includes("mp4") || mimeType.includes("mpeg")) {
        return "m4a";
    }

    return "webm";
};

const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const MessageInput = ({
    selectedConvo,
    isBlocked: propIsBlocked,
    extraActions,
}: {
    selectedConvo: Conversation;
    isBlocked: boolean;
    extraActions?: ReactNode;
}) => {
    const { user } = useAuthStore();
    const { sendDirectMessage, sendGroupMessage, replyingMessage, clearReplyingMessage } = useChatStore();
    const { startTyping, stopTyping } = useSocketStore();

    const [isBlocked, setIsBlocked] = useState(false);
    const typingTimeoutRef = useRef<number | null>(null);
    const typingConversationIdRef = useRef(selectedConvo._id);
    const isTypingRef = useRef(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Sync the prop value to local state
    useEffect(() => {
        setIsBlocked(propIsBlocked);
    }, [propIsBlocked]);

    const [value, setValue] = useState("");
    const [selectionStart, setSelectionStart] = useState(0);
    const [files, setFiles] = useState<File[]>([]);
    const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isVoiceCaptureBusy, setIsVoiceCaptureBusy] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingStartedAtRef = useRef<number | null>(null);
    const recordingTimerRef = useRef<number | null>(null);
    const voiceCaptureBusyRef = useRef(false);
    const conversationType = String(selectedConvo.type ?? "").toLowerCase();
    const isGroupConversation =
        conversationType === "group" ||
        Boolean(selectedConvo.group?.name) ||
        selectedConvo.participants.length > 2;
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

    const showMentionPicker = !isBlocked && mentionOptions.length > 0;

    const stopTypingIndicator = (conversationId = typingConversationIdRef.current) => {
        if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        if (!isTypingRef.current) {
            return;
        }

        stopTyping(conversationId);
        isTypingRef.current = false;
    };

    useEffect(() => {
        const previousConversationId = typingConversationIdRef.current;

        if (previousConversationId !== selectedConvo._id) {
            stopTypingIndicator(previousConversationId);
            typingConversationIdRef.current = selectedConvo._id;
        }
    }, [selectedConvo._id]);

    useEffect(() => {
        if (isBlocked || !value.trim()) {
            stopTypingIndicator();
            return;
        }

        if (!isTypingRef.current) {
            startTyping(selectedConvo._id);
            isTypingRef.current = true;
        }

        if (typingTimeoutRef.current) {
            window.clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = window.setTimeout(() => {
            stopTypingIndicator();
        }, 1500);

        return () => {
            if (typingTimeoutRef.current) {
                window.clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        };
    }, [isBlocked, selectedConvo._id, startTyping, stopTyping, value]);

    useEffect(() => () => stopTypingIndicator(), []);

    const stopRecordingTimer = () => {
        if (recordingTimerRef.current) {
            window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
    };

    const setVoiceCaptureBusyState = (nextValue: boolean) => {
        voiceCaptureBusyRef.current = nextValue;
        setIsVoiceCaptureBusy(nextValue);
    };

    const clearRecorderResources = () => {
        stopRecordingTimer();

        recorderRef.current = null;
        chunksRef.current = [];
        recordingStartedAtRef.current = null;

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
    };

    const resetVoiceDraft = () => {
        setVoiceDraft((current) => {
            if (current) {
                URL.revokeObjectURL(current.previewUrl);
            }

            return null;
        });
    };

    useEffect(() => {
        return () => {
            if (recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
            }

            clearRecorderResources();
            resetVoiceDraft();
        };
    }, []);

    useEffect(() => {
        setValue("");
        setSelectionStart(0);
        setFiles([]);
        stopTypingIndicator();
        setValue("");
        setSelectionStart(0);
        setFiles([]);
        clearReplyingMessage();
        setIsRecording(false);
        setVoiceCaptureBusyState(false);
        setRecordingSeconds(0);

        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }

        clearRecorderResources();
        resetVoiceDraft();
    }, [clearReplyingMessage, selectedConvo._id]);

    useEffect(() => {
        if (replyingMessage && replyingMessage.conversationId !== selectedConvo._id) {
            clearReplyingMessage();
        }
    }, [clearReplyingMessage, replyingMessage, selectedConvo._id]);

    const startRecording = async () => {
        if (isBlocked) {
            return;
        }

        if (voiceCaptureBusyRef.current) {
            return;
        }

        if (files.length > 0) {
            toast.error("Hãy bỏ file đính kèm trước khi ghi âm.");
            return;
        }

        try {
            setVoiceCaptureBusyState(true);
            resetVoiceDraft();

            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedAudioMimeType();
            const recorder = mimeType
                ? new MediaRecorder(mediaStream, { mimeType })
                : new MediaRecorder(mediaStream);

            mediaStreamRef.current = mediaStream;
            recorderRef.current = recorder;
            chunksRef.current = [];
            recordingStartedAtRef.current = Date.now();
            setRecordingSeconds(0);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const startedAt = recordingStartedAtRef.current ?? Date.now();
                const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
                const resolvedMimeType = recorder.mimeType || mimeType || "audio/webm";
                const extension = getAudioFileExtension(resolvedMimeType);
                const blob = new Blob(chunksRef.current, { type: resolvedMimeType });

                if (blob.size > 0) {
                    const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: resolvedMimeType });
                    const previewUrl = URL.createObjectURL(blob);

                    setVoiceDraft({
                        file,
                        durationSeconds,
                        previewUrl,
                    });
                }

                setIsRecording(false);
                setRecordingSeconds(0);
                setVoiceCaptureBusyState(false);
                clearRecorderResources();
            };

            recorder.start();
            setIsRecording(true);
            recordingTimerRef.current = window.setInterval(() => {
                const startedAt = recordingStartedAtRef.current ?? Date.now();
                setRecordingSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
            }, 250);
        } catch (error) {
            console.error(error);
            toast.error("Không thể truy cập microphone.");
            clearRecorderResources();
            setIsRecording(false);
            setVoiceCaptureBusyState(false);
        }
    };

    const stopRecording = () => {
        if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
        }
    };

    const handleChangeText = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
        setSelectionStart(event.target.selectionStart ?? event.target.value.length);
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

        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
    };

    if (!user) return null;

    const sendMessage = async () => {
        if (voiceCaptureBusyRef.current || isRecording) {
            toast.error("Hãy dừng ghi âm trước khi gửi.");
            return;
        }

        if (!value.trim() && files.length === 0 && !voiceDraft) return;

        stopTypingIndicator();

        const formData = new FormData();
        formData.append("content", value);
        if (replyingMessage?._id) {
            formData.append("replyToMessageId", replyingMessage._id);
        }

        //  gửi đúng key backend
        files.forEach((file) => {
            formData.append("files", file);
        });

        if (voiceDraft) {
            formData.append("files", voiceDraft.file);
            formData.append("voiceDurationSeconds", String(voiceDraft.durationSeconds));
        }

        try {
            if (selectedConvo.type === "direct") {
                const otherUser = selectedConvo.participants.find(
                    (p) => p._id !== user._id
                );

                await sendDirectMessage(otherUser!._id, formData);
            } else {
                await sendGroupMessage(selectedConvo._id, formData);
            }

            setValue("");
            setSelectionStart(0);
            setFiles([]);
            resetVoiceDraft();
            clearReplyingMessage();

        } catch (error: any) {
            console.error(error);
            const serverMessage = error.response?.data?.message;

            // if (error.response?.status === 403) {
            //     setIsBlocked(true);
            //     toast.error("Bạn đã bị chặn");

            // toast.error("Lỗi gửi tin nhắn!");
            // Check if error is due to being blocked
            if (error.response?.status === 403 && error.response?.data?.message?.includes("chặn")) {
                setIsBlocked(true);
                // toast.error("Bạn đã bị chặn và không thể gửi tin nhắn");
            } else {
                toast.error(serverMessage || "Gửi tin nhắn thất bại!");
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    };

    const hasAttachments = files.length > 0 || Boolean(voiceDraft);
    const replySenderName = replyingMessage
        ? (replyingMessage.senderId === user._id
            ? "Bạn"
            : selectedConvo.participants.find((participant) => participant._id === replyingMessage.senderId)?.displayName || "Thành viên")
        : "";

    return (
        <div className="flex flex-col gap-2 p-3 bg-background">

            {replyingMessage && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-primary">Đang trả lời {replySenderName}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{getReplyPreviewContent(replyingMessage)}</p>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearReplyingMessage}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            )}

            {/*  PREVIEW FILE */}
            {files.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {files.map((file, idx) => {
                        const isImage = file.type.startsWith("image/");

                        return (
                            <div key={idx} className="relative">

                                {isImage ? (
                                    <img
                                        src={URL.createObjectURL(file)}
                                        className="w-20 h-20 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-20 h-20 flex items-center justify-center bg-gray-200 rounded text-xs text-center p-1">
                                        📄 {file.name}
                                    </div>
                                )}

                                <button
                                    onClick={() =>
                                        setFiles(files.filter((_, i) => i !== idx))
                                    }
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-1"
                                >
                                    x
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {voiceDraft && (
                <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Mic className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Tin nhắn thoại</p>
                        <div className="mt-1 flex items-center gap-3">
                            <audio controls src={voiceDraft.previewUrl} className="h-8 max-w-full" />
                            <span className="text-xs text-muted-foreground">{formatDuration(voiceDraft.durationSeconds)}</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={resetVoiceDraft}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            )}

            {isRecording && (
                <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="size-2 rounded-full bg-red-500" />
                        Đang ghi âm {formatDuration(recordingSeconds)}
                    </div>

                    <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
                        <Square className="mr-1 size-4" />
                        Dừng
                    </Button>
                </div>
            )}

            {/* INPUT */}
            <div className="flex items-center gap-2">

                {/*  CHỌN FILE */}
                {/* IMAGE */}
                <label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        disabled={isVoiceCaptureActive || Boolean(voiceDraft)}
                        onChange={(e) => {
                            const selected = Array.from(e.target.files || []);
                            setFiles((prev) => [...prev, ...selected]);
                        }}
                    />
                    <Button variant="ghost" size="icon" asChild disabled={isVoiceCaptureActive || Boolean(voiceDraft)}>
                        <span><ImagePlus className="size-4" /></span>
                    </Button>
                </label>

                {/* FILE */}
                <label>
                    <input
                        type="file"
                        multiple
                        hidden
                        disabled={isVoiceCaptureActive || Boolean(voiceDraft)}
                        onChange={(e) => {
                            const selected = Array.from(e.target.files || []);
                            setFiles((prev) => [...prev, ...selected]);
                        }}
                    />
                    <Button variant="ghost" size="icon" asChild disabled={isVoiceCaptureActive || Boolean(voiceDraft)}>
                        <span><Paperclip className="size-4" /></span>
                    </Button>
                </label>

                <Button
                    type="button"
                    variant={isRecording ? "destructive" : "ghost"}
                    size="icon"
                    disabled={Boolean(voiceDraft) || isBlocked || (isVoiceCaptureBusy && !isRecording)}
                    onClick={isRecording ? stopRecording : () => void startRecording()}
                >
                    {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
                </Button>

                {extraActions}

                {/* TEXT */}
                <div className="flex-1 relative">
                    {showMentionPicker && (
                        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg">
                            {mentionOptions.map((option) => (
                                <button
                                    key={`${option.type}-${option.id}`}
                                    type="button"
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        handleSelectMention(option);
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                                >
                                    {option.type === "all" ? (
                                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <AtSign className="size-4" />
                                        </span>
                                    ) : (
                                        <UserAvatar
                                            type="chat"
                                            name={option.label}
                                            avatarUrl={option.avatarUrl ?? undefined}
                                        />
                                    )}

                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">
                                            {option.label}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {option.type === "all" ? "Tag tat ca thanh vien" : "Thanh vien nhom"}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <Input
                        ref={inputRef}
                        value={value}
                        onChange={handleChangeText}
                        onSelect={(event) => {
                            setSelectionStart(event.currentTarget.selectionStart ?? value.length);
                        }}
                        onKeyDown={handleKeyPress}
                        placeholder={isBlocked ? "Bạn không thể nhắn tin..." : "Soạn tin nhắn..."}
                        disabled={isBlocked}
                        className="pr-20 h-9 bg-white"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <EmmojiPicker
                            onChange={(emoji: string) =>
                                setValue((prev) => prev + emoji)
                            }
                        />
                    </div>
                </div>

                {/* SEND */}
                <Button
                    onClick={sendMessage}
                    disabled={(!value.trim() && !hasAttachments) || isBlocked || isVoiceCaptureActive}
                >
                    <Send className="size-4 text-white" />
                </Button>
            </div>

        </div>
    );
};

export default MessageInput;
