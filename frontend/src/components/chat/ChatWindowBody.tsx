import { useChatStore } from "@/stores/useChatStore";
import { AlertCircle, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import MessageItem from "./MessageItem";
import PinnedSection from "./PinnedSection";

const SCROLL_TO_LATEST_THRESHOLD = 160;

const ChatWindowBody = ({ isBlocked }: { isBlocked: boolean }) => {
    const {
        activeConversationId,
        conversations,
        messages: allMessages,
        fetchMessages,
    } = useChatStore();
    const [lastMessageStatus, setLastMessageStatus] = useState<"delivered" | "seen">("delivered");
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

    useEffect(() => {
        const lastMessage = selectedConvo?.lastMessage;
        if (!lastMessage) {
            return;
        }

        const seenBy = selectedConvo?.seenBy ?? [];

        setLastMessageStatus(seenBy.length > 0 ? "seen" : "delivered");
    }, [selectedConvo]);

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

    useEffect(() => {
        setShowScrollToLatest(false);
    }, [messages[messages.length - 1]?._id]);

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
                            <AlertCircle className="size-4 flex-shrink-0" />
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
            {isBlocked && (
                <div className="mb-3 px-4 py-2 bg-warning/10 border border-warning/30 rounded text-warning text-sm flex items-center gap-2">
                    <AlertCircle className="size-4 flex-shrink-0" />
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
                            lastMessageStatus={lastMessageStatus}
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

