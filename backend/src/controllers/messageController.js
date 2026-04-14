import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { emitNewMessage, updateConversationAfterCreateMessage } from "../utils/messageHelper.js";
import { io } from "../socket/index.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
export const sendDirectMessage = async (req, res) => {
    try {
        
       
        const { recipientId, content, conversationId } = req.body;
        const senderId = req.user._id;

        if (!content && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: "Tin nhắn rỗng" });
        }

        let conversation;

        if (conversationId) {
            conversation = await Conversation.findById(conversationId);
        }

        if (!conversation) {
            conversation = await Conversation.create({
                type: "direct",
                participants: [
                    { userId: senderId, joinedAt: new Date() },
                    { userId: recipientId, joinedAt: new Date() }
                ],
                lastMessageAt: new Date(),
                unreadCounts: new Map(),
            });
        }

        //  upload nhiều ảnh
        let imageUrls = [];

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) =>
                uploadImageFromBuffer(file.buffer, {
                    folder: "moji_chat/messages",
                    transformation: [{ width: 800, crop: "limit" }],
                })
            );

            const results = await Promise.all(uploadPromises);
            imageUrls = results.map((r) => r.secure_url);
        }

        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content,
            imgUrls: imageUrls, //  đổi sang mảng
        });

        updateConversationAfterCreateMessage(conversation, message, senderId);
        await conversation.save();

        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message });

    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn trực tiếp", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};
export const sendGroupMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const senderId = req.user._id;
        const conversation = req.conversation;

        if (!content && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: "Tin nhắn rỗng" });
        }

        let imageUrls = [];

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) =>
                uploadImageFromBuffer(file.buffer, {
                    folder: "moji_chat/messages",
                })
            );

            const results = await Promise.all(uploadPromises);
            imageUrls = results.map(r => r.secure_url);
        }

        const message = await Message.create({
            conversationId: conversation._id, //  FIX QUAN TRỌNG
            senderId,
            content,
            imgUrls: imageUrls,
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
