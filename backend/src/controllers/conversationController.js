import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { io } from "../socket/index.js";
import crypto from "crypto";

export const createConversation = async (req, res) => {
    try {
        const { type, name, memberIds } = req.body;
        const userId = req.user._id;

        if (!type ||
            (type === 'group' && !name) ||
            !Array.isArray(memberIds) ||
            memberIds.length === 0) {
            return res.status(400).json({ message: 'Tên nhóm và danh sách thành viên là bắt buộc' });
        }

        let conversation;
        if (type === 'direct') {
            const participantId = memberIds[0];

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
            conversation = new Conversation({
                type: 'group',
                participants: [
                    { userId },
                    ...memberIds.map(id => ({ userId: id }))
                ],
                group: {
                    name,
                    createdBy: userId,

                },
                lastMessageAt: new Date(),
            });

            await conversation.save();
        }

        if (!conversation) {
            return res.status(400).json({ nessage: "converstaion không hợp lệ" });

        }

        await conversation.populate([
            { path: 'participants.userId', select: 'displayName avatarUrl' },
            {
                path: 'seenBy',
                select: 'displayName avatarUrl',
            },
            { path: 'lastMessage.senderId', select: 'displayName avatarUrl' },
        ]);


        const participants = (conversation.participants || []).map((p) => ({
            _id: p.userId?._id,
            displayName: p.userId?.displayName,
            avatarUrl: p.userId?.avatarUrl ?? null,
            joinedAt: p.joinedAt,
        }));
        const formatted = { ...conversation.toObject(), participants };


        if (type === "group") {
            memberIds.forEach((userId) => {
                io.to(userId).emit("new-group", formatted);
            });
        }
        return res.status(201).json({ conversation: formatted });


    } catch (error) {
        console.error("Lỗi khi tạo conversation:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
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
                path: 'lastMessage.senderId',
                select: 'displayName avatarUrl',
            })
            .populate({
                path: 'seenBy',
                select: 'displayName avatarUrl',
            });

        const formatted = conversations.map((convo) => {
            const participants = (convo.participants || []).map((p) => ({
                _id: p.userId?._id,
                displayName: p.userId?.displayName,
                avatarUrl: p.userId?.avatarUrl ?? null,
                joinedAt: p.joinedAt,
            }));
            return {
                ...convo.toObject(),
                unreadCounts: convo.unreadCounts || {},
                participants,
            };
        });

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

        messages = messages.reverse();

        return res.status(200).json({ messages, nextCursor, });


    } catch (error) {
        console.error("Lỗi khi lấy messages:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
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

        // Kiểm tra user có phải creator của group không
        if (conversation.group?.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Chỉ người tạo nhóm mới có thể tạo link mời" });
        }

        // Tạo token duy nhất (36 ký tự)
        const invitationToken = crypto.randomBytes(18).toString('hex');
        
        // Token hết hạn sau 30 ngày
        const invitationExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        conversation.invitationToken = invitationToken;
        conversation.invitationExpiry = invitationExpiry;
        await conversation.save();

        // Tạo URL invitation
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const invitationUrl = `${frontendUrl}/join-group/${invitationToken}`;

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

        // Kiểm tra token còn hạn không
        if (conversation.invitationExpiry && new Date() > conversation.invitationExpiry) {
            return res.status(400).json({ message: "Link mời đã hết hạn" });
        }

        // Kiểm tra user đã là thành viên chưa
        const isAlreadyMember = conversation.participants.some(
            p => p.userId.toString() === userId.toString()
        );

        if (isAlreadyMember) {
            return res.status(400).json({ message: "Bạn đã là thành viên của nhóm này" });
        }

        // Thêm user vào nhóm
        conversation.participants.push({ userId });
        await conversation.save();

        await conversation.populate([
            { path: 'participants.userId', select: 'displayName avatarUrl' },
            { path: 'lastMessage.senderId', select: 'displayName avatarUrl' },
        ]);

        const formatted = {
            ...conversation.toObject(),
            participants: conversation.participants.map(p => ({
                _id: p.userId?._id,
                displayName: p.userId?.displayName,
                avatarUrl: p.userId?.avatarUrl ?? null,
                joinedAt: p.joinedAt,
            })),
        };

        // Thông báo cho các thành viên khác
        io.to(conversation._id.toString()).emit("member-joined", {
            conversation: formatted,
        });

        return res.status(200).json({
            conversation: formatted,
            message: "Tham gia nhóm thành công",
        });

    } catch (error) {
        console.error("Lỗi khi tham gia nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

