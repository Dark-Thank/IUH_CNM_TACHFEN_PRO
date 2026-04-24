import { useMemo, useState, type ReactNode } from "react";
import { Pin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import DirectMessageCard from "./DirectMessageCard";
import GroupChatCard from "./GroupChatCard";

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getConversationTimestamp = (conversation: Conversation) => {
  const priorityTimestamp = conversation.isPinned
    ? new Date(conversation.pinnedAt ?? 0).getTime()
    : new Date(conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt).getTime();

  return Number.isNaN(priorityTimestamp) ? 0 : priorityTimestamp;
};

const getConversationDisplayName = (conversation: Conversation, currentUserId?: string) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhom chat";
  }

  return (
    conversation.participants.find((participant) => participant._id !== currentUserId)?.displayName ||
    "Cuoc tro chuyen"
  );
};

const getConversationSearchText = (conversation: Conversation, currentUserId?: string) => {
  const name = getConversationDisplayName(conversation, currentUserId);
  const participantNames = conversation.participants.map((participant) => participant.displayName).join(" ");
  const lastMessageText = conversation.lastMessage?.content || "";

  return normalizeSearchText(`${name} ${participantNames} ${lastMessageText}`);
};

const renderConversationCard = (conversation: Conversation) =>
  conversation.type === "group" ? (
    <GroupChatCard key={conversation._id} convo={conversation} />
  ) : (
    <DirectMessageCard key={conversation._id} convo={conversation} />
  );

const ConversationSection = ({
  title,
  icon,
  conversations,
  emptyText,
}: {
  title: string;
  icon?: ReactNode;
  conversations: Conversation[];
  emptyText: string;
}) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2 px-1">
      {icon}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <span className="text-xs text-muted-foreground">({conversations.length})</span>
    </div>

    {conversations.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-2">{conversations.map(renderConversationCard)}</div>
    )}
  </section>
);

const ConversationList = () => {
  const { conversations } = useChatStore();
  const currentUserId = useAuthStore((state) => state.user?._id);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const ordered = [...conversations].sort(
      (left, right) => getConversationTimestamp(right) - getConversationTimestamp(left)
    );

    if (!normalizedQuery) {
      return ordered;
    }

    return ordered.filter((conversation) =>
      getConversationSearchText(conversation, currentUserId ?? undefined).includes(normalizedQuery)
    );
  }, [conversations, currentUserId, searchQuery]);

  const pinnedConversations = filteredConversations.filter((conversation) => conversation.isPinned);
  const regularConversations = filteredConversations.filter((conversation) => !conversation.isPinned);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tim kiem cuoc hoi thoai"
          className="h-11 rounded-2xl border-border/70 bg-background/80 pl-10"
        />
      </div>

      {filteredConversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          {searchQuery.trim()
            ? "Khong tim thay cuoc hoi thoai phu hop."
            : "Chua co cuoc hoi thoai nao."}
        </div>
      ) : (
        <div className="beautiful-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <ConversationSection
            title="Ưu tiên"
            icon={<Pin className="size-4 text-primary" />}
            conversations={pinnedConversations}
            emptyText="Chưa có cuộc hội thoại nào được ghim."
          />

          <ConversationSection
            title="Khác"
            conversations={regularConversations}
            emptyText="Không còn cuộc hội thoại nào trong mục này."
          />
        </div>
      )}
    </div>
  );
};

export default ConversationList;
