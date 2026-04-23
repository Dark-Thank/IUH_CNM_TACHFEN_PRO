import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Conversation } from "@/types/chat";

type Props = {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
};

const GroupMembersModal = ({ open, onClose, conversation }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Thành viên nhóm ({conversation.participants.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {conversation.participants.map((p) => (
            <div key={p._id} className="flex items-center gap-3">
              <img
                src={p.avatarUrl || "/default-avatar.png"}
                className="size-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium">{p.displayName}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupMembersModal;