import { useState } from "react";
import { normalizeSearchText } from "@/lib/messageSearch";
import { cn, formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation, Message, Participant, ReactionUser } from "@/types/chat";
import { MoreVertical, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Play, Send, Trash2, Video } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import AppointmentMessageCard from "./AppointmentMessageCard";
import PollMessageCard from "./PollMessageCard";
import RecallConfirmDialog from "./RecallConfirmDialog";
import UserAvatar from "./UserAvatar";

const MESSAGE_RECEIPT_LABELS = {
  sent: "Đã gửi",
  delivered: "Đã nhận",
  seen: "Đã xem",
} as const;

const MESSAGE_RECEIPT_STYLES: Record<MessageReceiptStatus, { chip: string; text: string }> = {
  sent: {
    chip: "bg-muted/70 border-border/70",
    text: "text-muted-foreground",
  },
  delivered: {
    chip: "bg-sky-500/10 border-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
  },
  seen: {
    chip: "bg-violet-500/10 border-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
  },
};

type MessageReceiptStatus = keyof typeof MESSAGE_RECEIPT_LABELS;

const ReceiptUserList = ({
  participants,
  emptyText,
}: {
  participants: Participant[];
  emptyText: string;
}) => {
  if (participants.length === 0) {
    return <p className="mt-1 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {participants.map((item) => (
        <div
          key={item._id}
          className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
        >
          <UserAvatar
            type="chat"
            name={item.displayName}
            avatarUrl={item.avatarUrl ?? undefined}
          />
          <span className="text-foreground">{item.displayName}</span>
        </div>
      ))}
    </div>
  );
};

const getReactionUsersLabel = (users: ReactionUser[], currentUserId?: string) => {
  if (users.length === 0) {
    return "Chưa có ai thả cảm xúc này.";
  }

  return users
    .map((item) => (item._id === currentUserId ? "Bạn" : item.displayName || "Thành viên"))
    .join(", ");
};

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  searchQuery?: string;
  isSearchFocused?: boolean;
  translation?: string;
  isTranslating?: boolean;
  onTranslateMessage?: (message: Message) => void;
}

const getCallTypeLabel = (callType?: "audio" | "video") =>
  callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";

const formatCallDuration = (seconds = 0) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((value) => value.toString().padStart(2, "0")).join(":");
  }

  return [minutes, remainingSeconds].map((value) => value.toString().padStart(2, "0")).join(":");
};

const getCallSummaryTitle = (message: Message, viewerId?: string) => {
  const callMeta = message.callMeta;

  if (!callMeta) {
    return message.content ?? "Cuộc gọi";
  }

  const typeLabel = getCallTypeLabel(callMeta.callType);
  const isCaller = callMeta.callerId === viewerId;

  switch (callMeta.outcome) {
    case "busy":
      return isCaller ? "Người nhận bận" : "Bạn đang bận";
    case "declined":
      return isCaller ? `${typeLabel} bị từ chối` : `Đã từ chối ${typeLabel.toLowerCase()}`;
    case "missed":
      return isCaller ? `${typeLabel} không được trả lời` : `${typeLabel} nhỡ`;
    case "cancelled":
      return `${typeLabel} đã hủy`;
    case "disconnected":
      return `${typeLabel} bị gián đoạn`;
    case "reconnect-timeout":
      return `${typeLabel} mất kết nối`;
    case "completed":
      return isCaller ? `${typeLabel} đi` : `${typeLabel} đến`;
    default:
      return typeLabel;
  }
};

const getCallDetailText = (message: Message) => {
  const callMeta = message.callMeta;

  if (!callMeta) {
    return message.content ?? "";
  }

  const baseLabel = getCallTypeLabel(callMeta.callType);

  if (callMeta.outcome === "completed") {
    return `${baseLabel} • ${formatCallDuration(callMeta.durationSeconds)}`;
  }

  return baseLabel;
};

