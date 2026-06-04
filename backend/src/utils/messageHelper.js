import User from "../models/User.js";

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

    if (message?.messageType === "poll") {
        const question = typeof message?.pollMeta?.question === "string"
            ? message.pollMeta.question.trim()
            : "";

        return question ? `Bình chọn: ${question}` : "Bình chọn mới";
    }

    if (message?.messageType === "appointment") {
        const title = typeof message?.appointmentMeta?.title === "string"
            ? message.appointmentMeta.title.trim()
            : "";

        return title ? `Lịch hẹn: ${title}` : "Lịch hẹn mới";
    }

    if (message?.messageType === "group_invite") {
        const groupName = typeof message?.groupInviteMeta?.groupName === "string"
            ? message.groupInviteMeta.groupName.trim()
            : "";

        return groupName ? `Mời tham gia nhóm: ${groupName}` : "Lời mời tham gia nhóm";
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
    const normalizedSenderId = getEntityId(senderId);

    conversation.set({
        seenBy: [],
        lastMessageAt: message.createdAt,
        lastMessage: {
            _id: message._id,
            content: getMessagePreviewContent(message),
            senderId: normalizedSenderId,
            createdAt: message.createdAt
        }
    });

    if (!conversation.unreadCounts) {
        conversation.unreadCounts = new Map();
    }

    conversation.participants.forEach((p) => {
        const memberId = getEntityId(p.userId || p);

        if (!memberId) {
            return;
        }

        const isSender = memberId === normalizedSenderId;
        const prevCount = conversation.unreadCounts.get(memberId) || 0;
        conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1);
    });
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

const toPlainObject = (value) => {
    if (!value) {
        return value;
    }

    if (typeof value.toObject === "function") {
        return value.toObject({ flattenMaps: true });
    }

    return value;
};

const toPlainIdArray = (values = []) => (
    (values || [])
        .map((value) => getEntityId(value))
        .filter(Boolean)
);

const getReactionEntries = (reactions) => {
    if (!reactions) {
        return [];
    }

    if (reactions instanceof Map) {
        return [...reactions.entries()];
    }

    return Object.entries(reactions);
};

const buildReactionUserFallback = (userId) => ({
    _id: userId,
    displayName: "Thành viên",
    avatarUrl: null,
});

const formatReactions = (reactions, reactionUsers = new Map()) => {
    const entries = getReactionEntries(reactions);

    if (entries.length === 0) {
        return {};
    }

    return Object.fromEntries(
        entries
            .map(([emoji, users]) => {
                const formattedUsers = (users || [])
                    .map((userId) => getEntityId(userId))
                    .filter(Boolean)
                    .map((userId) => reactionUsers.get(userId) || buildReactionUserFallback(userId));

                return [emoji, formattedUsers];
            })
            .filter(([, users]) => users.length > 0)
    );
};

const collectReactionUserIds = (messages = []) => {
    const userIds = new Set();

    messages.forEach((message) => {
        const rawMessage = toPlainObject(message);

        getReactionEntries(rawMessage?.reactions).forEach(([, users]) => {
            (users || []).forEach((userId) => {
                const normalizedId = getEntityId(userId);

                if (normalizedId) {
                    userIds.add(normalizedId);
                }
            });
        });
    });

    return [...userIds];
};

const loadReactionUsers = async (messages = []) => {
    const userIds = collectReactionUserIds(messages);

    if (userIds.length === 0) {
        return new Map();
    }

    const users = await User.find({ _id: { $in: userIds } })
        .select("displayName avatarUrl")
        .lean();

    return new Map(
        users.map((user) => [
            user._id.toString(),
            {
                _id: user._id.toString(),
                displayName: user.displayName || "",
                avatarUrl: user.avatarUrl ?? null,
            },
        ])
    );
};

