import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useEffect, useMemo, useState } from "react";
import { SidebarInset } from "../ui/sidebar";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ConversationAssetsPanel from "./ConversationAssetsPanel";
import ChatWindowBody from "./ChatWindowBody";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowSkeleton from "./ChatWindowSkeleton";
import MessageInput from "./MessageInput";

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
  const [isBlocked, setIsBlocked] = useState(false);
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  const selectedConvo = conversations.find((c) => c._id === activeConversationId) ?? null;
  const messageItems = useMemo(
    () => messages[activeConversationId ?? ""]?.items ?? [],
    [activeConversationId, messages]
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
    if(!selectedConvo) {
      return;
    }

    const markSeen = async () =>{
      try {
        await markAsSeen();
      } catch (error) {
        console.error("Lỗi khi markSeen:", error);
      }
    }

    markSeen();

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

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader
        chat={selectedConvo}
        attachmentsOpen={showAssetsPanel}
        onToggleAttachmentsPanel={() => setShowAssetsPanel((current) => !current)}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-primary-foreground">
            <ChatWindowBody isBlocked={isBlocked} />
          </div>

          {/* Footer */}
          <MessageInput selectedConvo={selectedConvo} isBlocked={isBlocked} />
        </div>

        {showAssetsPanel && <ConversationAssetsPanel messages={messageItems} />}
      </div>
    </SidebarInset>
  );
};

export default ChatWindowLayout;
