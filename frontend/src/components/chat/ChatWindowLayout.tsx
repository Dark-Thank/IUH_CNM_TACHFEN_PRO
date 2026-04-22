import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useEffect, useMemo, useState } from "react";
import { SidebarInset } from "../ui/sidebar";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ConversationAssetsPanel from "./ConversationAssetsPanel";
import CreateGroupAppointmentDialog from "./CreateGroupAppointmentDialog";
import CreateGroupPollDialog from "./CreateGroupPollDialog";
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

          {typingLabel && (
            <div className="border-t bg-background px-4 py-2 text-sm text-muted-foreground">
              {typingLabel}
            </div>
          )}

          {selectedConvo.type === "group" && (
            <div className="border-t bg-background px-3 py-2">
              <div className="flex items-center justify-end gap-1">
                <CreateGroupPollDialog conversationId={selectedConvo._id} />
                <CreateGroupAppointmentDialog conversationId={selectedConvo._id} />
              </div>
            </div>
          )}

          <MessageInput selectedConvo={selectedConvo} isBlocked={isBlocked} />
        </div>

        {showAssetsPanel && <ConversationAssetsPanel messages={messageItems} />}
      </div>
    </SidebarInset>
  );
};

export default ChatWindowLayout;
