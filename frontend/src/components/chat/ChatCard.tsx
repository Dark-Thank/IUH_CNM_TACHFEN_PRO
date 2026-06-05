import { Card } from "@/components/ui/card";
import { formatOnlineTime, cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pin, PinOff } from "lucide-react";

interface ChatCardProps {
  convoId: string;
  name: string;
  timestamp?: Date;
  isActive: boolean;
  isPinned?: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string) => void | Promise<void>;
  unreadCount?: number;
  leftSection: React.ReactNode;
  subtitle: React.ReactNode;
}

const ChatCard = ({
  convoId,
  name,
  timestamp,
  isActive,
  isPinned = false,
  onSelect,
  onTogglePin,
  unreadCount,
  leftSection,
  subtitle,
}: ChatCardProps) => {
  return (
    <Card
      key={convoId}
      className={cn(
        "group border-none p-3 cursor-pointer transition-smooth glass hover:bg-muted/30",
        isActive &&
          "ring-2 ring-primary/50 bg-gradient-to-tr from-primary-glow/10 to-primary-foreground"
      )}
      onClick={() => onSelect(convoId)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">{leftSection}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3
              className={cn(
                "font-semibold text-sm truncate",
                unreadCount && unreadCount > 0 && "text-foreground"
              )}
            >
              {name}
            </h3>

            <span className="text-xs text-muted-foreground">
              {timestamp ? formatOnlineTime(timestamp) : ""}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1 min-w-0">{subtitle}</div>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {isPinned && <Pin className="size-3.5 fill-current text-primary" />}

              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-muted/70 hover:text-foreground group-hover:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="min-w-40"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuItem
                    onClick={() => onTogglePin?.(convoId)}
                  >
                    {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    {isPinned ? "Bo ghim hoi thoai" : "Ghim hoi thoai"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChatCard;
