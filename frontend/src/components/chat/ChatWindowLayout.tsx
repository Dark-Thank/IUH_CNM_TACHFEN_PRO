import { chatService } from "@/services/chatServiec";
import { friendService } from "@/services/friendService";
import { chatAiService } from "@/services/chatAiService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { ConversationSummary } from "@/types/chat";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Message } from "@/types/chat";

const AUTO_TRANSLATE_LANGUAGE_STORAGE_KEY = "chat-ai-translate-language-v4";

type SmartReplyCacheItem = {
  latestMessageId: string;
  suggestions: string[];
};

type LanguageCacheItem = {
  language: string;
  latestOwnMessageId: string;
};

const readStoredRecord = <T,>(key: string): Record<string, T> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeComparableText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const isUnknownLanguage = (value: string) => {
  const normalized = value.trim().toLowerCase();

  return !normalized ||
    normalized === "unknown" ||
    normalized === "undetermined" ||
    normalized.includes("cannot determine") ||
    normalized.includes("khong xac dinh") ||
    normalized.includes("không xác định");
};

const looksVietnamese = (value: string) => {
  const normalized = normalizeComparableText(value);
  const vietnameseWordPattern = /\b(chao|xin|ban|toi|minh|khong|khoe|dang|hoc|truong|hom|nay|cung|on|lam|gi|the|nao|cam|on|nhe)\b/i;

  return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(value) ||
    vietnameseWordPattern.test(normalized);
};

const getFallbackTargetLanguage = (sourceText: string) =>
  looksVietnamese(sourceText) ? "English" : "Vietnamese";

const detectLocalLanguage = (value: string) => {
  const normalized = normalizeComparableText(value);

  if (/[\u4E00-\u9FFF]/.test(value)) {
    return "Chinese";
  }

  if (looksVietnamese(value)) {
    return "Vietnamese";
  }

  if (/\b(hello|hi|what|when|where|why|how|can|you|your|are|is|am|i|me|my|doing|feel|about|lesson|today|hear|good|thanks|thank)\b/i.test(normalized)) {
    return "English";
  }

  const latinLetters = normalized.match(/[a-z]/g)?.length ?? 0;

  if (latinLetters >= 3) {
    return "English";
  }

  return "";
};

const detectRecentOwnLanguage = (messages: Message[]) => {
  const scores: Record<string, number> = {};

  messages.slice(-5).forEach((message, index, recentMessages) => {
    const language = detectLocalLanguage(message.content ?? "");

    if (!language) {
      return;
    }

    scores[language] = (scores[language] ?? 0) + index + 1 + recentMessages.length;
  });

  if (Object.keys(scores).length >= 2) {
    return "English";
  }

  return Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
};

