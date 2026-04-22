import { useRef, useState } from "react";
import type { Conversation } from "@/types/chat";
import { chatService } from "@/services/chatServiec";
import { useChatStore } from "@/stores/useChatStore";
type Props = {
  conversation: Conversation;
};
import GroupMembersModal from "./GroupMembersModal";
const ConversationSettings = ({ conversation }: Props) => {
  const { fetchConversations } = useChatStore();
  if (!conversation) return null
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openMembers, setOpenMembers] = useState(false);
const [openRename, setOpenRename] = useState(false);
const [newName, setNewName] = useState(conversation.group?.name || "");
const [loadingRename, setLoadingRename] = useState(false);
  const handlePickAvatar = () => {
    fileInputRef.current?.click();
  };
  const handleRenameGroup = async () => {
  if (!newName.trim()) return;

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
      {/* Avatar block */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="relative group cursor-pointer"
          onClick={handlePickAvatar}
        >
          <img
            src={conversation.group?.avatar || "/default-group-avatar.png"}
            className="size-12 rounded-full object-cover"
          />

          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
            <span className="text-white text-xs">Đổi</span>
          </div>

          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
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
          className="text-xs text-blue-500 hover:underline"
        >
          Xem thành viên
        </button>

        <button
          onClick={() => setOpenRename(true)}
          className="text-xs text-blue-500 hover:underline"
        >
          Đổi tên nhóm
        </button>
      </div>

      {/* Info */}
      <div>
        <p className="text-sm font-medium">
          {conversation.group?.name || "Nhóm"}
        </p>
        <p className="text-xs text-muted-foreground">
          {conversation.participants.length} thành viên
        </p>
      </div>
    </div>

    <GroupMembersModal
      open={openMembers}
      onClose={() => setOpenMembers(false)}
      conversation={conversation}
    />

    {/* ✅ MODAL ĐỔI TÊN ĐẶT ĐÚNG CHỖ */}
    {openRename && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-md w-[300px] space-y-3">
          <h3 className="font-semibold">Đổi tên nhóm</h3>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border px-2 py-1 rounded"
            placeholder="Tên nhóm mới"
          />

          <div className="flex justify-end gap-2">
            <button onClick={() => setOpenRename(false)}>
              Huỷ
            </button>

            <button
              onClick={handleRenameGroup}
              disabled={loadingRename}
              className="text-blue-500"
            >
              {loadingRename ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    )}
  </section>
);
  
};

export default ConversationSettings;