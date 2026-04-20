import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useEffect, useMemo, useState } from "react";
import { SidebarInset } from "../ui/sidebar";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ChatWindowBody from "./ChatWindowBody";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowSkeleton from "./ChatWindowSkeleton";
import MessageInput from "./MessageInput";

const ChatWindowLayout = () => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const loading = useChatStore((state) => state.messageLoading);
  const markAsSeen = useChatStore((state) => state.markAsSeen);
  const { user } = useAuthStore();
  const typingByConversation = useSocketStore((state) => state.typingByConversation);
  const [isBlocked, setIsBlocked] = useState(false);

  const selectedConvo = conversations.find((c) => c._id === activeConversationId) ?? null;
  const typingUsers = useMemo(
    () => (activeConversationId ? typingByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, typingByConversation]
  );

  // Check if current user is blocked
  useEffect(() => {
    if (!selectedConvo || selectedConvo.type !== "direct" || !user) {
      setIsBlocked(false);
      return;
    }

    const checkBlockStatus = async () => {
      try {
        const otherUser = selectedConvo.participants.find((p) => p._id !== user._id);
        if (!otherUser) {
          setIsBlocked(false);
          return;
        }

        const isBlockedStatus = await friendService.checkBlockStatus(otherUser._id);
        setIsBlocked(Boolean(isBlockedStatus));
      } catch (error) {
        console.error("Error checking block status:", error);
        setIsBlocked(false);
      }
    };

    checkBlockStatus();
  }, [activeConversationId, user, selectedConvo]);

  useEffect(() => {
    if (!selectedConvo) {
      return;
    }

    const markSeen = async () => {
      try {
        await markAsSeen();
      } catch (error) {
        console.error("Lỗi khi markSeen:", error);
      }
    }

    markSeen();

  }, [markAsSeen, selectedConvo]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (loading) {
    return <ChatWindowSkeleton />;
  }

  const typingLabel = typingUsers.length === 0
    ? ""
    : typingUsers.length === 1
      ? `${typingUsers[0].displayName || "Ai đó"} đang soạn tin nhắn`
      : `${typingUsers[0].displayName || "Ai đó"} và ${typingUsers.length - 1} người khác đang soạn tin nhắn`;

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody isBlocked={isBlocked} />
      </div>

      {typingLabel && (
        <div className="border-t bg-background px-4 py-2 text-sm text-muted-foreground">
          {typingLabel}
        </div>
      )}

      {/* Footer */}
      <MessageInput selectedConvo={selectedConvo} isBlocked={isBlocked} />
    </SidebarInset>
  );
};

export default ChatWindowLayout;
