import crypto from "crypto";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Friend from "../models/Friend.js";
import Message from "../models/Message.js";
import { io } from "../socket/index.js";
import { buildConversationSummary } from "../utils/conversationSummaryService.js";
import {
    emitConversationRemoved,
    emitConversationUpsert,
    emitNewMessage,
    formatConversationForUser,
    formatMessageForClient,
    formatMessagesForClient,
    getConversationParticipantIds,
    updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";

const GROUP_ROLES = {
    OWNER: "owner",
    DEPUTY: "deputy",
    MEMBER: "member",
};

const GROUP_PRIVACY = {
    PUBLIC: "public",
    PRIVATE: "private",
};

const conversationPopulate = [
    { path: "participants.userId", select: "displayName avatarUrl" },
    { path: "joinRequests.userId", select: "displayName avatarUrl username" },
    { path: "joinRequests.requestedBy", select: "displayName avatarUrl username" },
    { path: "joinRequests.addedBy", select: "displayName avatarUrl username" },
    { path: "seenBy", select: "displayName avatarUrl" },
    { path: "lastMessage.senderId", select: "displayName avatarUrl" },
];

const pair = (a, b) => (a < b ? [a, b] : [b, a]);

const normalizeId = (value) => {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    if (value._id) {
        return value._id.toString();
    }

    if (value.id) {
        return value.id.toString();
    }

    if (typeof value.toString === "function") {
        return value.toString();
    }

    return null;
};

const dedupeIds = (values = [], excludedIds = []) => {
    const excluded = new Set(excludedIds.map((value) => normalizeId(value)).filter(Boolean));

    return [...new Set((values || []).map((value) => normalizeId(value)).filter(Boolean))]
        .filter((value) => !excluded.has(value));
};

const getParticipant = (conversation, userId) => (
    (conversation.participants || []).find(
        (participant) => normalizeId(participant.userId) === normalizeId(userId)
    ) || null
);

const isGroupConversation = (conversation) => conversation?.type === "group";

const isPrivateGroup = (conversation) => conversation?.group?.privacy === GROUP_PRIVACY.PRIVATE;

const canApproveJoinRequests = (participant) => (
    participant?.role === GROUP_ROLES.OWNER || participant?.role === GROUP_ROLES.DEPUTY
);

const canRemoveTarget = (actor, target) => {
    if (!actor || !target) {
        return false;
    }

    if (normalizeId(actor.userId) === normalizeId(target.userId)) {
        return false;
    }

    if (actor.role === GROUP_ROLES.OWNER) {
        return true;
    }

    if (actor.role === GROUP_ROLES.DEPUTY) {
        return target.role !== GROUP_ROLES.OWNER;
    }

    return false;
};

const canManageDeputyRole = (actor, target) => (
    actor?.role === GROUP_ROLES.OWNER &&
    !!target &&
    target.role !== GROUP_ROLES.OWNER &&
    normalizeId(actor.userId) !== normalizeId(target.userId)
);

const ensureGroupConversation = (conversation, res) => {
    if (!conversation) {
        res.status(404).json({ message: "Cuộc trò chuyện không tồn tại" });
        return false;
    }

    if (!isGroupConversation(conversation)) {
        res.status(400).json({ message: "Chỉ hỗ trợ thao tác này cho nhóm chat" });
        return false;
    }

    return true;
};

const populateConversation = async (conversation) => {
    if (!conversation) {
        return null;
    }

    await conversation.populate(conversationPopulate);
    return conversation;
};

const loadConversation = async (conversationId) => {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
        return null;
    }

    return populateConversation(conversation);
};

const getParticipantDisplayName = (conversation, userId) => (
    getParticipant(conversation, userId)?.userId?.displayName || "Thành viên"
);

const quoteDisplayNames = (names = []) => {
    const filteredNames = names.map((value) => value?.trim()).filter(Boolean);

    if (filteredNames.length === 0) {
        return "thành viên mới";
    }

    if (filteredNames.length === 1) {
        return filteredNames[0];
    }

    if (filteredNames.length === 2) {
        return `${filteredNames[0]} và ${filteredNames[1]}`;
    }

    return `${filteredNames.slice(0, -1).join(", ")} và ${filteredNames[filteredNames.length - 1]}`;
};

const createGroupNoticeMessage = async (conversation, actorId, content, extraRooms = []) => {
    const trimmedContent = typeof content === "string" ? content.trim() : "";

    if (!conversation || !trimmedContent) {
        return null;
    }

    const noticeMessage = await Message.create({
        conversationId: conversation._id,
        senderId: actorId,
        content: trimmedContent,
        messageType: "text",
    });

    updateConversationAfterCreateMessage(conversation, noticeMessage, actorId);
    await conversation.save();
    await populateConversation(conversation);

    const formattedMessage = await formatMessageForClient(noticeMessage);

    emitConversationUpsert(io, conversation);
    emitNewMessage(io, conversation, formattedMessage, extraRooms);

    return formattedMessage;
};

