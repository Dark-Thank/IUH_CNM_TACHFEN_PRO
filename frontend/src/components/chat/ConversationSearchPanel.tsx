import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, UserRound, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatMessageTime } from "@/lib/utils";
import {
  buildSearchSnippet,
  getMessageSearchBody,
  getMessageSenderId,
  getMessageSenderName,
  matchesDateFilter,
  normalizeSearchText,
  type MessageSearchDateFilter,
} from "@/lib/messageSearch";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import UserAvatar from "./UserAvatar";

type Props = {
  conversation: Conversation;
  messages: Message[];
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
  activeMessageId: string | null;
  loadingHistory?: boolean;
};

const dateFilterOptions: { value: MessageSearchDateFilter; label: string }[] = [
  { value: "all", label: "Tat ca" },
  { value: "1d", label: "24 gio qua" },
  { value: "7d", label: "7 ngay qua" },
  { value: "30d", label: "30 ngay qua" },
  { value: "year", label: "Nam nay" },
];

const highlightText = (text: string, query: string, activeClassName: string) => {
  if (!query.trim()) {
    return text;
  }

  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return text;
  }

  const segments: { value: string; matched: boolean }[] = [];
  let cursor = 0;
  const lowerText = text.toLowerCase();
  const queryLength = query.trim().length;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(query.trim().toLowerCase(), cursor);

    if (matchIndex < 0) {
      segments.push({ value: text.slice(cursor), matched: false });
      break;
    }

    if (matchIndex > cursor) {
      segments.push({ value: text.slice(cursor, matchIndex), matched: false });
    }

    segments.push({
      value: text.slice(matchIndex, matchIndex + queryLength),
      matched: true,
    });

    cursor = matchIndex + queryLength;
  }

  return segments.map((segment, index) =>
    segment.matched ? (
      <mark
        key={`${segment.value}-${index}`}
        className={cn("rounded px-0.5 text-inherit", activeClassName)}
      >
        {segment.value}
      </mark>
    ) : (
      <span key={`${segment.value}-${index}`}>{segment.value}</span>
    )
  );
};

const ConversationSearchPanel = ({
  conversation,
  messages,
  query,
  onQueryChange,
  onClose,
  onSelectMessage,
  activeMessageId,
  loadingHistory = false,
}: Props) => {
  const { user } = useAuthStore();
  const [senderFilter, setSenderFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<MessageSearchDateFilter>("all");

  useEffect(() => {
    setSenderFilter("all");
    setDateFilter("all");
  }, [conversation._id]);

  const normalizedQuery = normalizeSearchText(query);

  const results = useMemo(() => {
    const sortedMessages = [...messages].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

    return sortedMessages.filter((message) => {
      if (message.isRecalled) {
        return false;
      }

      if (senderFilter !== "all" && getMessageSenderId(message) !== senderFilter) {
        return false;
      }

      if (!matchesDateFilter(message.createdAt, dateFilter)) {
        return false;
      }

      if (!normalizedQuery) {
        return false;
      }

      const searchableText = normalizeSearchText(getMessageSearchBody(message));
      return searchableText.includes(normalizedQuery);
    });
  }, [dateFilter, messages, normalizedQuery, senderFilter]);

  return (
    <aside className="w-[360px] shrink-0 border-l bg-background/95 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-950/95">
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-4 dark:border-slate-700/80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Tìm kiếm trong trò chuyện</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Lọc trong toàn bộ tin nhắn đã tải của cuộc trò chuyện hiện tại.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:bg-accent hover:text-foreground dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Nhập từ khóa cần tìm"
              className="h-11 rounded-xl pl-10 pr-16 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground transition hover:text-foreground dark:text-slate-400 dark:hover:text-slate-100"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <UserRound className="size-4 shrink-0 text-muted-foreground dark:text-slate-400" />
              <select
                value={senderFilter}
                onChange={(event) => setSenderFilter(event.target.value)}
                className="w-full bg-transparent text-sm text-foreground outline-none dark:text-slate-100"
              >
                <option value="all">Người gửi</option>
                {conversation.participants.map((participant) => (
                  <option key={participant._id} value={participant._id}>
                    {participant._id === user?._id ? "Bạn" : participant.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground dark:text-slate-400" />
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as MessageSearchDateFilter)}
                className="w-full bg-transparent text-sm text-foreground outline-none dark:text-slate-100"
              >
                {dateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!query.trim() ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              Nhập nội dung cần tìm. Bảng này đang tìm trên các tin nhắn đã được tải về.
            </div>
          ) : loadingHistory && results.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              Đang tải thêm lịch sử để tìm kiếm đầy đủ hơn...
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              Không tìm thấy tin nhắn phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-500">
                Tin nhắn ({results.length})
              </p>

              {loadingHistory && (
                <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900 dark:text-slate-400">
                  Dang tai them lich su, ket qua co the duoc cap nhat them...
                </p>
              )}

              {results.map((message) => {
                const senderName = getMessageSenderName(message, conversation, user?._id);
                const searchableBody = getMessageSearchBody(message);
                const snippet = buildSearchSnippet(searchableBody, query);
                const sender = conversation.participants.find((participant) => participant._id === getMessageSenderId(message));
                const isActive = activeMessageId === message._id;

                return (
                  <button
                    key={message._id}
                    type="button"
                    onClick={() => onSelectMessage(message._id)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-3 text-left transition",
                      isActive
                        ? "border-primary/50 bg-primary/10 dark:border-fuchsia-400/70 dark:bg-fuchsia-400/10"
                        : "border-transparent hover:border-border/70 hover:bg-muted/30 dark:hover:border-slate-700 dark:hover:bg-slate-900/70"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        type="chat"
                        name={sender?.displayName || senderName}
                        avatarUrl={sender?.avatarUrl ?? undefined}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-medium text-foreground dark:text-slate-100">{senderName}</p>
                          <span className="shrink-0 text-xs text-muted-foreground dark:text-slate-400">
                            {formatMessageTime(new Date(message.createdAt))}
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground dark:text-slate-300">
                          {highlightText(
                            snippet || searchableBody || "Tin nhắn đính kèm",
                            query,
                            isActive
                              ? "bg-primary/30 dark:bg-fuchsia-400/30 dark:text-slate-50"
                              : "bg-amber-300/60 dark:bg-amber-500/35 dark:text-amber-100"
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ConversationSearchPanel;
