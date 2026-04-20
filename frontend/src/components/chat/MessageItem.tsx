import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Badge } from "../ui/badge";
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
import { Button } from "../ui/button";
import { MoreVertical, Send, Trash2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import RecallConfirmDialog from "./RecallConfirmDialog";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatServiec";

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
}

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
}: MessageItemProps) => {
  const { user } = useAuthStore();
  const { conversations, forwardMessage, togglePinMessage } = useChatStore();
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardingConversationId, setForwardingConversationId] = useState<string | null>(null);

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
  const canForward = !message.isRecalled && Boolean(
    message.content || message.imgUrls?.length || message.fileUrls?.length
  );
  const availableConversations = conversations.filter(
    (conversation) => conversation._id !== message.conversationId
  );

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
            ) : (
              <>
                {message.forwardedFrom && (
                  <div className="mb-2 rounded-md border border-current/15 bg-black/5 px-2 py-1 text-xs font-medium opacity-80">
                    Đã chuyển tiếp
                  </div>
                )}
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
          {/* FILES */}
          {(message.fileUrls || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {message.fileUrls!.map((file, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => void handleDownloadFile(index, file.name)}
                  className="block text-sm text-blue-500 underline text-left"
                >
                  📎 {file.name}
                </button>
              ))}
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

              {canForward && (
                <DropdownMenuItem onClick={() => setForwardDialogOpen(true)}>
                  <Send className="h-4 w-4" />
                  Chuyển tiếp
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
    </>
  );
};

export default MessageItem;