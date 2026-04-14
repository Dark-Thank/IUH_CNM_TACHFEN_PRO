import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { emitNewMessage, updateConversationAfterCreateMessage } from "../utils/messageHelper.js";
import { io } from "../socket/index.js";

export const sendDirectMessage = async (req, res) => {
    console.log("Body data:", req.body);
    try {
        const { recipientId, content, conversationId } = req.body;
        const senderId = req.user._id;

        let conversation;

        if (!content) {
            return res.status(400).json({ message: "Thiếu nội dung" });
        }

        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
        }

        if (!conversation) {
            conversation = await Conversation.create({
                type: 'direct',
                participants: [
                    { userId: senderId, joinedAt: new Date() },
                    { userId: recipientId, joinedAt: new Date() }
                ],
                lastMessageAt: new Date(),
                unreadCounts: new Map(),
            });
        }

        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content,
        });

        updateConversationAfterCreateMessage(conversation, message, senderId);

        await conversation.save();

        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message });

    } catch (error) {
        console.error('Lỗi khi gửi tin nhắn trực tiếp', error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const sendGroupMessage = async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const senderId = req.user._id;
        const conversation = req.conversation;

        if (!content) {
            return res.status(400).json({ message: "Thiếu nội dung" });
        }

        const message = await Message.create({
            conversationId,
            senderId,
            content,
        });

        updateConversationAfterCreateMessage(conversation, message, senderId);

        await conversation.save();
        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message });

    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn nhóm:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const togglePinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId).populate('conversationId');

        if (!message) {
            return res.status(404).json({ message: "Tin nhắn không tồn tại" });
        }

        const conversationId = message.conversationId._id;
        const conversation = await Conversation.findById(conversationId);

        if (!conversation || !conversation.participants.some(p => p.userId.toString() === userId.toString())) {
            return res.status(403).json({ message: "Không có quyền ghim tin nhắn" });
        }

        message.isPinned = !message.isPinned;
        if (message.isPinned) {
            message.pinnedBy = userId;
            message.pinnedAt = new Date();
        } else {
            message.pinnedBy = null;
            message.pinnedAt = null;
        }

        await message.save();

        await message.populate('pinnedBy', 'displayName avatarUrl');

        io.to(conversationId.toString()).emit('messagePinned', {
            messageId: message._id.toString(),
            isPinned: message.isPinned,
            pinnedBy: message.pinnedBy?._id,
            pinnedAt: message.pinnedAt
        });

        res.json({ 
            message: {
                _id: message._id,
                isPinned: message.isPinned,
                pinnedBy: message.pinnedBy,
                pinnedAt: message.pinnedAt
            }
        });

    } catch (error) {
        console.error('Lỗi khi ghim tin nhắn:', error);
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const recallMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId).populate('conversationId senderId', 'displayName');

        if (!message) {
            return res.status(404).json({ message: "Tin nhắn không tồn tại" });
        }

        if (message.senderId._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Chỉ người gửi mới thu hồi được" });
        }

        // Update to recalled
        message.content = '[Tin nhắn đã thu hồi]';
        message.isRecalled = true;
        message.recalledAt = new Date();

        await message.save();

        await message.populate('conversationId');

        // Emit to room
        io.to(message.conversationId._id.toString()).emit('messageRecalled', {
            messageId: message._id.toString(),
            content: message.content,
            isRecalled: message.isRecalled,
            recalledAt: message.recalledAt,
            senderId: message.senderId._id
        });

        res.json({ 
            message: {
                _id: message._id,
                content: message.content,
                isRecalled: message.isRecalled,
                recalledAt: message.recalledAt
            }
        });

    } catch (error) {
        console.error('Lỗi khi thu hồi tin nhắn:', error);
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

