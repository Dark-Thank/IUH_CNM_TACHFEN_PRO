export const getMessagePreviewContent = (message) => {
    const trimmedContent = typeof message?.content === "string"
        ? message.content.trim()
        : "";

    if (trimmedContent) {
        return trimmedContent;
    }

    if (message?.messageType === "voice") {
        return "Tin nhắn thoại";
    }

    if (message?.messageType === "call") {
        return message?.content || "Cuộc gọi";
    }

    if (Array.isArray(message?.imgUrls) && message.imgUrls.length > 0) {
        return message.imgUrls.length > 1 ? "Đã gửi nhiều ảnh" : "Đã gửi một ảnh";
    }

    if (Array.isArray(message?.fileUrls) && message.fileUrls.length > 0) {
        return message.fileUrls.length > 1 ? "Đã gửi nhiều tệp" : "Đã gửi một tệp";
    }

    return "Tin nhắn mới";
};

export const updateConversationAfterCreateMessage = (conversation, message,
    senderId) => {
    conversation.set({
        seenBy: [],
        lastMessageAt: message.createdAt,
        lastMessage: {
            _id: message._id,
            content: getMessagePreviewContent(message),
            senderId,
            createdAt: message.createdAt
        }
    });

    if (!conversation.unreadCounts) {
        conversation.unreadCounts = new Map();
    }

    conversation.participants.forEach((p) => {
        const memberId = p.userId.toString();
        const isSender = memberId === senderId.toString();
        const prevCount = conversation.unreadCounts.get(memberId) || 0;
        conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1);
    })
};

const getEntityId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (typeof value.toString === "function") {
        return value.toString();
    }

    return null;
};

const toPlainUnreadCounts = (unreadCounts) => {
    if (!unreadCounts) {
        return {};
    }

    if (unreadCounts instanceof Map) {
        return Object.fromEntries(unreadCounts.entries());
    }

    return Object.fromEntries(Object.entries(unreadCounts));
};

export const getConversationParticipantIds = (conversation) => (
    (conversation.participants || [])
        .map((participant) => getEntityId(participant?.userId || participant))
        .filter(Boolean)
);

export const formatConversationForSocket = (conversation) => {
    const rawConversation = typeof conversation.toObject === "function"
        ? conversation.toObject()
        : conversation;

    const sender = rawConversation?.lastMessage?.senderId;

    return {
        ...rawConversation,
        participants: (rawConversation.participants || []).map((participant) => {
            const user = participant?.userId || participant;

            return {
                _id: getEntityId(user),
                displayName: user?.displayName || "",
                avatarUrl: user?.avatarUrl ?? null,
                role: participant?.role || "member",
                joinedAt: participant?.joinedAt,
            };
        }),
        seenBy: (rawConversation.seenBy || []).map((user) => ({
            _id: getEntityId(user),
            displayName: user?.displayName || "",
            avatarUrl: user?.avatarUrl ?? null,
        })),
        unreadCounts: toPlainUnreadCounts(rawConversation.unreadCounts),
        lastMessage: rawConversation?.lastMessage?._id
            ? {
                _id: rawConversation.lastMessage._id,
                content: rawConversation.lastMessage.content,
                createdAt: rawConversation.lastMessage.createdAt,
                sender: {
                    _id: getEntityId(sender),
                    displayName: sender?.displayName || "",
                    avatarUrl: sender?.avatarUrl ?? null,
                },
            }
            : null,
    };
};

export const emitConversationUpsert = (io, conversation) => {
    const formattedConversation = formatConversationForSocket(conversation);

    getConversationParticipantIds(conversation).forEach((participantId) => {
        io.to(participantId).emit("conversation-upsert", formattedConversation);
    });
};

export const emitConversationRemoved = (io, conversationId, participantIds = []) => {
    const payload = { conversationId: conversationId?.toString?.() || conversationId };

    participantIds.forEach((participantId) => {
        io.to(participantId.toString()).emit("conversation-removed", payload);
    });
};

export const emitNewMessage = (io, conversation, message, extraRooms = []) => {
    const payload = {
        message,
        conversation: {
            _id: conversation._id,
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
        },
        unreadCounts: conversation.unreadCounts,
    };

    const targetRooms = new Set([
        conversation._id.toString(),
        ...extraRooms.map((roomId) => roomId?.toString()).filter(Boolean),
    ]);

    targetRooms.forEach((roomId) => {
        io.to(roomId).emit("new-message", payload);
    });
};
