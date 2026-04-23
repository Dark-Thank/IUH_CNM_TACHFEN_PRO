import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import ChatCard from "./ChatCard";
import UnreadCountBadge from "./UnreadCountBadge";
import GroupChatAvatar from "./GroupChatAvatar";

const GroupChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const { activeConversationId, setActiveConversation, messages, fetchMessages } =
    useChatStore();

  if (!user) return null;

  const unreadCount = convo.unreadCounts?.[user._id] || 0;
  const groupName = convo.group?.name ?? "Nhóm trò chuyện";

  // Hàm xử lý hiển thị nội dung: "Tên: Tin nhắn"
 const renderLastMessageContent = () => {
    const lastMsg = convo.lastMessage;
    if (!lastMsg) return "Chưa có tin nhắn";

    // 1. Lấy object người gửi (kiểm tra cả senderId và sender cho chắc)
    const senderObj = (lastMsg as any).senderId || (lastMsg as any).sender;
    
    // Nếu không thấy object người gửi (có thể chỉ là ID dạng string)
    if (!senderObj || typeof senderObj === 'string') {
      return `Người gửi: ${lastMsg.content || "..."}`;
    }

    // 2. Kiểm tra xem có phải mình gửi không
    const isMe = senderObj._id === user._id;
    if (isMe) return `Bạn: ${lastMsg.content || "..."}`;

    // 3. Lấy tên hiển thị (Thử displayName trước, name sau)
    const fullName = (senderObj.displayName || senderObj.name || "").trim();
    
    if (fullName) {
      // Cắt lấy tên cuối cùng (Ví dụ: "Nguyễn Hùng" -> "Hùng")
      const nameParts = fullName.split(" ");
      const firstName = nameParts[nameParts.length - 1]; 
      return `${firstName}: ${lastMsg.content || "..."}`;
    }

    // Fallback cuối cùng nếu mọi thứ trên đều hụt
    return `Thành viên: ${lastMsg.content || "..."}`;
  };

  const handleSelectConversation = async (id: string) => {
    setActiveConversation(id);
    if (!messages[id]) {
      await fetchMessages();
    }
  };

  return (
    <ChatCard
      convoId={convo._id}
      name={groupName}
      // Truyền Date để ChatCard tự hiển thị (16h, 1d...)
      timestamp={
        convo.lastMessage?.createdAt 
          ? new Date(convo.lastMessage.createdAt) 
          : undefined
      }
      isActive={activeConversationId === convo._id}
      onSelect={handleSelectConversation}
      unreadCount={unreadCount}
      leftSection={
        <div className="relative">
          <GroupChatAvatar
            participants={convo.participants}
            type="chat"
            groupAvatar={convo.group?.avatar}
          />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 z-10">
              <UnreadCountBadge unreadCount={unreadCount} />
            </div>
          )}
        </div>
      }
      subtitle={
        <p className="text-sm truncate text-muted-foreground">
          {renderLastMessageContent()}
        </p>
      }
    />
  );
};

export default GroupChatCard;