import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import ChatCard from "./ChatCard";
import UnreadCountBadge from "./UnreadCountBadge";
import GroupChatAvatar from "./GroupChatAvatar";

const GroupChatCard = ({ convo }: { convo: Conversation }) => {
  const { user } = useAuthStore();
  const { activeConversationId, setActiveConversation, messages, fetchMessages, toggleConversationPin } =
    useChatStore();

  if (!user) return null;

  const unreadCount = convo.unreadCounts?.[user._id] || 0;
  const groupName = convo.group?.name ?? "Nhóm trò chuyện";

  const renderLastMessageContent = () => {
    const lastMsg = convo.lastMessage;
    if (!lastMsg) {
      return "Chưa có tin nhắn";
    }

    const messagePreview = lastMsg.content?.trim() || "...";
    const senderRef = lastMsg.sender ?? lastMsg.senderId;
    const senderId =
      typeof senderRef === "string"
        ? senderRef
        : senderRef?._id;

    if (senderId === user._id) {
      return `Bạn: ${messagePreview}`;
    }

    const senderName =
      (typeof senderRef === "object" ? senderRef?.displayName : "") ||
      convo.participants.find((participant) => participant._id === senderId)?.displayName ||
      "Người gửi";

    return `${senderName}: ${messagePreview}`;
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
      isPinned={Boolean(convo.isPinned)}
      onSelect={handleSelectConversation}
      onTogglePin={(id) => void toggleConversationPin(id)}
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
        <p
          className={cn(
            "text-sm truncate",
            unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {renderLastMessageContent()}
        </p>
      }
    />
  );
};

export default GroupChatCard;
