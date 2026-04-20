import { cn, formatMessageTime } from "@/lib/utils";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCallStore } from "@/stores/useCallStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation, Message, Participant } from "@/types/chat";
import { MoreVertical, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Play, Trash2, Video } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import RecallConfirmDialog from "./RecallConfirmDialog";
import UserAvatar from "./UserAvatar";


interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
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

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) => {
  const { togglePinMessage, deleteMessageForMe } = useChatStore();
  const { user } = useAuthStore();
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

  const isOwn = message.isOwn;
  const isCallMessage = message.messageType === "call" && Boolean(message.callMeta);
  const isVoice = isVoiceMessage(message);
  const voiceAttachment = getVoiceAttachment(message);
  const downloadableFiles = (message.fileUrls || []).filter((file) => file.url !== voiceAttachment?.url);

  const handleRecallCall = async () => {
    if (selectedConvo.type !== "direct" || !message.callMeta || currentCall) {
      return;
    }

    await startOutgoingCall(selectedConvo, message.callMeta.callType);
  };

  return (
    <>
      {/* TIME */}
      {isShowTime && (
        <span className="flex justify-center text-xs text-muted-foreground px-1">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      {/* MESSAGE WRAPPER */}
      <div
        data-message-id={message._id}
        className={cn(
          "flex gap-1 message-bounce mt-1 relative group w-full",
          isOwn ? "justify-end" : "justify-start"
        )}
      >
        {/* AVATAR */}
        {!isOwn && (
          <div className="w-8 flex-shrink-0">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={participant?.displayName ?? "Moji"}
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
          {/* MESSAGE CARD */}
          <Card
            className={cn(
              "px-4 py-2 inline-block max-w-[70vw]",
              message.isRecalled
                ? "p-3 border rounded-lg bg-muted/50 text-muted-foreground"
                : isCallMessage
                  ? "w-[min(22rem,70vw)] border bg-card text-card-foreground shadow-sm"
                : isVoice
                  ? "w-[min(24rem,72vw)] border bg-card text-card-foreground shadow-sm"
                : isOwn
                  ? "chat-bubble-sent border-0 bg-primary text-primary-foreground"
                  : "chat-bubble-received"
            )}
          >
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
            ) : message.deletedForUsers?.includes(user?._id || "") ? (
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
                  <p className="text-sm break-words text-muted-foreground">
                    {message.content}
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
            ) : (

              <>
                {/* TEXT */}
                {message.content && (
                  <p className="text-sm break-words">
                    {message.content}
                  </p>
                )}

                {/* IMAGES */}
                {(message.imgUrls || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(message.imgUrls || []).map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        className="max-w-[200px] rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
          {/* FILES */}
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
          {/* ACTION MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-center">
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
              <DropdownMenuItem
                onClick={() => togglePinMessage(message._id)}
              >
                📌 {message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
              </DropdownMenuItem>

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


          {/* STATUS */}
          {isOwn &&
            message._id === selectedConvo.lastMessage?._id && (
              <div className="absolute -bottom-4 right-0">
                <Badge variant="outline" className="text-[10px]">
                  {lastMessageStatus}
                </Badge>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default MessageItem;