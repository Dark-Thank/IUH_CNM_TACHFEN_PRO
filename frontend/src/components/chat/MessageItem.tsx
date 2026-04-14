import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { MoreVertical, Trash2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useChatStore } from "@/stores/useChatStore";

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
  const { togglePinMessage, recallMessage } = useChatStore();

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

  const handleRecall = async () => {
    if (confirm("Thu hồi tin nhắn này?")) {
      try {
        await recallMessage(message._id);
      } catch (error) {
        console.error("Lỗi thu hồi:", error);
      }
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
                {/* TEXT */}
                {message.content && (
                  <p className="text-sm break-words">
                    {message.content}
                  </p>
                )}

                {/* IMAGES */}
                {message.imgUrls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.imgUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt="image"
                        className="max-w-[200px] rounded-lg object-cover cursor-pointer hover:scale-105 transition"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

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

              {isOwn && !message.isRecalled && (
                <DropdownMenuItem
                  onClick={handleRecall}
                  className="gap-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Thu hồi tin nhắn
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