const buildFormattedMessage = (message, reactionUsers = new Map()) => {
    const rawMessage = toPlainObject(message);

    if (!rawMessage) {
        return rawMessage;
    }

    return {
        ...rawMessage,
        _id: getEntityId(rawMessage._id),
        conversationId: getEntityId(rawMessage.conversationId),
        senderId: getEntityId(rawMessage.senderId),
        pinnedBy: getEntityId(rawMessage.pinnedBy),
        recallBy: getEntityId(rawMessage.recallBy),
        deletedForUsers: toPlainIdArray(rawMessage.deletedForUsers),
        deliveredTo: toPlainIdArray(rawMessage.deliveredTo),
        seenBy: toPlainIdArray(rawMessage.seenBy),
        reactions: formatReactions(rawMessage.reactions, reactionUsers),
        callMeta: rawMessage.callMeta
            ? {
                ...rawMessage.callMeta,
                callerId: getEntityId(rawMessage.callMeta.callerId),
                recipientId: getEntityId(rawMessage.callMeta.recipientId),
            }
            : rawMessage.callMeta,
        groupInviteMeta: rawMessage.groupInviteMeta
            ? {
                ...rawMessage.groupInviteMeta,
                conversationId: getEntityId(rawMessage.groupInviteMeta.conversationId),
                invitedBy: getEntityId(rawMessage.groupInviteMeta.invitedBy),
            }
            : rawMessage.groupInviteMeta,
        forwardedFrom: rawMessage.forwardedFrom
            ? {
                ...rawMessage.forwardedFrom,
                messageId: getEntityId(rawMessage.forwardedFrom.messageId),
                conversationId: getEntityId(rawMessage.forwardedFrom.conversationId),
                senderId: getEntityId(rawMessage.forwardedFrom.senderId),
            }
            : rawMessage.forwardedFrom,
        replyTo: rawMessage.replyTo
            ? {
                ...rawMessage.replyTo,
                messageId: getEntityId(rawMessage.replyTo.messageId),
                senderId: getEntityId(rawMessage.replyTo.senderId),
            }
            : rawMessage.replyTo,
    };
};

export const formatMessageForClient = async (message) => {
    const reactionUsers = await loadReactionUsers([message]);
    return buildFormattedMessage(message, reactionUsers);
};

export const formatMessagesForClient = async (messages = []) => {
    const reactionUsers = await loadReactionUsers(messages);
    return messages.map((message) => buildFormattedMessage(message, reactionUsers));
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
        joinRequests: (rawConversation.joinRequests || []).map((request) => {
            const user = request?.userId || {};
            const requestedBy = request?.requestedBy || {};
            const addedBy = request?.addedBy || null;

            return {
                user: {
                    _id: getEntityId(user),
                    displayName: user?.displayName || "",
                    username: user?.username || "",
                    avatarUrl: user?.avatarUrl ?? null,
                },
                requestedBy: {
                    _id: getEntityId(requestedBy),
                    displayName: requestedBy?.displayName || "",
                    username: requestedBy?.username || "",
                    avatarUrl: requestedBy?.avatarUrl ?? null,
                },
                addedBy: addedBy ? {
                    _id: getEntityId(addedBy),
                    displayName: addedBy?.displayName || "",
                    username: addedBy?.username || "",
                    avatarUrl: addedBy?.avatarUrl ?? null,
                } : null,
                source: request?.source || "invite",
                requestedAt: request?.requestedAt,
            };
        }).filter((request) => request.user._id),
        seenBy: (rawConversation.seenBy || []).map((user) => ({
            _id: getEntityId(user),
            displayName: user?.displayName || "",
            avatarUrl: user?.avatarUrl ?? null,
        })),
        unreadCounts: toPlainUnreadCounts(rawConversation.unreadCounts),
        pinnedBy: (rawConversation.pinnedBy || []).map((entry) => ({
            userId: getEntityId(entry?.userId),
            pinnedAt: entry?.pinnedAt ?? null,
        })),
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

export const formatConversationForUser = (conversation, userId) => {
    const formattedConversation = formatConversationForSocket(conversation);
    const normalizedUserId = userId?.toString?.() || userId;
    const pinnedEntry = (formattedConversation.pinnedBy || []).find(
        (entry) => entry.userId === normalizedUserId
    );

    return {
        ...formattedConversation,
        isPinned: Boolean(pinnedEntry),
        pinnedAt: pinnedEntry?.pinnedAt ?? null,
    };
};

export const emitConversationUpsert = (io, conversation) => {
    getConversationParticipantIds(conversation).forEach((participantId) => {
        io.to(participantId).emit(
            "conversation-upsert",
            formatConversationForUser(conversation, participantId)
        );
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