const getInvitationUrl = (invitationToken) => {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    return `${frontendUrl}/join-group/${invitationToken}`;
};

const ensureGroupInvitation = async (conversation) => {
    const now = new Date();
    const hasValidToken = conversation.invitationToken
        && conversation.invitationExpiry
        && now <= conversation.invitationExpiry;

    if (hasValidToken) {
        return {
            invitationToken: conversation.invitationToken,
            invitationExpiry: conversation.invitationExpiry,
            invitationUrl: getInvitationUrl(conversation.invitationToken),
        };
    }

    const invitationToken = crypto.randomBytes(18).toString("hex");
    const invitationExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    conversation.invitationToken = invitationToken;
    conversation.invitationExpiry = invitationExpiry;
    await conversation.save();

    return {
        invitationToken,
        invitationExpiry,
        invitationUrl: getInvitationUrl(invitationToken),
    };
};

const ensureFriendsWithActor = async (actorId, memberIds = []) => {
    const checks = await Promise.all(
        memberIds.map(async (memberId) => {
            const [userA, userB] = pair(normalizeId(actorId), normalizeId(memberId));
            const friendship = await Friend.findOne({ userA, userB }).lean();
            return friendship ? null : memberId;
        })
    );

    return checks.filter(Boolean);
};

const seedUnreadCountsForParticipants = (conversation) => {
    if (!conversation.unreadCounts) {
        conversation.unreadCounts = new Map();
    }

    (conversation.participants || []).forEach((participant) => {
        const participantId = normalizeId(participant.userId);

        if (!participantId) {
            return;
        }

        if (conversation.unreadCounts instanceof Map) {
            if (!conversation.unreadCounts.has(participantId)) {
                conversation.unreadCounts.set(participantId, 0);
            }
            return;
        }

        if (conversation.unreadCounts[participantId] === undefined) {
            conversation.unreadCounts[participantId] = 0;
        }
    });
};

const addPendingJoinRequests = (conversation, userIds = [], requestedBy, source = "invite", addedBy = null) => {
    const participantIds = new Set(
        (conversation.participants || []).map((participant) => normalizeId(participant.userId)).filter(Boolean)
    );
    const pendingIds = new Set(
        (conversation.joinRequests || []).map((request) => normalizeId(request.userId)).filter(Boolean)
    );
    const createdIds = [];

    dedupeIds(userIds).forEach((userId) => {
        if (!userId || participantIds.has(userId) || pendingIds.has(userId)) {
            return;
        }

        conversation.joinRequests.push({
            userId,
            requestedBy,
            addedBy,
            source,
            requestedAt: new Date(),
        });
        pendingIds.add(userId);
        createdIds.push(userId);
    });

    return createdIds;
};

const removeParticipantState = (conversation, removedUserId) => {
    const removedId = normalizeId(removedUserId);

    conversation.participants = (conversation.participants || []).filter(
        (participant) => normalizeId(participant.userId) !== removedId
    );
    conversation.seenBy = (conversation.seenBy || []).filter(
        (seenUserId) => normalizeId(seenUserId) !== removedId
    );

    if (conversation.unreadCounts instanceof Map) {
        conversation.unreadCounts.delete(removedId);
        return;
    }

    if (conversation.unreadCounts && typeof conversation.unreadCounts === "object") {
        delete conversation.unreadCounts[removedId];
    }
};

