import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatService } from "@/services/chatServiec";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { useRef, useState } from "react";
import GroupMembersModal from "./GroupMembersModal";
import UserAvatar from "./UserAvatar";
type Props = {
  conversation: Conversation;
};
const ConversationSettings = ({ conversation }: Props) => {
  if (!conversation) return null
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openMembers, setOpenMembers] = useState(false);
  const [openRename, setOpenRename] = useState(false);
  const [newName, setNewName] = useState(conversation.group?.name || "");
  const [loadingRename, setLoadingRename] = useState(false);
  const isGroupConversation = conversation.type === "group";
  const directParticipant = isGroupConversation
    ? null
    : conversation.participants.find((participant) => participant._id !== user?._id) ?? conversation.participants[0] ?? null;

  const handlePickAvatar = () => {
    if (!isGroupConversation) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleRenameGroup = async () => {
    if (!isGroupConversation || !newName.trim()) return;

    try {
      setLoadingRename(true);

      const res = await chatService.renameGroup(
        conversation._id,
        newName
      );

      useChatStore.getState().updateConversation({
        _id: conversation._id,
        group: {
          ...conversation.group,
          name: res.conversation.group.name,
        },
      });

      setOpenRename(false);
    } catch (err) {
      console.error("Rename error:", err);
    } finally {
      setLoadingRename(false);
    }
  };
  const handleChangeAvatar = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!isGroupConversation) {
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    try {
      setUploading(true);
      const updated = await chatService.updateGroupAvatar(conversation._id, file);

      //  update lại store
      useChatStore.getState().updateConversation({
        _id: conversation._id,
        group: {
          ...conversation.group,
          avatar: updated.conversation.group.avatar,
        },
      });

    } catch (err) {
      console.error("Lỗi đổi avatar:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Cài đặt chung
      </h4>

      <div className="flex items-center gap-3">
        {isGroupConversation ? (
          <div className="flex flex-col items-center gap-1">
            <div
              className="relative group cursor-pointer"
              onClick={handlePickAvatar}
            >
              <img
                src={conversation.group?.avatar || "/default-group-avatar.png"}
                className="size-12 rounded-full object-cover"
              />

              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100">
                <span className="text-white text-xs">Đổi</span>
              </div>

              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <span className="text-white text-xs">Đang tải...</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleChangeAvatar}
              />
            </div>

            <button
              onClick={() => setOpenMembers(true)}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
            >
              Xem thành viên
            </button>

            <button
              onClick={() => setOpenRename(true)}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
            >
              Đổi tên nhóm
            </button>
          </div>
        ) : (
          <UserAvatar
            type="sidebar"
            name={directParticipant?.displayName || "Người dùng"}
            avatarUrl={directParticipant?.avatarUrl ?? undefined}
            className="size-12 text-base"
          />
        )}

        {/* Info */}
        <div>
          <p className="text-sm font-medium">
            {isGroupConversation
              ? conversation.group?.name || "Nhóm"
              : directParticipant?.displayName || "Người dùng"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isGroupConversation
              ? `${conversation.participants.length} thành viên`
              : "Cuộc trò chuyện cá nhân"}
          </p>
        </div>
      </div>

      <GroupMembersModal
        open={isGroupConversation && openMembers}
        onClose={() => setOpenMembers(false)}
        conversation={conversation}
      />

      {/* ✅ MODAL ĐỔI TÊN ĐẶT ĐÚNG CHỖ */}
      {isGroupConversation && openRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border/70 bg-background/95 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Đổi tên nhóm</h3>
              <p className="text-sm text-muted-foreground">
                Cập nhật tên hiển thị để các thành viên dễ nhận biết cuộc trò chuyện hơn.
              </p>
            </div>

            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-10 rounded-2xl border-border/70 bg-muted/30 px-3"
              placeholder="Tên nhóm mới"
            />

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenRename(false)}>
                Huỷ
              </Button>

              <Button
                onClick={handleRenameGroup}
                disabled={loadingRename}
                className="min-w-24 rounded-2xl"
              >
                {loadingRename ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

};

export default ConversationSettings;