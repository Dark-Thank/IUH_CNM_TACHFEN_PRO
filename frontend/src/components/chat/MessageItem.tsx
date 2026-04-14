import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
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
    const { togglePinMessage } = useChatStore();
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

    const isOwn = message.isOwn;

    const { recallMessage } = useChatStore();
    
    const handleRecall = async () => {
        if (confirm('Thu hồi tin nhắn này?')) {
            try {
                await recallMessage(message._id);
            } catch (error) {
                console.error('Lỗi thu hồi:', error);
            }
        }
    };


    return (
        <>
            {/* time */}
            {isShowTime && (
                <span className="flex justify-center text-xs text-muted-foreground px-1">
                    {formatMessageTime(new Date(message.createdAt))}
                </span>
            )}

            <div
                data-message-id={message._id}
                className={cn(
                    "flex gap-1 message-bounce mt-1 relative group w-full",
                    isOwn ? "justify-end" : "justify-start"
                )}>
                
                {/* Avatar */}
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

                {/* Message container */}
                <div className={cn("flex items-start gap-1.5", isOwn ? "flex-row-reverse" : "flex-row")}>
                    
                    {/* Card tin nhắn */}
                    <Card
                        className={cn(
                            "px-4 py-2 inline-block max-w-[70vw]",
                            message.isRecalled 
                              ? "p-3 border rounded-lg bg-muted/50 shadow-sm text-muted-foreground" 
                              : "p-3 shadow-sm " + (isOwn ? "chat-bubble-sent border-0 bg-primary text-primary-foreground" : "chat-bubble-received")
                        )}>
                        {message.isRecalled ? (
                          <div className="text-sm italic text-center py-1">
                            <p>Tin nhắn đã thu hồi</p>
                            {message.recalledAt && (
                              <p className="text-xs opacity-75 mt-1">
                                {formatMessageTime(new Date(message.recalledAt))}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed break-words">{message.content}</p>
                        )}
                    </Card>

                    {/* 3 chấm */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 flex-shrink-0 self-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 rounded-full hover:bg-accent transition-all shadow-sm"
                            >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Tùy chọn</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-48">
                            <DropdownMenuItem onClick={() => togglePinMessage(message._id)}>
                                📌 {message.isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                            </DropdownMenuItem>
                            {isOwn && !message.isRecalled && (
                                <DropdownMenuItem 
                                    onClick={handleRecall}
                                    className="gap-2 text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Thu hồi tin nhắn
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Status badge */}
                    {isOwn && message._id === selectedConvo.lastMessage?._id && (
                        <div className="absolute -bottom-4 right-0">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[10px] px-1.5 py-0 h-4 border-0",
                                    lastMessageStatus === "seen"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                {lastMessageStatus}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

export default MessageItem

