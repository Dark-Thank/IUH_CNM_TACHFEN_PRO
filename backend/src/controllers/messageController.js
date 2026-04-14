import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { emitNewMessage, updateConversationAfterCreateMessage } from "../utils/messageHelper.js";
import { io } from "../socket/index.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
export const sendDirectMessage = async (req, res) => {
    console.log("Body data:", req.body);

    try {
        const { recipientId, content, conversationId } = req.body;
        const senderId = req.user._id;

        let conversation;

        //  CHO PHÉP gửi ảnh mà không cần text
        if (!content && !req.file) {
            return res.status(400).json({ message: "Tin nhắn rỗng" });
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

        //  upload ảnh nếu có
        let imageUrl = null;

        if (req.file) {
            const result = await uploadImageFromBuffer(req.file.buffer, {
                folder: "moji_chat/messages",
                transformation: [{ width: 800, crop: "limit" }],
            });

            imageUrl = result.secure_url;
        }

        //  tạo message (THÊM image)
        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content,
            imgUrl: imageUrl,
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

        //  cho phép ảnh không cần text
        if (!content && !req.file) {
            return res.status(400).json({ message: "Tin nhắn rỗng" });
        }

        let imageUrl = null;

        if (req.file) {
            const result = await uploadImageFromBuffer(req.file.buffer, {
                folder: "moji_chat/messages",
            });

            imageUrl = result.secure_url;
        }

        const message = await Message.create({
            conversationId,
            senderId,
            content,
            imgUrl: imageUrl,
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

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Toggle pin
        const now = new Date();
        if (message.isPinned) {
            message.isPinned = false;
            message.pinnedBy = undefined;
            message.pinnedAt = undefined;
        } else {
            message.isPinned = true;
            message.pinnedBy = userId;
            message.pinnedAt = now;
        }

        await message.save();

        // notify via socket
        io.to(message.conversationId.toString()).emit("update-message", { message });

        return res.status(200).json({ message });
    } catch (error) {
        console.error("Lỗi khi toggle pin message:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const recallMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // only sender can recall
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Not allowed to recall this message" });
        }

        message.isRecalled = true;
        message.recalledAt = new Date();

        await message.save();

        io.to(message.conversationId.toString()).emit("update-message", { message });

        return res.status(200).json({ message });
    } catch (error) {
        console.error("Lỗi khi thu hồi tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};