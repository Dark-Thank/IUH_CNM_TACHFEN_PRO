import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Conversation } from "@/types/chat";
import UserAvatar from "./UserAvatar";

type Props = {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
};

const GroupMembersModal = ({ open, onClose, conversation }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-border/70 bg-background/95 shadow-[var(--shadow-soft)] sm:max-w-md">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-foreground">
            Thành viên nhóm ({conversation.participants.length})
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Danh sách thành viên hiện có trong cuộc trò chuyện nhóm.
          </p>
        </DialogHeader>

        <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
          {conversation.participants.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2"
            >
              <UserAvatar
                type="sidebar"
                name={p.displayName || "TACHFEN"}
                avatarUrl={p.avatarUrl ?? undefined}
                className="size-10"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.displayName}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupMembersModal;