import { useMemo } from "react";

import { useChatStore } from "@/stores/useChatStore";

import DirectMessageCard from "./DirectMessageCard";
import GroupChatCard from "./GroupChatCard";

const getConversationTimestamp = (value?: string | null) => {
    if (!value) {
        return 0;
    }

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const ConversationList = () => {
    const { conversations } = useChatStore();

    const orderedConversations = useMemo(
        () =>
            [...conversations].sort(
                (left, right) =>
                    getConversationTimestamp(right.lastMessageAt ?? right.lastMessage?.createdAt) -
                    getConversationTimestamp(left.lastMessageAt ?? left.lastMessage?.createdAt)
            ),
        [conversations]
    );

    if (orderedConversations.length === 0) {
        return null;
    }

    return (
        <div className="flex-1 space-y-2 p-2">
            {orderedConversations.map((conversation) =>
                conversation.type === "group" ? (
                    <GroupChatCard key={conversation._id} convo={conversation} />
                ) : (
                    <DirectMessageCard key={conversation._id} convo={conversation} />
                )
            )}
        </div>
    );
};

export default ConversationList;