const getCallIcon = (message: Message, viewerId?: string) => {
  const callMeta = message.callMeta;

  if (!callMeta) {
    return <Phone className="size-5 text-muted-foreground" />;
  }

  const isCaller = callMeta.callerId === viewerId;

  if (callMeta.outcome === "busy") {
    return <PhoneOff className="size-5 text-amber-500" />;
  }

  if (callMeta.outcome === "missed") {
    return <PhoneMissed className="size-5 text-rose-500" />;
  }

  if (callMeta.callType === "video") {
    return <Video className="size-5 text-sky-500" />;
  }

  if (callMeta.outcome === "completed") {
    return isCaller
      ? <PhoneOutgoing className="size-5 text-emerald-500" />
      : <PhoneIncoming className="size-5 text-emerald-500" />;
  }

  return <Phone className="size-5 text-muted-foreground" />;
};

const formatVoiceDuration = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const isVoiceMessage = (message: Message) => {
  if (message.messageType === "voice") {
    return true;
  }

  const audioFiles = (message.fileUrls || []).filter((file) => file.type?.startsWith("audio/"));
  return audioFiles.length === 1 && (message.imgUrls?.length ?? 0) === 0;
};

const getVoiceAttachment = (message: Message) =>
  message.fileUrls?.find((file) => file.type?.startsWith("audio/")) ?? null;

const getReplyPreviewContent = (replyTo?: Message["replyTo"]) => {
  const trimmedContent = typeof replyTo?.content === "string" ? replyTo.content.trim() : "";

  if (trimmedContent) {
    return trimmedContent;
  }

  if (replyTo?.messageType === "voice") {
    return "Tin nhắn thoại";
  }

  if (replyTo?.messageType === "call") {
    return "Cuộc gọi";
  }

  if ((replyTo?.imgUrls?.length ?? 0) > 0) {
    return replyTo?.imgUrls?.length === 1 ? "Ảnh đính kèm" : `${replyTo?.imgUrls?.length} ảnh đính kèm`;
  }

  if ((replyTo?.fileUrls?.length ?? 0) > 0) {
    return replyTo?.fileUrls?.length === 1 ? "Tệp đính kèm" : `${replyTo?.fileUrls?.length} tệp đính kèm`;
  }

  return "Tin nhắn";
};

const GROUP_NOTICE_PATTERN = /(đã tạo nhóm|đã thêm .+ vào nhóm|đã xóa .+ khỏi nhóm|đã rời nhóm|đã tham gia nhóm)/i;

const isGroupNoticeMessage = (message: Message, conversation: Conversation) => (
  conversation.type === "group"
  && message.messageType === "text"
  && typeof message.content === "string"
  && GROUP_NOTICE_PATTERN.test(message.content.trim())
  && !message.replyTo
  && !message.forwardedFrom
  && (message.imgUrls?.length ?? 0) === 0
  && (message.fileUrls?.length ?? 0) === 0
);

