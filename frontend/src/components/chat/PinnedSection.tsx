import { useChatStore } from "@/stores/useChatStore";
import type { Message } from "@/types/chat";
import { ChevronDown, MessageCircle, MoreVertical, Pin } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent } from "../ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const getPinnedMessagePreview = (message: Message) => {
  if (message.messageType === "voice") {
    return "Tin nhắn thoại";
  }

  if (message.messageType === "call") {
    return message.content ?? "Cuộc gọi";
  }

  if ((message.content ?? "").trim()) {
    const normalized = message.content ?? "";
    return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
  }

  if ((message.imgUrls ?? []).length > 0) {
    return "Ảnh đính kèm";
  }

  if ((message.fileUrls ?? []).length > 0) {
    return "Tệp đính kèm";
  }

  return "Tin nhắn";
};

interface PinnedSectionProps {
  pinnedMessages: Message[];
  onJump: (id: string) => void;
}

export default function PinnedSection({ pinnedMessages, onJump }: PinnedSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const togglePinMessage = useChatStore((state) => state.togglePinMessage);

  if (pinnedMessages.length === 0) return null;

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className="mb-4 w-full"
    >
      <Button 
        className="w-full justify-start h-auto p-3 hover:bg-accent/50 gap-2 text-sm border rounded-lg data-[state=open]:rounded-b-none data-[state=open]:bg-accent/20"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Pin className="w-4 h-4" />
        <span>Tin nhắn đã ghim ({pinnedMessages.length})</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
      </Button>
      <CollapsibleContent className="space-y-1 p-3 bg-muted/30 rounded-b-lg border border-t-0 -mt-px">
        {pinnedMessages.slice(0, 10).map((message) => (
          <div key={message._id} className="relative group flex gap-3 p-4 hover:bg-accent/50 rounded-xl transition-colors cursor-pointer items-start border hover:border-primary/50" onClick={() => onJump(message._id)}>
<div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/50 rounded-full flex items-center justify-center shadow-md">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-semibold text-sm truncate leading-tight">
                {getPinnedMessagePreview(message)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="absolute right-4 top-4 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full hover:bg-background transition-all shadow-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinMessage(message._id);
                  }}
                  className="cursor-pointer"
                >
                  📌 Bỏ ghim tin nhắn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {pinnedMessages.length > 10 && (
          <div className="text-center py-4 text-xs text-muted-foreground border-t mt-2 pt-2 bg-background rounded-lg">
            + {pinnedMessages.length - 10} tin nhắn khác
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