const respondWithConversation = async (res, conversation, statusCode = 200) => {
    const populatedConversation = await populateConversation(conversation);
    return res.status(statusCode).json({
        conversation: formatConversationForUser(populatedConversation, res.req.user?._id),
    });
};
export const createConversation = async (req, res) => {
    try {
        const { type, name, memberIds, privacy } = req.body;
        const userId = req.user._id;
        const uniqueMemberIds = dedupeIds(memberIds, [userId]);
        const groupPrivacy = privacy === GROUP_PRIVACY.PRIVATE ? GROUP_PRIVACY.PRIVATE : GROUP_PRIVACY.PUBLIC;

        if (!type ||
            (type === 'group' && !name) ||
            !Array.isArray(memberIds) ||
            uniqueMemberIds.length === 0) {
            return res.status(400).json({ message: 'Tên nhóm và danh sách thành viên là bắt buộc' });
        }

        let conversation;
        if (type === 'direct') {
            const participantId = uniqueMemberIds[0];

            // Check if participant has blocked the user
            const isBlocked = await Block.findOne({
                blocker: participantId,
                blocked: userId
            });

            if (isBlocked) {
                return res.status(403).json({ message: "Bạn không thể tạo cuộc trò chuyện với người dùng này vì đã bị chặn" });
            }

            conversation = await Conversation.findOne({
                type: "direct",
                participants: {
                    $all: [
                        { $elemMatch: { userId } },
                        { $elemMatch: { userId: participantId } }
                    ]
                }
            });

            if (!conversation) {
                conversation = new Conversation({
                    type: 'direct',
                    participants: [{ userId }, { userId: participantId }],
                    lastMessageAt: new Date(),
                    unreadCounts: new Map(),
                });
                await conversation.save();
            }

        }

        if (type === 'group') {
            const invitationToken = crypto.randomBytes(18).toString("hex");
            const invitationExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            conversation = new Conversation({
                type: 'group',
                participants: [
                    { userId, role: GROUP_ROLES.OWNER },
                    ...uniqueMemberIds.map(id => ({ userId: id, role: GROUP_ROLES.MEMBER }))
                ],
                group: {
                    name,
                    createdBy: userId,
                    privacy: groupPrivacy,
                },
                lastMessageAt: new Date(),
                invitationToken,
                invitationExpiry,
            });

            await conversation.save();
        }

        if (!conversation) {
            return res.status(400).json({ nessage: "converstaion không hợp lệ" });

        }

        await populateConversation(conversation);
        if (type === "group") {
            const creatorName = getParticipantDisplayName(conversation, userId);

            await createGroupNoticeMessage(
                conversation,
                userId,
                conversation.group?.name?.trim()
                    ? `${creatorName} đã tạo nhóm "${conversation.group.name.trim()}"`
                    : `${creatorName} đã tạo nhóm mới`,
                [userId.toString(), ...uniqueMemberIds]
            );

            const formattedGroupConversation = formatConversationForUser(conversation, userId);

            uniqueMemberIds.forEach((memberId) => {
                io.to(memberId).emit("new-group", formatConversationForUser(conversation, memberId));
            });

            return res.status(201).json({ conversation: formattedGroupConversation });
        }

        return res.status(201).json({ conversation: formatConversationForUser(conversation, userId) });


    } catch (error) {
        console.error("Lỗi khi tạo conversation:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};
export const updateGroupAvatar = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const result = await uploadImageFromBuffer(req.file.buffer, {
            originalName: req.file.originalname,
        });

        const updated = await Conversation.findByIdAndUpdate(
            id,
            {
                "group.avatar": result.secure_url,
            },
            { new: true }
        )
            .populate([
                { path: "participants.userId", select: "displayName avatarUrl" },
                { path: "lastMessage.senderId", select: "displayName avatarUrl" },
            ]);

        emitConversationUpsert(io, updated);

        return res.status(200).json({
            conversation: formatConversationForSocket(updated),
        });

    } catch (error) {
        console.error("Update avatar error:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};
export const renameGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user._id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Tên nhóm không hợp lệ" });
        }

        const conversation = await Conversation.findByIdAndUpdate(
            id,
            {
                "group.name": name.trim(),
                updatedAt: new Date(),
            },
            { new: true }
        )
            .populate([
                { path: "participants.userId", select: "displayName avatarUrl" },
                { path: "lastMessage.senderId", select: "displayName avatarUrl" },
                { path: "seenBy", select: "displayName avatarUrl" },
            ]);

        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy nhóm" });
        }

        emitConversationUpsert(io, conversation);

        return res.json({ conversation: formatConversationForSocket(conversation) });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
};
export const getConversations = async (req, res) => {
    try {
        const userId = req.user._id;
        const conversations = await Conversation.find({
            'participants.userId': userId
        })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .populate({
                path: 'participants.userId',
                select: 'displayName avatarUrl',
            })
            .populate({
                path: 'joinRequests.userId',
                select: 'displayName avatarUrl username',
            })
            .populate({
                path: 'joinRequests.requestedBy',
                select: 'displayName avatarUrl username',
            })
            .populate({
                path: 'joinRequests.addedBy',
                select: 'displayName avatarUrl username',
            })
            .populate({
                path: 'lastMessage.senderId',
                select: 'displayName avatarUrl',
            })
            .populate({
                path: 'seenBy',
                select: 'displayName avatarUrl',
            });

        const formatted = conversations.map((convo) => formatConversationForUser(convo, userId));

        return res.status(200).json({ conversations: formatted });


    } catch (error) {
        console.error("Lỗi khi lấy conversations:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, cursor } = req.query;
        const query = { conversationId };

        if (cursor) {
            query.createdAt = { $lt: new Date(cursor) };
        }

        let messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) + 1);

        let nextCursor = null;

        if (messages.length > Number(limit)) {
            const nextMessage = messages[messages.length - 1];
            nextCursor = nextMessage.createdAt.toISOString();
            messages.pop();
        }

        messages = await formatMessagesForClient(messages.reverse());

        return res.status(200).json({ messages, nextCursor, });


    } catch (error) {
        console.error("Lỗi khi lấy messages:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const summarizeConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const requestedLimit = Number(req.query.limit);
        const summaryScope = req.query.scope === "unread" ? "unread" : "recent";

        const conversation = await Conversation.findOne({
            _id: conversationId,
            "participants.userId": userId,
        }).populate({
            path: "participants.userId",
            select: "displayName avatarUrl",
        });

        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
        }

        const normalizedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, 100)
            : 40;
        const messageQuery = summaryScope === "unread"
            ? {
                conversationId,
                senderId: { $ne: userId },
                seenBy: { $ne: userId },
            }
            : { conversationId };

        const messages = await Message.find(messageQuery)
            .sort({ createdAt: -1 })
            .limit(normalizedLimit)
            .populate({
                path: "senderId",
                select: "displayName",
            })
            .lean();

        if (messages.length === 0) {
            return res.status(200).json({
                summary: {
                    provider: "groq",
                    summary: summaryScope === "unread"
                        ? "Hiện không có tin nhắn chưa đọc để tóm tắt."
                        : "Cuộc trò chuyện hiện chưa có tin nhắn để tóm tắt.",
                    bullets: [],
                    actionItems: [],
                    messageCount: 0,
                    scope: summaryScope,
                },
            });
        }

        const summary = await buildConversationSummary({
            conversation,
            messages: messages.reverse(),
            userId,
            limit: requestedLimit,
            scope: summaryScope,
        });

        return res.status(200).json({ summary });
    } catch (error) {
        console.error("Lỗi khi tóm tắt cuộc trò chuyện:", error);

        if (error.code === "GROQ_API_KEY_MISSING") {
            return res.status(500).json({ message: "Thiếu cấu hình GROQ_API_KEY ở backend" });
        }

        if (error.code === "GROQ_REQUEST_FAILED") {
            return res.status(502).json({ message: "Không thể lấy phản hồi từ Groq", details: error.details });
        }

        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const toggleConversationPin = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id.toString();
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: "Cuoc tro chuyen khong ton tai" });
        }

        const isParticipant = conversation.participants.some(
            (participant) => participant.userId.toString() === userId
        );

        if (!isParticipant) {
            return res.status(403).json({ message: "Ban khong thuoc cuoc tro chuyen nay" });
        }

        const existingEntryIndex = (conversation.pinnedBy || []).findIndex(
            (entry) => entry.userId.toString() === userId
        );

        let isPinned = false;

        if (existingEntryIndex >= 0) {
            conversation.pinnedBy.splice(existingEntryIndex, 1);
        } else {
            conversation.pinnedBy.push({
                userId,
                pinnedAt: new Date(),
            });
            isPinned = true;
        }

        await conversation.save();
        await populateConversation(conversation);

        const formattedConversation = formatConversationForUser(conversation, userId);
        io.to(userId).emit("conversation-upsert", formattedConversation);

        return res.status(200).json({
            conversation: formattedConversation,
            isPinned,
        });
    } catch (error) {
        console.error("Loi khi toggle pin conversation:", error);
        return res.status(500).json({ message: "Loi he thong" });
    }
};

