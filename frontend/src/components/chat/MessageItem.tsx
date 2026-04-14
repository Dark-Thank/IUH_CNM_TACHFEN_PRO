import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import UserAvatar from "./UserAvatar";


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
    const prev = index + 1 < messages.length ? messages[index + 1] : undefined;

    const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000; // 5 phút

    const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;



    const participant = selectedConvo.participants.find(
        (p: Participant) => p._id.toString() === message.senderId.toString()
    );
    return (
        <>
        {/* time */}
                {isShowTime && (
                    <span className="flex justify-center text-xs text-muted-foreground px-1">
                        {formatMessageTime(new Date(message.createdAt))}
                    </span>
                )}
                <div
            className={cn(
                "flex gap-2 message-bounce mt-1",
                message.isOwn ? "justify-end" : "justify-start"
            )}
        >
            {/* avatar */}
            {!message.isOwn && (
                <div className="w-8">
                    {isGroupBreak && (
                        <UserAvatar
                            type="chat"
                            name={participant?.displayName ?? "Moji"}
                            avatarUrl={participant?.avatarUrl ?? undefined}
                        />
                    )}
                </div>
            )}

            {/* tin nhắn */}
            <div
                className={cn(
                    "max-w-xs lg:max-w-md space-y-1 flex flex-col",
                    message.isOwn ? "items-end" : "items-start"
                )}
            >
                <Card
                    className={cn(
                        "p-3",
                        message.isOwn ? "chat-bubble-sent border-0" : "chat-bubble-received"
                    )}
                >
                    <div className="text-sm leading-relaxed break-words">
  {message.content && <p>{message.content}</p>}

  {message.imgUrls?.length > 0 &&
  message.imgUrls.map((url, index) => (
    <img
      key={index}
      src={url}
      alt="image"
      className="mt-2 max-w-[200px] rounded-lg object-cover"
    />
  ))
}
</div>
                </Card>

                


                {/* seen/ delivered */}
                {selectedConvo.type === "direct" &&
  message.isOwn &&
  message._id === selectedConvo.lastMessage?._id &&
  message.content &&  (
    <Badge>
      {lastMessageStatus}
    </Badge>
)}
            </div>
        </div>
        </>
    )
}

export default MessageItem