const renderHighlightedContent = (text: string, query: string, isFocused: boolean) => {
  if (!query.trim()) {
    return text;
  }

  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);

  if (!normalizedQuery || !normalizedText.includes(normalizedQuery)) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const plainQuery = query.trim().toLowerCase();
  const segments: { value: string; matched: boolean }[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(plainQuery, cursor);

    if (matchIndex < 0) {
      segments.push({ value: text.slice(cursor), matched: false });
      break;
    }

    if (matchIndex > cursor) {
      segments.push({ value: text.slice(cursor, matchIndex), matched: false });
    }

    segments.push({
      value: text.slice(matchIndex, matchIndex + plainQuery.length),
      matched: true,
    });

    cursor = matchIndex + plainQuery.length;
  }

  return segments.map((segment, index) =>
    segment.matched ? (
      <mark
        key={`${segment.value}-${index}`}
        className={cn(
          "rounded px-0.5 text-inherit",
          isFocused ? "bg-amber-300/80 text-foreground" : "bg-amber-200/60 text-inherit"
        )}
      >
        {segment.value}
      </mark>
    ) : (
      <span key={`${segment.value}-${index}`}>{segment.value}</span>
    )
  );
};

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  searchQuery = "",
  isSearchFocused = false,
  translation,
  isTranslating = false,
  onTranslateMessage,
}: MessageItemProps) => {
  const { user } = useAuthStore();
  const {
    conversations,
    forwardMessage,
    togglePinMessage,
    deleteMessageForMe,
    reactToMessage,
    setReplyingMessage,
    voteOnGroupPoll,
    addOptionToGroupPoll,
    closeGroupPoll,
    respondToGroupAppointment,
    deleteGroupAppointment,
  } = useChatStore();
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [reactionDialogEmoji, setReactionDialogEmoji] = useState<string | null>(null);
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const { currentCall, startOutgoingCall } = useCallStore();

  const handleDownloadFile = async (fileIndex: number, fileName: string) => {
    try {
      await chatService.downloadMessageFile(message._id, fileIndex, fileName);
    } catch (error) {
      console.error("Lỗi khi tải file:", error);
    }
  };

  const prev =
    index + 1 < messages.length ? messages[index + 1] : undefined;

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
    new Date(prev?.createdAt || 0).getTime() >
    300000;

  const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;

  const participant = selectedConvo.participants.find(
    (p: Participant) =>
      p._id.toString() === message.senderId.toString()
  );

  const isOwn = Boolean(message.isOwn);
  const isLastOwnMessage = isOwn && message._id === selectedConvo.lastMessage?._id;
  const isDeletedForCurrentUser = message.deletedForUsers?.includes(user?._id || "") ?? false;
  const isCallMessage = message.messageType === "call" && Boolean(message.callMeta);
  const isVoice = isVoiceMessage(message);
  const isPollMessage = message.messageType === "poll" && Boolean(message.pollMeta);
  const isAppointmentMessage = message.messageType === "appointment" && Boolean(message.appointmentMeta);
  const voiceAttachment = getVoiceAttachment(message);
  const downloadableFiles = (message.fileUrls || []).filter((file) => file.url !== voiceAttachment?.url);
  const hasCardContent = message.content || message.replyTo || message.forwardedFrom || downloadableFiles.length > 0 || message.isRecalled || isDeletedForCurrentUser || isCallMessage || isPollMessage || isAppointmentMessage || isVoice;
  const canForward = !message.isRecalled
    && !isDeletedForCurrentUser
    && !isPollMessage
    && !isAppointmentMessage
    && Boolean(message.content || message.imgUrls?.length || message.fileUrls?.length);
  const canReply = !message.isRecalled && !isDeletedForCurrentUser;
  const canTranslate = !isOwn
    && !message.isRecalled
    && !isDeletedForCurrentUser
    && typeof message.content === "string"
    && Boolean(message.content.trim());
  const availableConversations = conversations.filter(
    (conversation) => conversation._id !== message.conversationId
  );
  const replySenderName = message.replyTo
    ? (message.replyTo.senderId === user?._id
      ? "Bạn"
      : selectedConvo.participants.find((item) => item._id === message.replyTo?.senderId)?.displayName || "Thành viên")
    : "";
  const receiptTargets = selectedConvo.participants.filter((item) => item._id !== message.senderId);
  const deliveredSet = new Set((message.deliveredTo || []).map((item) => item.toString()));
  const seenSet = new Set((message.seenBy || []).map((item) => item.toString()));
  const seenParticipants = receiptTargets.filter((item) => seenSet.has(item._id));
  const deliveredOnlyParticipants = receiptTargets.filter(
    (item) => deliveredSet.has(item._id) && !seenSet.has(item._id)
  );
  const pendingParticipants = receiptTargets.filter((item) => !deliveredSet.has(item._id));
  const receiptStatus: MessageReceiptStatus = seenParticipants.length > 0
    ? "seen"
    : deliveredSet.size > 0
      ? "delivered"
      : "sent";
  const receiptProgress = receiptTargets.length > 1
    ? `${receiptStatus === "seen" ? seenParticipants.length : deliveredSet.size}/${receiptTargets.length}`
    : "";
  const receiptSummary = receiptProgress
    ? `${MESSAGE_RECEIPT_LABELS[receiptStatus]} ${receiptProgress}`
    : MESSAGE_RECEIPT_LABELS[receiptStatus];
  const canViewReceiptDetails = isOwn && selectedConvo.type === "group";
  const reactionEntries = Object.entries(message.reactions || {}).filter(([, users]) => users.length > 0);
  const activeReactionUsers = reactionDialogEmoji ? message.reactions?.[reactionDialogEmoji] || [] : [];
  const showTimeSeparator = isShowTime && !isLastOwnMessage;
  const messageFooterTime = formatMessageTime(new Date(message.createdAt));
  const receiptTone = MESSAGE_RECEIPT_STYLES[receiptStatus];
  const isGroupNotice = isGroupNoticeMessage(message, selectedConvo);

  const getConversationLabel = (conversation: Conversation) => {
    if (conversation.type === "group") {
      return conversation.group?.name || "Nhóm chat";
    }

    return (
      conversation.participants.find((participant) => participant._id !== user?._id)
        ?.displayName || "Cuộc trò chuyện trực tiếp"
    );
  };

  const handleForwardMessage = async (conversationId: string) => {
    try {
      setForwardingConversationId(conversationId);
      await forwardMessage(conversationId, message._id);
      setForwardDialogOpen(false);
    } catch (error) {
      console.error("Lỗi khi chuyển tiếp tin nhắn:", error);
    } finally {
      setForwardingConversationId(null);
    }
  };

  const handleRecallCall = async () => {
    if (selectedConvo.type !== "direct" || !message.callMeta || currentCall) {
      return;
    }

    await startOutgoingCall(selectedConvo, message.callMeta.callType);
  };

  const handleReact = async (emoji: string) => {
    await reactToMessage(message._id, emoji);
  };

  const handleReactionBadgeClick = async (emoji: string) => {
    if (selectedConvo.type === "group") {
      setReactionDialogEmoji(emoji);
      return;
    }

    await handleReact(emoji);
  };

  const handleReply = () => {
    setReplyingMessage(message);
  };

  const openReceiptDetails = () => {
    if (!canViewReceiptDetails) {
      return;
    }

    setReceiptDialogOpen(true);
  };

  const handleVotePoll = async (optionId: string) => {
    await voteOnGroupPoll(message._id, optionId);
  };

  const handleAddPollOption = async (text: string) => {
    await addOptionToGroupPoll(message._id, text);
  };

  const handleClosePoll = async () => {
    await closeGroupPoll(message._id);
  };

  const handleAppointmentResponse = async (status: "going" | "maybe" | "declined") => {
    await respondToGroupAppointment(message._id, status);
  };

  const handleDeleteAppointment = async () => {
    await deleteGroupAppointment(message._id);
  };

  const emojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

  if (isGroupNotice) {
    return (
      <>
        {showTimeSeparator && (
          <span className="flex justify-center px-1 text-xs text-muted-foreground">
            {formatMessageTime(new Date(message.createdAt))}
          </span>
        )}

        <div className="mt-2 flex justify-center px-4">
          <div className="max-w-[80%] rounded-full border border-border/70 bg-muted/60 px-4 py-2 text-center text-xs font-medium text-muted-foreground shadow-sm">
            {message.content}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* TIME */}
      {showTimeSeparator && (
        <span className="flex justify-center text-xs text-muted-foreground px-1">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      {/* MESSAGE WRAPPER */}
      <div
        data-message-id={message._id}
        className={cn(
          "flex gap-1 message-bounce mt-1 relative group w-full rounded-2xl transition",
          isSearchFocused && "ring-2 ring-amber-300/80 ring-offset-2 ring-offset-primary-foreground",
          isOwn ? "justify-end" : "justify-start"
        )}
      >
        {/* AVATAR */}
        {!isOwn && (
          <div className="w-8 shrink-0">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={participant?.displayName ?? "TACHFEN"}
                avatarUrl={participant?.avatarUrl ?? undefined}
              />
            )}
          </div>
        )}

        {/* CONTENT */}
        <div
          className={cn(
            "flex items-start gap-1.5",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* MESSAGE CARD + IMAGES WRAPPER */}
          <div className="flex flex-col gap-2">
            {/* MESSAGE CARD */}
            {hasCardContent && (
            <Card
            className={cn(
              "px-4 py-2 inline-block max-w-[70vw]",
              message.isRecalled
                ? "p-3 border rounded-lg bg-muted/50 text-muted-foreground"
                : isCallMessage
                  ? "w-[min(22rem,70vw)] border bg-card text-card-foreground shadow-sm"
                  : isPollMessage || isAppointmentMessage
                    ? "w-[min(24rem,72vw)] border bg-card text-card-foreground shadow-sm"
                    : isVoice
                      ? "w-[min(24rem,72vw)] border bg-card text-card-foreground shadow-sm"
                      : isOwn
                        ? "chat-bubble-sent border-0 bg-primary text-primary-foreground"
                        : "chat-bubble-received"
            )}
          >
            {reactionEntries.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {reactionEntries.map(([emoji, users]) => {
                  const reactedByMe = users.some((item) => item._id === user?._id);

                  return (
                    <button
                      key={emoji}
                      type="button"
                      title={getReactionUsersLabel(users, user?._id)}
                      onClick={() => void handleReactionBadgeClick(emoji)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition",
                        reactedByMe
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : "border-border/70 bg-muted/70 text-foreground hover:bg-muted"
                      )}
                    >
                      <span>{emoji}</span>
                      <span>{users.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {message.isRecalled ? (
              <div className="text-sm italic text-center py-1">
                <p>Tin nhắn đã thu hồi</p>
                {message.recalledAt && (
                  <p className="text-xs opacity-75 mt-1">
                    {formatMessageTime(
                      new Date(message.recalledAt)
                    )}
                  </p>
                )}
              </div>
            ) : isDeletedForCurrentUser ? (
              <div className="text-sm italic text-center py-1">
                <p>Bạn đã xóa tin nhắn này</p>
              </div>
            ) : isVoice && voiceAttachment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Play className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">Tin nhắn thoại</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatVoiceDuration(message.voiceMeta?.durationSeconds ?? 0)}
                    </p>
                  </div>
                </div>

                <audio controls preload="metadata" src={voiceAttachment.url} className="w-full max-w-full" />

                {message.content && (
                  <p className="text-sm wrap-break-word text-muted-foreground">
                    {renderHighlightedContent(message.content, searchQuery, isSearchFocused)}
                  </p>
                )}
              </div>
            ) : isCallMessage ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-full bg-muted">
                    {getCallIcon(message, user?._id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">
                      {getCallSummaryTitle(message, user?._id)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getCallDetailText(message)}
                    </p>
                  </div>
                </div>

                {selectedConvo.type === "direct" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2"
                    disabled={Boolean(currentCall)}
                    onClick={() => void handleRecallCall()}
                  >
                    <Phone className="size-4" />
                    Gọi lại
                  </Button>
                )}
              </div>
            ) : isPollMessage ? (
              <PollMessageCard
                message={message}
                viewerId={user?._id}
                participants={selectedConvo.participants}
                onVote={handleVotePoll}
                onAddOption={handleAddPollOption}
                onClose={handleClosePoll}
              />
            ) : isAppointmentMessage ? (
              <AppointmentMessageCard
                message={message}
                viewerId={user?._id}
                onRespond={handleAppointmentResponse}
                onDelete={handleDeleteAppointment}
              />
            ) : (
              <>
                {message.replyTo && (
                  <div className="mb-2 rounded-md border-l-2 border-current/30 bg-black/5 px-3 py-2 text-xs opacity-90">
                    <p className="font-semibold">{replySenderName}</p>
                    <p className="mt-1 line-clamp-2 wrap-break-word">{getReplyPreviewContent(message.replyTo)}</p>
                  </div>
                )}
                {message.forwardedFrom && (
                  <div className="mb-2 rounded-md border border-current/15 bg-black/5 px-2 py-1 text-xs font-medium opacity-80">
                    Đã chuyển tiếp
                  </div>
                )}
                {/* TEXT */}
                {message.content && (
                  <div className="space-y-1">
                    <p className="text-sm wrap-break-word">
                      {renderHighlightedContent(message.content, searchQuery, isSearchFocused)}
                    </p>
                    {(translation || isTranslating) && !isOwn && (
                      <p className={cn(
                        "border-t border-current/10 pt-1 text-xs leading-relaxed wrap-break-word",
                        isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
                      )}>
                        {translation || "Dang dich..."}
                      </p>
                    )}
                  </div>
                )}

                {downloadableFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {downloadableFiles.map((file) => {
                      const fileIndex = message.fileUrls?.findIndex((item) => item.url === file.url) ?? -1;

                      if (fileIndex < 0) {
                        return null;
                      }

                      return (
                        <button
                          key={file.url}
                          type="button"
                          onClick={() => void handleDownloadFile(fileIndex, file.name)}
                          className="block text-sm text-blue-500 underline text-left"
                        >
                          📎 {file.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
            )}

          {/* IMAGES - Outside Card */}
          {(message.imgUrls || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(message.imgUrls || []).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  onClick={() => setSelectedImageUrl(url)}
                  className="max-w-50 rounded-lg shadow-md object-cover cursor-pointer hover:opacity-80 transition"
                  alt={`Ảnh ${index + 1}`}
                />
              ))}
            </div>
          )}
          </div>

          {/* ACTION MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 shrink-0 self-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 rounded-full"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align={isOwn ? "end" : "start"}
              className="w-48"
            >
              {canReply && (
                <DropdownMenuItem onClick={handleReply}>
                  ↩ Trả lời
                </DropdownMenuItem>
              )}

              {canTranslate && (
                <DropdownMenuItem onClick={() => onTranslateMessage?.(message)}>
                  {translation ? "Dich lai tin nhan" : "Dich tin nhan"}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => togglePinMessage(message._id)}
              >
                📌 {message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
              </DropdownMenuItem>

              {canForward && (
                <DropdownMenuItem onClick={() => setForwardDialogOpen(true)}>
                  <Send className="h-4 w-4" />
                  Chuyển tiếp
                </DropdownMenuItem>
              )}

              {canViewReceiptDetails && (
                <DropdownMenuItem onClick={openReceiptDetails}>
                  Xem trạng thái
                </DropdownMenuItem>
              )}

              {/* {isOwn && !message.isRecalled && (
                <RecallConfirmDialog messageId={message._id}>
                  <DropdownMenuItem className="gap-2 text-destructive cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                    Thu hồi tin nhắn
                  </DropdownMenuItem>
                </RecallConfirmDialog>
              )} */}
              {isOwn && !message.isRecalled && (
                <DropdownMenuItem
                  className="p-0" // Xóa padding của menu item để con nó chiếm hết diện tích
                  onSelect={(e) => e.preventDefault()} // NGĂN MENU ĐÓNG LẠI
                >
                  <RecallConfirmDialog messageId={message._id}>
                    <div className="flex items-center gap-2 px-2 py-1.5 text-destructive cursor-pointer w-full">
                      <Trash2 className="h-4 w-4" />
                      Thu hồi tin nhắn
                    </div>
                  </RecallConfirmDialog>
                </DropdownMenuItem>
              )}
              {!message.isRecalled && (
                <DropdownMenuItem
                  className="gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  onClick={async (e) => {
                    e.preventDefault();
                    await deleteMessageForMe(message._id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa tin nhắn
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLastOwnMessage ? (
        <div className="mt-1 flex items-center justify-end gap-1.5 pr-9 text-[11px] leading-none text-muted-foreground">
          <span>{messageFooterTime}</span>
          <span className="opacity-50">•</span>
          {canViewReceiptDetails ? (
            <button
              type="button"
              onClick={openReceiptDetails}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 font-medium transition",
                receiptTone.chip,
                receiptTone.text,
                "hover:opacity-80"
              )}
            >
              {receiptSummary}
            </button>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 font-medium",
                receiptTone.chip,
                receiptTone.text
              )}
            >
              {receiptSummary}
            </span>
          )}
        </div>
      ) : null}

      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chuyển tiếp tin nhắn</DialogTitle>
            <DialogDescription>
              Chọn cuộc trò chuyện đích để gửi lại tin nhắn này.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {availableConversations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Chưa có cuộc trò chuyện nào khác để chuyển tiếp.
              </div>
            ) : (
              availableConversations.map((conversation) => (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => void handleForwardMessage(conversation._id)}
                  disabled={forwardingConversationId === conversation._id}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div>
                    <p className="text-sm font-medium">{getConversationLabel(conversation)}</p>
                    <p className="text-xs text-muted-foreground">
                      {conversation.type === "group" ? "Nhóm" : "Trò chuyện trực tiếp"}
                    </p>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {forwardingConversationId === conversation._id ? "Đang gửi..." : "Chọn"}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trạng thái tin nhắn</DialogTitle>
            <DialogDescription>
              Theo dõi thành viên nào đã nhận và đã xem tin nhắn trong nhóm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p>{message.content || "Tin nhắn đính kèm"}</p>
              <p className="mt-1 text-xs">{messageFooterTime}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">Đã xem ({seenParticipants.length})</p>
                <ReceiptUserList
                  participants={seenParticipants}
                  emptyText="Chưa có ai xem tin nhắn này."
                />
              </div>

              <div>
                <p className="font-semibold text-foreground">Đã nhận ({deliveredOnlyParticipants.length})</p>
                <ReceiptUserList
                  participants={deliveredOnlyParticipants}
                  emptyText="Chưa có ai chỉ mới nhận mà chưa xem."
                />
              </div>

              <div>
                <p className="font-semibold text-foreground">Đã gửi ({pendingParticipants.length})</p>
                <ReceiptUserList
                  participants={pendingParticipants}
                  emptyText="Tất cả thành viên còn lại đã nhận tin nhắn này."
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reactionDialogEmoji)}
        onOpenChange={(open) => {
          if (!open) {
            setReactionDialogEmoji(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Phản ứng {reactionDialogEmoji ?? ""}
            </DialogTitle>
            <DialogDescription>
              {activeReactionUsers.length} thành viên đã thả cảm xúc này trong nhóm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {activeReactionUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có ai thả cảm xúc này.</p>
            ) : (
              activeReactionUsers.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
                >
                  <UserAvatar
                    type="chat"
                    name={item.displayName}
                    avatarUrl={item.avatarUrl ?? undefined}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item._id === user?._id ? "Bạn" : item.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">Đã thả {reactionDialogEmoji}</p>
                  </div>
                </div>
              ))
            )}

            {reactionDialogEmoji ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void handleReact(reactionDialogEmoji)}
              >
                {activeReactionUsers.some((item) => item._id === user?._id)
                  ? `Bỏ ${reactionDialogEmoji}`
                  : `Thả ${reactionDialogEmoji}`}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedImageUrl)} onOpenChange={(open) => {
        if (!open) {
          setSelectedImageUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 border-0 bg-black/90">
          <div className="relative w-full h-full flex items-center justify-center">
            {selectedImageUrl && (
              <img
                src={selectedImageUrl}
                alt="Xem chi tiết ảnh"
                className="w-full h-full object-contain max-w-full max-h-[85vh] rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageItem;