export const getUserConversationsForSocketIO = async (userId) => {
    try {
        const conversations = await Conversation.find(
            { "participants.userId": userId },
            { _id: 1 },
        );

        return conversations.map((c) => c._id.toString());
    } catch (error) {
        console.error("Lỗi khi fetch conversations: ", error);
        return [];
    }
};

export const markAsSeen = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id.toString();

        const conversation = await Conversation.findById(conversationId).lean();

        if (!conversation) {
            return res.status(404).json({ message: "Conversation không tồn tại" });
        }

        const last = conversation.lastMessage;
        if (!last) {
            return res.status(200).json({ message: "Không có tin nhắn nào để Mark as seen" });
        }

        if (last.senderId.toString() === userId) {
            return res.status(200).json({ message: "Sender khong can Mark as seen" });
        }

        const unreadMessages = await Message.find({
            conversationId,
            senderId: { $ne: userId },
            seenBy: { $ne: userId },
        });

        if (unreadMessages.length > 0) {
            await Message.updateMany(
                { _id: { $in: unreadMessages.map((message) => message._id) } },
                {
                    $addToSet: {
                        deliveredTo: userId,
                        seenBy: userId,
                    },
                }
            );

            const refreshedMessages = await Message.find({
                _id: { $in: unreadMessages.map((message) => message._id) },
            });

            const formattedMessages = await formatMessagesForClient(refreshedMessages);

            formattedMessages.forEach((message) => {
                io.to(conversationId).emit("update-message", { message });
            });
        }

        const updated = await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $addToSet: { seenBy: userId },
                $set: { [`unreadCounts.${userId}`]: 0 },
            }, {
            new: true,
        }
        )

        io.to(conversationId).emit("read-message", {
            conversation: updated,
            lastMessage: {
                _id: updated?.lastMessage._id,
                content: updated?.lastMessage.content,
                createdAt: updated?.lastMessage.createdAt,
                sender: {
                    _id: updated?.lastMessage.senderId,
                }
            }
        })

        return res.status(200).json({
            message: "Mark as seen",
            seenBy: updated?.seenBy || [],
            myUnreadCount: updated?.unreadCounts[userId] || 0,
        })

    } catch (error) {
        console.error("Lỗi khi Mark as seen:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
}

export const addGroupMembers = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { memberIds } = req.body;
        const actorId = req.user._id;

        if (!Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ message: "Danh sách thành viên không hợp lệ" });
        }

        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);

        if (!actor) {
            return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm" });
        }

        const nextMemberIds = dedupeIds(memberIds, conversation.participants.map((participant) => participant.userId));

        if (nextMemberIds.length === 0) {
            return res.status(400).json({ message: "Những người dùng này đã ở trong nhóm" });
        }

        const notFriends = await ensureFriendsWithActor(actorId, nextMemberIds);

        if (notFriends.length > 0) {
            return res.status(403).json({ message: "Bạn chỉ có thể thêm bạn bè vào nhóm", notFriends });
        }

        const actorName = getParticipantDisplayName(conversation, actorId);
        const requiresApproval = isPrivateGroup(conversation) && !canApproveJoinRequests(actor);

        if (requiresApproval) {
            const pendingIds = addPendingJoinRequests(conversation, nextMemberIds, actorId, "add", actorId);

            if (pendingIds.length === 0) {
                return res.status(400).json({ message: "Những người dùng này đã ở trong nhóm hoặc đang chờ duyệt" });
            }

            await conversation.save();
            await populateConversation(conversation);
            emitConversationUpsert(io, conversation);

            return res.status(200).json({
                conversation: formatConversationForUser(conversation, actorId),
                pendingApproval: true,
                message: "Đã gửi yêu cầu chờ chủ nhóm hoặc phó nhóm duyệt",
            });
        }

        conversation.participants.push(
            ...nextMemberIds.map((memberId) => ({
                userId: memberId,
                role: GROUP_ROLES.MEMBER,
            }))
        );
        seedUnreadCountsForParticipants(conversation);

        await conversation.save();
        await populateConversation(conversation);

        const addedMemberNames = nextMemberIds.map((memberId) => getParticipantDisplayName(conversation, memberId));

        await createGroupNoticeMessage(
            conversation,
            actorId,
            `${actorName} đã thêm ${quoteDisplayNames(addedMemberNames)} vào nhóm`
        );

        nextMemberIds.forEach((memberId) => {
            io.to(memberId).emit("new-group", formatConversationForUser(conversation, memberId));
        });

        return res.status(200).json({ conversation: formatConversationForUser(conversation, actorId) });
    } catch (error) {
        console.error("Lỗi khi thêm thành viên nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const generateInvitationLink = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: "Nhóm chat không tồn tại" });
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Chỉ nhóm chat mới có thể mời" });
        }

        const actor = getParticipant(conversation, userId);

        if (!actor) {
            return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm" });
        }

        if (false && conversation.group?.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Chỉ người tạo nhóm mới có thể tạo link mời" });
        }

        const { invitationToken, invitationExpiry, invitationUrl } = await ensureGroupInvitation(conversation);

        return res.status(200).json({
            invitationUrl,
            invitationToken,
            invitationExpiry,
            message: "Tạo link mời thành công",
        });
    } catch (error) {
        console.error("Lỗi khi tạo link mời:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const shareGroupInvitation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { recipientId } = req.body;
        const actorId = req.user._id;

        if (!recipientId) {
            return res.status(400).json({ message: "Thiếu người nhận lời mời" });
        }

        const groupConversation = await Conversation.findById(conversationId);

        if (!ensureGroupConversation(groupConversation, res)) {
            return;
        }

        const actor = getParticipant(groupConversation, actorId);

        if (!actor) {
            return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm" });
        }

        const isRecipientInGroup = groupConversation.participants.some(
            (participant) => normalizeId(participant.userId) === normalizeId(recipientId)
        );

        if (isRecipientInGroup) {
            return res.status(400).json({ message: "Người này đã là thành viên của nhóm" });
        }

        const [userA, userB] = pair(normalizeId(actorId), normalizeId(recipientId));
        const friendship = await Friend.findOne({ userA, userB }).lean();

        if (!friendship) {
            return res.status(403).json({ message: "Bạn chỉ có thể gửi lời mời cho bạn bè" });
        }

        const blocked = await Block.findOne({
            $or: [
                { blocker: recipientId, blocked: actorId },
                { blocker: actorId, blocked: recipientId },
            ],
        }).lean();

        if (blocked) {
            return res.status(403).json({ message: "Không thể gửi lời mời vì đã có chặn giữa hai người dùng" });
        }

        const { invitationToken, invitationExpiry, invitationUrl } = await ensureGroupInvitation(groupConversation);
        let directConversation = await Conversation.findOne({
            type: "direct",
            participants: {
                $all: [
                    { $elemMatch: { userId: actorId } },
                    { $elemMatch: { userId: recipientId } },
                ],
            },
        });
        const isFirstMessageInConversation = !directConversation?.lastMessage?._id;

        if (!directConversation) {
            directConversation = await Conversation.create({
                type: "direct",
                participants: [
                    { userId: actorId, joinedAt: new Date() },
                    { userId: recipientId, joinedAt: new Date() },
                ],
                lastMessageAt: new Date(),
                unreadCounts: new Map(),
            });
        }

        const groupName = groupConversation.group?.name?.trim() || "Nhóm chat";
        const message = await Message.create({
            conversationId: directConversation._id,
            senderId: actorId,
            content: `Mời bạn tham gia nhóm "${groupName}"`,
            messageType: "group_invite",
            groupInviteMeta: {
                conversationId: groupConversation._id,
                groupName,
                invitationToken,
                invitationUrl,
                invitedBy: actorId,
                expiresAt: invitationExpiry,
            },
        });

        updateConversationAfterCreateMessage(directConversation, message, actorId);
        await directConversation.save();
        await populateConversation(directConversation);

        const formattedMessage = await formatMessageForClient(message);
        const extraRooms = isFirstMessageInConversation
            ? getConversationParticipantIds(directConversation)
            : [];

        if (isFirstMessageInConversation) {
            emitConversationUpsert(io, directConversation);
        }

        emitNewMessage(io, directConversation, formattedMessage, extraRooms);

        return res.status(201).json({
            message: formattedMessage,
            conversation: formatConversationForUser(directConversation, actorId),
        });
    } catch (error) {
        console.error("Lỗi khi chia sẻ lời mời nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const removeGroupMember = async (req, res) => {
    try {
        const { conversationId, memberId } = req.params;
        const actorId = req.user._id;
        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);
        const target = getParticipant(conversation, memberId);

        if (!actor) {
            return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm" });
        }

        if (!target) {
            return res.status(404).json({ message: "Thành viên không tồn tại trong nhóm" });
        }

        if (!canRemoveTarget(actor, target)) {
            return res.status(403).json({ message: "Bạn không có quyền xóa thành viên này" });
        }

        const actorName = getParticipantDisplayName(conversation, actorId);
        const removedMemberName = getParticipantDisplayName(conversation, memberId);

        removeParticipantState(conversation, memberId);
        await conversation.save();
        await populateConversation(conversation);

        await createGroupNoticeMessage(
            conversation,
            actorId,
            `${actorName} đã xóa ${removedMemberName} khỏi nhóm`
        );

        emitConversationRemoved(io, conversationId, [memberId]);

        return res.status(200).json({ conversation: formatConversationForUser(conversation, actorId) });
    } catch (error) {
        console.error("Lỗi khi xóa thành viên nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const updateGroupMemberRole = async (req, res) => {
    try {
        const { conversationId, memberId } = req.params;
        const { role } = req.body;
        const actorId = req.user._id;
        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        if (![GROUP_ROLES.DEPUTY, GROUP_ROLES.MEMBER].includes(role)) {
            return res.status(400).json({ message: "Vai trò không hợp lệ" });
        }

        const actor = getParticipant(conversation, actorId);
        const target = getParticipant(conversation, memberId);

        if (!actor || !target) {
            return res.status(404).json({ message: "Không tìm thấy thành viên trong nhóm" });
        }

        if (!canManageDeputyRole(actor, target)) {
            return res.status(403).json({ message: "Chỉ chủ nhóm mới được phân quyền phó nhóm" });
        }

        target.role = role;
        await conversation.save();

        emitConversationUpsert(io, await populateConversation(conversation));

        return res.status(200).json({ conversation: formatConversationForUser(conversation, actorId) });
    } catch (error) {
        console.error("Lỗi khi cập nhật vai trò thành viên:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const transferGroupOwnership = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { newOwnerId } = req.body;
        const actorId = req.user._id;
        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);
        const target = getParticipant(conversation, newOwnerId);

        if (!actor || actor.role !== GROUP_ROLES.OWNER) {
            return res.status(403).json({ message: "Chỉ chủ nhóm mới được chuyển quyền chủ nhóm" });
        }

        if (!target) {
            return res.status(404).json({ message: "Người nhận quyền không ở trong nhóm" });
        }

        if (normalizeId(actor.userId) === normalizeId(target.userId)) {
            return res.status(400).json({ message: "Người nhận quyền phải khác chủ nhóm hiện tại" });
        }

        actor.role = GROUP_ROLES.MEMBER;
        target.role = GROUP_ROLES.OWNER;
        if (conversation.group) {
            conversation.group.createdBy = target.userId;
        }

        await conversation.save();
        emitConversationUpsert(io, await populateConversation(conversation));

        return res.status(200).json({ conversation: formatConversationForUser(conversation, actorId) });
    } catch (error) {
        console.error("Lỗi khi chuyển quyền chủ nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const actorId = req.user._id;
        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);

        if (!actor) {
            return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm" });
        }

        if (actor.role === GROUP_ROLES.OWNER) {
            return res.status(400).json({
                message: conversation.participants.length > 1
                    ? "Chủ nhóm phải chuyển quyền chủ nhóm trước khi rời nhóm"
                    : "Chủ nhóm là người cuối cùng, hãy giải tán nhóm thay vì rời nhóm",
            });
        }

        const actorName = getParticipantDisplayName(conversation, actorId);

        removeParticipantState(conversation, actorId);
        await conversation.save();
        await populateConversation(conversation);

        await createGroupNoticeMessage(
            conversation,
            actorId,
            `${actorName} đã rời nhóm`
        );

        emitConversationRemoved(io, conversationId, [actorId]);

        return res.status(200).json({ message: "Đã rời nhóm", conversationId });
    } catch (error) {
        console.error("Lỗi khi rời nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const disbandGroup = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const actorId = req.user._id;
        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);

        if (!actor || actor.role !== GROUP_ROLES.OWNER) {
            return res.status(403).json({ message: "Chỉ chủ nhóm mới được giải tán nhóm" });
        }

        const participantIds = getConversationParticipantIds(conversation);

        await Message.deleteMany({ conversationId });
        await Conversation.deleteOne({ _id: conversationId });

        emitConversationRemoved(io, conversationId, participantIds);

        return res.status(200).json({ message: "Đã giải tán nhóm", conversationId });
    } catch (error) {
        console.error("Lỗi khi giải tán nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const joinGroupByToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user._id;

        if (!token) {
            return res.status(400).json({ message: "Token không hợp lệ" });
        }

        const conversation = await Conversation.findOne({ invitationToken: token });

        if (!conversation) {
            return res.status(404).json({ message: "Link mời không tồn tại hoặc đã hết hạn" });
        }

        if (conversation.type !== "group") {
            return res.status(400).json({ message: "Link mời chỉ áp dụng cho nhóm chat" });
        }

        if (conversation.invitationExpiry && new Date() > conversation.invitationExpiry) {
            return res.status(400).json({ message: "Link mời đã hết hạn" });
        }

        const isAlreadyMember = conversation.participants.some(
            (participant) => participant.userId.toString() === userId.toString()
        );

        if (isAlreadyMember) {
            return res.status(400).json({ message: "Bạn đã là thành viên của nhóm này" });
        }

        if (isPrivateGroup(conversation)) {
            const pendingIds = addPendingJoinRequests(conversation, [userId], userId, "invite", null);

            if (pendingIds.length === 0) {
                return res.status(400).json({ message: "Yêu cầu tham gia đã được gửi hoặc bạn đã là thành viên" });
            }

            await conversation.save();
            await populateConversation(conversation);
            emitConversationUpsert(io, conversation);

            return res.status(200).json({
                pendingApproval: true,
                message: "Đã gửi yêu cầu chờ chủ nhóm hoặc phó nhóm duyệt",
            });
        }

        conversation.participants.push({ userId, role: GROUP_ROLES.MEMBER });
        seedUnreadCountsForParticipants(conversation);
        await conversation.save();

        await populateConversation(conversation);
        const actorName = getParticipantDisplayName(conversation, userId);

        await createGroupNoticeMessage(
            conversation,
            userId,
            `${actorName} đã tham gia nhóm`,
            [userId.toString()]
        );
        const formattedConversation = formatConversationForUser(conversation, userId);

        io.to(userId.toString()).emit("new-group", formattedConversation);

        return res.status(200).json({
            conversation: formattedConversation,
            message: "Tham gia nhóm thành công",
        });
    } catch (error) {
        console.error("Lỗi khi tham gia nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const respondToGroupInvitation = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { action } = req.body;
        const userId = req.user._id;

        if (!["accept", "decline"].includes(action)) {
            return res.status(400).json({ message: "Hanh dong khong hop le" });
        }

        const inviteMessage = await Message.findById(messageId);

        if (!inviteMessage || inviteMessage.messageType !== "group_invite" || !inviteMessage.groupInviteMeta) {
            return res.status(404).json({ message: "Loi moi khong ton tai" });
        }

        const directConversation = await loadConversation(inviteMessage.conversationId);

        if (!directConversation) {
            return res.status(404).json({ message: "Cuoc tro chuyen khong ton tai" });
        }

        const isDirectParticipant = directConversation.participants.some(
            (participant) => normalizeId(participant.userId) === normalizeId(userId)
        );

        if (!isDirectParticipant || normalizeId(inviteMessage.senderId) === normalizeId(userId)) {
            return res.status(403).json({ message: "Ban khong co quyen phan hoi loi moi nay" });
        }

        if (inviteMessage.groupInviteMeta.responseStatus) {
            return res.status(400).json({ message: "Loi moi nay da duoc phan hoi" });
        }

        const groupConversation = await Conversation.findById(inviteMessage.groupInviteMeta.conversationId);

        if (!groupConversation || groupConversation.type !== "group") {
            return res.status(404).json({ message: "Nhom khong ton tai" });
        }

        if (action === "accept") {
            if (groupConversation.invitationExpiry && new Date() > groupConversation.invitationExpiry) {
                return res.status(400).json({ message: "Link moi da het han" });
            }

            const isAlreadyMember = groupConversation.participants.some(
                (participant) => normalizeId(participant.userId) === normalizeId(userId)
            );

            if (!isAlreadyMember && isPrivateGroup(groupConversation)) {
                const pendingIds = addPendingJoinRequests(groupConversation, [userId], userId, "invite", inviteMessage.groupInviteMeta.invitedBy);

                if (pendingIds.length === 0) {
                    return res.status(400).json({ message: "Yêu cầu tham gia đã được gửi hoặc bạn đã là thành viên" });
                }

                await groupConversation.save();
                await populateConversation(groupConversation);
                emitConversationUpsert(io, groupConversation);
            } else if (!isAlreadyMember) {
                groupConversation.participants.push({ userId, role: GROUP_ROLES.MEMBER });
                seedUnreadCountsForParticipants(groupConversation);
                await groupConversation.save();
                await populateConversation(groupConversation);

                const actorName = getParticipantDisplayName(groupConversation, userId);

                await createGroupNoticeMessage(
                    groupConversation,
                    userId,
                    `${actorName} đã tham gia nhóm`,
                    [userId.toString()]
                );

                io.to(userId.toString()).emit("new-group", formatConversationForUser(groupConversation, userId));
            } else {
                await populateConversation(groupConversation);
            }
        }

        const responseStatus = action === "accept" && isPrivateGroup(groupConversation) ? "pending" : action === "accept" ? "accepted" : "declined";
        inviteMessage.groupInviteMeta.responseStatus = responseStatus;
        inviteMessage.groupInviteMeta.respondedBy = userId;
        inviteMessage.groupInviteMeta.respondedAt = new Date();
        inviteMessage.markModified("groupInviteMeta");
        await inviteMessage.save();

        const formattedInviteMessage = await formatMessageForClient(inviteMessage);
        io.to(inviteMessage.conversationId.toString()).emit("update-message", { message: formattedInviteMessage });

        return res.status(200).json({
            message: action === "accept" ? "Đã chấp nhận lời mời" : "Đã từ chối lời mời",
            inviteMessage: formattedInviteMessage,
            conversation: responseStatus === "accepted" ? formatConversationForUser(groupConversation, userId) : null,
            status: responseStatus,
        });
    } catch (error) {
        console.error("Loi khi phan hoi loi moi nhom:", error);
        return res.status(500).json({ message: "Loi he thong" });
    }
};

export const reviewGroupJoinRequest = async (req, res) => {
    try {
        const { conversationId, userId: requestUserId } = req.params;
        const { action } = req.body;
        const actorId = req.user._id;

        if (!["accept", "decline"].includes(action)) {
            return res.status(400).json({ message: "Hành động không hợp lệ" });
        }

        const conversation = await loadConversation(conversationId);

        if (!ensureGroupConversation(conversation, res)) {
            return;
        }

        const actor = getParticipant(conversation, actorId);

        if (!canApproveJoinRequests(actor)) {
            return res.status(403).json({ message: "Chỉ chủ nhóm hoặc phó nhóm có thể duyệt thành viên" });
        }

        const requestIndex = (conversation.joinRequests || []).findIndex(
            (request) => normalizeId(request.userId) === normalizeId(requestUserId)
        );

        if (requestIndex < 0) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu chờ duyệt" });
        }

        const [joinRequest] = conversation.joinRequests.splice(requestIndex, 1);
        const isAlreadyMember = conversation.participants.some(
            (participant) => normalizeId(participant.userId) === normalizeId(requestUserId)
        );

        if (action === "accept" && !isAlreadyMember) {
            conversation.participants.push({ userId: requestUserId, role: GROUP_ROLES.MEMBER });
            seedUnreadCountsForParticipants(conversation);
        }

        await conversation.save();
        await populateConversation(conversation);

        if (action === "accept") {
            const actorName = getParticipantDisplayName(conversation, actorId);
            const memberName = getParticipantDisplayName(conversation, requestUserId);

            await createGroupNoticeMessage(
                conversation,
                actorId,
                `${actorName} đã duyệt ${memberName} tham gia nhóm`
            );

            io.to(requestUserId.toString()).emit("new-group", formatConversationForUser(conversation, requestUserId));
        } else {
            emitConversationUpsert(io, conversation);
        }

        const inviteStatus = action === "accept" ? "accepted" : "declined";
        const inviteMessages = await Message.find({
            messageType: "group_invite",
            "groupInviteMeta.conversationId": conversation._id,
            "groupInviteMeta.respondedBy": requestUserId,
            "groupInviteMeta.responseStatus": "pending",
        });

        await Promise.all(inviteMessages.map(async (inviteMessage) => {
            inviteMessage.groupInviteMeta.responseStatus = inviteStatus;
            inviteMessage.groupInviteMeta.respondedAt = new Date();
            inviteMessage.markModified("groupInviteMeta");
            await inviteMessage.save();

            const formattedInviteMessage = await formatMessageForClient(inviteMessage);
            io.to(inviteMessage.conversationId.toString()).emit("update-message", { message: formattedInviteMessage });
        }));

        return res.status(200).json({
            conversation: formatConversationForUser(conversation, actorId),
            request: joinRequest,
            status: inviteStatus,
        });
    } catch (error) {
        console.error("Lỗi khi duyệt yêu cầu tham gia nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

