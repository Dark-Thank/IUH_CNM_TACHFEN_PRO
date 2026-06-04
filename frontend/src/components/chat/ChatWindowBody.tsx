import { useChatStore } from "@/stores/useChatStore";
import type { ConversationSummary } from "@/types/chat";
import { AlertCircle, ChevronDown, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { Button } from "../ui/button";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import MessageItem from "./MessageItem";
import PinnedSection from "./PinnedSection";
import type { Message } from "@/types/chat";

const SCROLL_TO_LATEST_THRESHOLD = 160;

type Props = {
    isBlocked: boolean;
    focusMessageId?: string | null;
    focusRequestKey?: number;
    searchQuery?: string;
    highlightedMessageId?: string | null;
    unreadSummaryPrompt?: {
        unreadCount: number;
        summaryLoading: boolean;
        summary: ConversationSummary | null;
        onSummarize: () => void;
        onDismiss: () => void;
    } | null;
    translations?: Record<string, string>;
    translatingMessageIds?: Set<string>;
    onTranslateMessage?: (message: Message) => void;
};

const ChatWindowBody = ({
    isBlocked,
    focusMessageId = null,
    focusRequestKey = 0,
    searchQuery = "",
    highlightedMessageId = null,
    unreadSummaryPrompt = null,
    translations = {},
    translatingMessageIds = new Set<string>(),
    onTranslateMessage,
}: Props) => {
    const {
        activeConversationId,
        conversations,
        messages: allMessages,
        fetchMessages,
    } = useChatStore();
    const [showScrollToLatest, setShowScrollToLatest] = useState(false);

    const messages = allMessages[activeConversationId ?? ""]?.items ?? [];
    const pinnedMessages = messages.filter((m) => m.isPinned);
    const reversedMessages = [...messages].reverse();
    const hasMore = allMessages[activeConversationId ?? ""]?.hasMore ?? false;
    const selectedConvo = conversations.find((c) => c._id === activeConversationId);
    const key = `chat-scroll-${activeConversationId}`;

    const scrollToMessage = useCallback((id: string) => {
        const el = document.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-primary/50', 'animate-pulse');
            setTimeout(() => {
                el.classList.remove('ring-4', 'ring-primary/50', 'animate-pulse');
            }, 2000);
        }
    }, []);

    //ref
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    //keo xuong duoi khi load convo
    useLayoutEffect(() => {
        if (!messagesEndRef.current) {
            return;
        }

        messagesEndRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });

        setShowScrollToLatest(false);

    }, [activeConversationId])

    const latestMessageScrollKey = messages[messages.length - 1]?.clientTempId ?? messages[messages.length - 1]?._id;

    useEffect(() => {
        setShowScrollToLatest(false);
    }, [latestMessageScrollKey]);

    useEffect(() => {
        if (!focusMessageId) {
            return;
        }

        scrollToMessage(focusMessageId);
    }, [focusMessageId, focusRequestKey, scrollToMessage]);

    const fetchMoreMessages = async () => {
        if (!activeConversationId) {
            return;
        }

        try {
            await fetchMessages(activeConversationId);
        } catch (error) {
            console.error("Lỗi xảy ra khi fetch thêm tin", error);
        }
    };

    const scrollToLatest = useCallback(() => {
        if (!messagesEndRef.current) {
            return;
        }

        messagesEndRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
        });
        setShowScrollToLatest(false);
    }, []);

    const handleScrollSave = () => {
        const container = containerRef.current;
        if (!container || !activeConversationId) {
            return;
        }

        const distanceFromLatest = Math.abs(container.scrollTop);

        setShowScrollToLatest(distanceFromLatest > SCROLL_TO_LATEST_THRESHOLD);

        sessionStorage.setItem(
            key,
            JSON.stringify({
                scrollTop: container.scrollTop,
                scrollHeight: container.scrollHeight,
            })
        );
    };

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const item = sessionStorage.getItem(key);

        if (item) {
            const { scrollTop } = JSON.parse(item);
            requestAnimationFrame(() => {
                container.scrollTop = scrollTop;
            });
        }
    }, [messages.length]);

    if (!selectedConvo) {
        return <ChatWelcomeScreen />;
    }

    if (!messages?.length) {
        return (
            <div className="flex h-full flex-col overflow-hidden">
                {isBlocked && (
                    <div className="p-4 pb-3 bg-primary-foreground">
                        <div className="px-4 py-2 bg-warning/10 border border-warning/30 rounded text-warning text-sm flex items-center gap-2">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>Bạn đã chặn người này. Không thể gửi tin nhắn.</span>
                        </div>
                    </div>
                )}
                <div className="flex h-full items-center justify-center text-muted-foreground bg-primary-foreground">
                    Chưa có tin nhắn nào trong cuộc trò chuyện này.
                </div>
            </div>
        );
    }

    return (
        <div className="relative p-4 bg-primary-foreground h-full flex flex-col overflow-hidden">
            {pinnedMessages.length > 0 && (
                <PinnedSection
                    pinnedMessages={pinnedMessages}
                    onJump={scrollToMessage}
                />
            )}
            {unreadSummaryPrompt && (
                <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <Sparkles className="size-4 text-primary" />
                                Có {unreadSummaryPrompt.unreadCount} tin nhắn chưa đọc
                            </div>

                            {!unreadSummaryPrompt.summary && !unreadSummaryPrompt.summaryLoading && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Bạn có thể tóm tắt nhanh đoạn chat chưa đọc trước khi xem chi tiết.
                                </p>
                            )}

                            {unreadSummaryPrompt.summaryLoading && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Groq đang tóm tắt phần tin nhắn chưa đọc...
                                </p>
                            )}

                            {unreadSummaryPrompt.summary && (
                                <div className="mt-3 rounded-xl bg-background/70 px-3 py-3">
                                    <p className="text-sm font-medium text-foreground">Tóm tắt nhanh</p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                        {unreadSummaryPrompt.summary.summary}
                                    </p>

                                    {unreadSummaryPrompt.summary.bullets.length > 0 && (
                                        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                                            {unreadSummaryPrompt.summary.bullets.map((bullet) => (
                                                <li key={bullet} className="flex gap-2">
                                                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                                                    <span>{bullet}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {!unreadSummaryPrompt.summary && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="rounded-2xl"
                                        onClick={unreadSummaryPrompt.onSummarize}
                                        disabled={unreadSummaryPrompt.summaryLoading}
                                    >
                                        Tóm tắt đoạn chưa đọc
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    size="sm"
                                    variant={unreadSummaryPrompt.summary ? "default" : "outline"}
                                    className="rounded-2xl"
                                    onClick={unreadSummaryPrompt.onDismiss}
                                    disabled={unreadSummaryPrompt.summaryLoading}
                                >
                                    {unreadSummaryPrompt.summary ? "Đã hiểu" : "Bỏ qua"}
                                </Button>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={unreadSummaryPrompt.onDismiss}
                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
                            aria-label="Đóng gợi ý tóm tắt"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            )}
            {isBlocked && (
                <div className="mb-3 px-4 py-2 bg-warning/10 border border-warning/30 rounded text-warning text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Bạn đã chặn người này. Không thể gửi tin nhắn.</span>
                </div>
            )}
            <div
                id="scrollableDiv"
                ref={containerRef}
                onScroll={handleScrollSave}
                className="flex-1 flex flex-col-reverse overflow-y-auto overflow-x-hidden beautiful-scrollbar">
                <div ref={messagesEndRef}></div>
                <InfiniteScroll
                    dataLength={messages.length}
                    next={fetchMoreMessages}
                    hasMore={hasMore}
                    scrollableTarget="scrollableDiv"
                    loader={<p>Đang tải</p>}
                    inverse={true}
                    style={{
                        display: "flex",
                        flexDirection: "column-reverse",
                        overflow: "visible",
                    }}
                >
                    {reversedMessages.map((message, index) => (
                        <MessageItem
                            key={message._id ?? index}
                            message={message}
                            index={index}
                            messages={reversedMessages}
                            selectedConvo={selectedConvo}
                            searchQuery={searchQuery}
                            isSearchFocused={highlightedMessageId === message._id}
                            translation={translations[message._id]}
                            isTranslating={translatingMessageIds.has(message._id)}
                            onTranslateMessage={onTranslateMessage}
                        />
                    ))}
                </InfiniteScroll>
            </div>

            {showScrollToLatest && (
                <button
                    type="button"
                    onClick={scrollToLatest}
                    className="absolute bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/95 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur transition hover:bg-accent"
                >
                    <ChevronDown className="size-4" />
                    Tin mới nhất
                </button>
            )}
        </div>
    )
}

export default ChatWindowBody

