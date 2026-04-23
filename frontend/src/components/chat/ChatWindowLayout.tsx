import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useEffect, useMemo, useState } from "react";
import { SidebarInset } from "../ui/sidebar";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ConversationAssetsPanel from "./ConversationAssetsPanel";
import ChatWindowBody from "./ChatWindowBody";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowSkeleton from "./ChatWindowSkeleton";
import MessageInput from "./MessageInput";
import UserAvatar from "./UserAvatar";

const TypingIndicatorBubble = ({
  displayName,
  avatarUrl,
  summary,
}: {
  displayName: string;
  avatarUrl?: string | null;
  summary: string;
}) => (
  <div className="pointer-events-none absolute bottom-full left-4 z-20 mb-2">
    <div className="inline-flex max-w-[18rem] items-center gap-3 rounded-2xl border border-white/8 bg-slate-950/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <UserAvatar
        type="chat"
        name={displayName || "Ai đó"}
        avatarUrl={avatarUrl ?? undefined}
      />

      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-white/90">{summary}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="size-1.5 rounded-full bg-violet-400 animate-bounce"
              style={{ animationDelay: `${index * 0.15}s`, animationDuration: "0.9s" }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    fetchMessages,
    messageLoading: loading,
    messages,
    markAsSeen,
  } = useChatStore();
  const { user } = useAuthStore();
  const typingByConversation = useSocketStore((state) => state.typingByConversation);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  const selectedConvo = conversations.find((c) => c._id === activeConversationId) ?? null;
  const typingUsers = useMemo(
    () => (activeConversationId ? typingByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, typingByConversation]
  );
  const messageItems = useMemo(
    () => messages[activeConversationId ?? ""]?.items ?? [],
    [activeConversationId, messages]
  );

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

    void checkBlockStatus();
  }, [activeConversationId, selectedConvo, user]);

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
    };

    void markSeen();
  }, [markAsSeen, selectedConvo]);

  useEffect(() => {
    setShowAssetsPanel(false);
  }, [activeConversationId]);

  useEffect(() => {
    if (!showAssetsPanel || !selectedConvo || loading) {
      return;
    }

    if (messages[selectedConvo._id]?.nextCursor === null) {
      return;
    }

    void fetchMessages(selectedConvo._id).catch((error) => {
      console.error("Khong the tai them attachment trong cuoc tro chuyen:", error);
    });
  }, [fetchMessages, loading, messages, selectedConvo, showAssetsPanel]);

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
  const typingLeadUser = typingUsers.length > 0
    ? selectedConvo.participants.find((participant) => participant._id === typingUsers[0].userId)
    : null;

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      <ChatWindowHeader
        chat={selectedConvo}
        attachmentsOpen={showAssetsPanel}
        onToggleAttachmentsPanel={() => setShowAssetsPanel((current) => !current)}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-primary-foreground">
            <ChatWindowBody isBlocked={isBlocked} />
          </div>

          <div className="relative">
            {typingLabel && typingLeadUser && (
              <TypingIndicatorBubble
                displayName={typingLeadUser.displayName}
                avatarUrl={typingLeadUser.avatarUrl}
                summary={typingLabel}
              />
            )}

            <MessageInput selectedConvo={selectedConvo} isBlocked={isBlocked} />
          </div>
        </div>

        {showAssetsPanel && (
  <ConversationAssetsPanel
    messages={messageItems}
    conversation={selectedConvo}
  />
)}
      </div>
    </SidebarInset>
  );
};

export default ChatWindowLayout;
