import { chatService } from "@/services/chatServiec";
import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { ConversationSummary } from "@/types/chat";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SidebarInset } from "../ui/sidebar";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import ChatWindowBody from "./ChatWindowBody";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowSkeleton from "./ChatWindowSkeleton";
import ConversationAssetsPanel from "./ConversationAssetsPanel";
import ConversationSearchPanel from "./ConversationSearchPanel";
import CreateGroupAppointmentDialog from "./CreateGroupAppointmentDialog";
import CreateGroupPollDialog from "./CreateGroupPollDialog";
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
  <div className="pointer-events-none px-4 pb-2 pt-1">
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
  const unreadSummaryThreshold = 10;
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
  const [rightPanelMode, setRightPanelMode] = useState<"none" | "attachments" | "search">("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedSearchMessageId, setFocusedSearchMessageId] = useState<string | null>(null);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [searchLoadingHistory, setSearchLoadingHistory] = useState(false);
  const [unreadSummaryPrompt, setUnreadSummaryPrompt] = useState<{
    conversationId: string;
    unreadCount: number;
    summaryLoading: boolean;
    summary: ConversationSummary | null;
  } | null>(null);

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
    if (!selectedConvo || !user) {
      setUnreadSummaryPrompt(null);
      return;
    }

    const unreadCount = selectedConvo.unreadCounts?.[user._id] ?? 0;

    if (unreadCount > unreadSummaryThreshold) {
      setUnreadSummaryPrompt({
        conversationId: selectedConvo._id,
        unreadCount,
        summaryLoading: false,
        summary: null,
      });
      return;
    }

    setUnreadSummaryPrompt(null);

    const markSeen = async () => {
      try {
        await markAsSeen();
      } catch (error) {
        console.error("Lỗi khi markSeen:", error);
      }
    };

    void markSeen();
  }, [markAsSeen, selectedConvo?._id, user?._id]);

  useEffect(() => {
    setRightPanelMode("none");
    setSearchQuery("");
    setFocusedSearchMessageId(null);
    setFocusRequestKey(0);
    setSearchLoadingHistory(false);
  }, [activeConversationId]);

  useEffect(() => {
    if (rightPanelMode !== "attachments" || !selectedConvo || loading) {
      return;
    }

    if (messages[selectedConvo._id]?.nextCursor === null) {
      return;
    }

    void fetchMessages(selectedConvo._id).catch((error) => {
      console.error("Khong the tai them attachment trong cuoc tro chuyen:", error);
    });
  }, [fetchMessages, loading, messages, rightPanelMode, selectedConvo]);

  useEffect(() => {
    if (rightPanelMode !== "search" || !selectedConvo) {
      return;
    }

    let cancelled = false;

    const loadConversationHistory = async () => {
      try {
        setSearchLoadingHistory(true);

        while (!cancelled) {
          const currentState = useChatStore.getState().messages[selectedConvo._id];
          const nextCursor = currentState?.nextCursor;

          if (nextCursor === null) {
            break;
          }

          await fetchMessages(selectedConvo._id);

          const refreshedState = useChatStore.getState().messages[selectedConvo._id];
          if (refreshedState?.nextCursor === nextCursor) {
            break;
          }
        }
      } catch (error) {
        console.error("Khong the tai lich su de tim kiem:", error);
      } finally {
        if (!cancelled) {
          setSearchLoadingHistory(false);
        }
      }
    };

    void loadConversationHistory();

    return () => {
      cancelled = true;
    };
  }, [fetchMessages, rightPanelMode, selectedConvo]);

  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (loading && messageItems.length === 0) {
    return <ChatWindowSkeleton />;
  }

  const finalizeUnreadSummaryPrompt = async () => {
    try {
      await markAsSeen();
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã xem sau gợi ý tóm tắt:", error);
    } finally {
      setUnreadSummaryPrompt(null);
    }
  };

  const handleSummarizeUnreadMessages = async () => {
    if (!selectedConvo || !unreadSummaryPrompt || unreadSummaryPrompt.conversationId !== selectedConvo._id) {
      return;
    }

    try {
      setUnreadSummaryPrompt((current) => (
        current && current.conversationId === selectedConvo._id
          ? { ...current, summaryLoading: true }
          : current
      ));

      const summary = await chatService.summarizeConversation(selectedConvo._id, {
        scope: "unread",
        limit: unreadSummaryPrompt.unreadCount,
      });

      setUnreadSummaryPrompt((current) => (
        current && current.conversationId === selectedConvo._id
          ? { ...current, summaryLoading: false, summary }
          : current
      ));
    } catch (error: any) {
      console.error("Không thể tóm tắt tin nhắn chưa đọc:", error);
      toast.error(error?.response?.data?.message || "Không thể tóm tắt phần tin nhắn chưa đọc");
      setUnreadSummaryPrompt((current) => (
        current && current.conversationId === selectedConvo._id
          ? { ...current, summaryLoading: false }
          : current
      ));
    }
  };

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
        panelMode={rightPanelMode}
        searchOpen={rightPanelMode === "search"}
        onToggleAttachmentsPanel={() =>
          setRightPanelMode((current) => (current === "attachments" ? "none" : "attachments"))
        }
        onToggleSearchPanel={() =>
          setRightPanelMode((current) => (current === "search" ? "none" : "search"))
        }
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-primary-foreground">
            <ChatWindowBody
              isBlocked={isBlocked}
              focusMessageId={focusedSearchMessageId}
              focusRequestKey={focusRequestKey}
              searchQuery={searchQuery}
              highlightedMessageId={focusedSearchMessageId}
              unreadSummaryPrompt={
                unreadSummaryPrompt && unreadSummaryPrompt.conversationId === selectedConvo._id
                  ? {
                    unreadCount: unreadSummaryPrompt.unreadCount,
                    summaryLoading: unreadSummaryPrompt.summaryLoading,
                    summary: unreadSummaryPrompt.summary,
                    onSummarize: handleSummarizeUnreadMessages,
                    onDismiss: () => void finalizeUnreadSummaryPrompt(),
                  }
                  : null
              }
            />
          </div>

          <div className="relative">
            {typingLabel && typingLeadUser && (
              <TypingIndicatorBubble
                displayName={typingLeadUser.displayName}
                avatarUrl={typingLeadUser.avatarUrl}
                summary={typingLabel}
              />
            )}

            <MessageInput
              selectedConvo={selectedConvo}
              isBlocked={isBlocked}
              extraActions={selectedConvo.type === "group" ? (
                <>
                  <CreateGroupPollDialog conversationId={selectedConvo._id} disabled={isBlocked} />
                  <CreateGroupAppointmentDialog conversationId={selectedConvo._id} disabled={isBlocked} />
                </>
              ) : null}
            />
          </div>
        </div>

        {rightPanelMode === "attachments" && (
          <ConversationAssetsPanel
            messages={messageItems}
            conversation={selectedConvo}
          />
        )}

        {rightPanelMode === "search" && (
          <ConversationSearchPanel
            conversation={selectedConvo}
            messages={messageItems}
            query={searchQuery}
            onQueryChange={(value) => {
              setSearchQuery(value);
              setFocusedSearchMessageId(null);
            }}
            onClose={() => setRightPanelMode("none")}
            onSelectMessage={(messageId) => {
              setFocusedSearchMessageId(messageId);
              setFocusRequestKey((current) => current + 1);
            }}
            activeMessageId={focusedSearchMessageId}
            loadingHistory={searchLoadingHistory}
          />
        )}
      </div>
    </SidebarInset>
  );
};

export default ChatWindowLayout;