const getSenderId = (message: Message) => {
  const sender = message.senderId as unknown;

  if (typeof sender === "string") {
    return sender;
  }

  if (sender && typeof sender === "object" && "_id" in sender) {
    return String((sender as { _id?: string })._id ?? "");
  }

  return "";
};

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
  const [smartReplyCache, setSmartReplyCache] = useState<Record<string, SmartReplyCacheItem>>({});
  const [smartReplyLoadingConversationId, setSmartReplyLoadingConversationId] = useState<string | null>(null);
  const [languageByConversation, setLanguageByConversation] = useState<Record<string, LanguageCacheItem>>(
    () => readStoredRecord<LanguageCacheItem>(AUTO_TRANSLATE_LANGUAGE_STORAGE_KEY)
  );
  const [translationsByConversation, setTranslationsByConversation] = useState<Record<string, Record<string, string>>>({});
  const [translatingByConversation, setTranslatingByConversation] = useState<Record<string, string[]>>({});
  const smartReplyRequestKeyRef = useRef("");

  const selectedConvo = conversations.find((c) => c._id === activeConversationId) ?? null;
  const typingUsers = useMemo(
    () => (activeConversationId ? typingByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, typingByConversation]
  );
  const messageItems = useMemo(
    () => messages[activeConversationId ?? ""]?.items ?? [],
    [activeConversationId, messages]
  );
  const latestMessage = messageItems[messageItems.length - 1] ?? null;
  const activeTranslations = activeConversationId
    ? translationsByConversation[activeConversationId] ?? {}
    : {};
  const translatingMessageIds = useMemo(
    () => new Set(activeConversationId ? translatingByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, translatingByConversation]
  );
  const activeSmartReplyCache = activeConversationId ? smartReplyCache[activeConversationId] : undefined;
  const activeSmartReplies = activeConversationId &&
    latestMessage &&
    !latestMessage.isOwn &&
    activeSmartReplyCache?.latestMessageId === latestMessage._id
    ? activeSmartReplyCache.suggestions
    : [];
  const smartReplyLoading = Boolean(
    activeConversationId && smartReplyLoadingConversationId === activeConversationId
  );
  const canRequestSmartReplies = Boolean(
    activeConversationId &&
    latestMessage &&
    !latestMessage.isOwn &&
    typeof latestMessage.content === "string" &&
    latestMessage.content.trim()
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
    window.localStorage.setItem(
      AUTO_TRANSLATE_LANGUAGE_STORAGE_KEY,
      JSON.stringify(languageByConversation)
    );
  }, [languageByConversation]);

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

  const handleRequestSmartReplies = async () => {
    if (!activeConversationId || !latestMessage || latestMessage.isOwn || !latestMessage.content?.trim()) {
      return;
    }

    const cached = smartReplyCache[activeConversationId];
    if (cached?.latestMessageId === latestMessage._id) {
      return;
    }

    const contextMessages = messageItems
      .filter((message) => !message.isRecalled && typeof message.content === "string" && message.content.trim())
      .slice(-5)
      .map((message) => ({
        isOwn: Boolean(message.isOwn),
        content: message.content!.trim(),
      }));

    if (contextMessages.length === 0) {
      toast.error("Khong co noi dung hop le de tao goi y.");
      return;
    }

    const requestKey = `${activeConversationId}:${latestMessage._id}`;
    smartReplyRequestKeyRef.current = requestKey;

    try {
      setSmartReplyLoadingConversationId(activeConversationId);
      const suggestions = await chatAiService.getSmartReplies(activeConversationId, contextMessages);

      if (smartReplyRequestKeyRef.current !== requestKey) {
        return;
      }

      setSmartReplyCache((current) => ({
        ...current,
        [activeConversationId]: {
          latestMessageId: latestMessage._id,
          suggestions,
        },
      }));
    } catch (error: any) {
      console.error("Khong the tao goi y tra loi AI:", error);
      toast.error(error.response?.data?.message || "Khong the tao goi y tra loi luc nay.");
    } finally {
      if (smartReplyRequestKeyRef.current === requestKey) {
        setSmartReplyLoadingConversationId(null);
      }
    }
  };

  const handleTranslateMessage = async (message: Message) => {
    if (!activeConversationId || !message.content?.trim() || message.isOwn) {
      return;
    }

    if (activeTranslations[message._id]) {
      return;
    }

    const currentTranslating = translatingByConversation[activeConversationId] ?? [];
    if (currentTranslating.includes(message._id)) {
      return;
    }

    const setMessageTranslating = (isTranslating: boolean) => {
      setTranslatingByConversation((current) => {
        const currentIds = current[activeConversationId] ?? [];

        return {
          ...current,
          [activeConversationId]: isTranslating
            ? Array.from(new Set([...currentIds, message._id]))
            : currentIds.filter((id) => id !== message._id),
        };
      });
    };

    try {
      setMessageTranslating(true);

      const ownTextMessages = messageItems
        .filter((item) =>
          (item.isOwn || getSenderId(item) === user?._id) &&
          typeof item.content === "string" &&
          item.content.trim()
        )
        .slice(-5);
      const latestOwnMessageId = ownTextMessages[ownTextMessages.length - 1]?._id ?? "";
      const cachedLanguage = languageByConversation[activeConversationId];
      const localLanguage = detectRecentOwnLanguage(ownTextMessages);
      let targetLanguage = localLanguage ||
        (cachedLanguage?.latestOwnMessageId === latestOwnMessageId
        ? cachedLanguage.language
        : "");

      if (!targetLanguage) {
        const userMessages = ownTextMessages
          .slice(-10)
          .map((item) => item.content!.trim());

        if (userMessages.length === 0) {
          toast.error("Chua co tin nhan cua ban de xac dinh ngon ngu dich.");
          return;
        }

        targetLanguage = (await chatAiService.detectLanguage(activeConversationId, userMessages)).trim();

        if (isUnknownLanguage(targetLanguage)) {
          targetLanguage = getFallbackTargetLanguage(message.content);
        }

        setLanguageByConversation((current) => ({
          ...current,
          [activeConversationId]: {
            language: targetLanguage,
            latestOwnMessageId,
          },
        }));
      }

      if (isUnknownLanguage(targetLanguage)) {
        targetLanguage = getFallbackTargetLanguage(message.content);
      }

      if (localLanguage && cachedLanguage?.language !== localLanguage) {
        setLanguageByConversation((current) => ({
          ...current,
          [activeConversationId]: {
            language: localLanguage,
            latestOwnMessageId,
          },
        }));
      }

      const translationResult = await chatAiService.translateMessage(
        activeConversationId,
        message.content.trim(),
        targetLanguage
      );
      const translatedText = translationResult.translatedText?.trim() ?? "";

      if (translationResult.sameLanguage) {
        toast.info("Tin nhan nay da cung ngon ngu voi ban.");
        return;
      }

      if (normalizeComparableText(translatedText) === normalizeComparableText(message.content)) {
        toast.info("Tin nhan nay da cung ngon ngu voi ban.");
        return;
      }

      if (!translatedText) {
        toast.error("Gemini khong tra ve ban dich.");
        return;
      }

      setTranslationsByConversation((current) => ({
        ...current,
        [activeConversationId]: {
          ...(current[activeConversationId] ?? {}),
          [message._id]: translatedText,
        },
      }));
    } catch (error: any) {
      console.error("Khong the dich tin nhan:", error);
      toast.error(error.response?.data?.message || "Khong the dich tin nhan luc nay.");
    } finally {
      setMessageTranslating(false);
    }
  };

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
              translations={activeTranslations}
              translatingMessageIds={translatingMessageIds}
              onTranslateMessage={(message) => void handleTranslateMessage(message)}
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
              smartReplies={activeSmartReplies}
              smartReplyLoading={smartReplyLoading}
              canRequestSmartReplies={canRequestSmartReplies}
              onRequestSmartReplies={() => void handleRequestSmartReplies()}
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
