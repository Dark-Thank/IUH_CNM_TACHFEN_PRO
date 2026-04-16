import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { io } from "../socket/index.js";

import { uploadFileFromBuffer, uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import { emitNewMessage, updateConversationAfterCreateMessage } from "../utils/messageHelper.js";

const getUploadedFiles = (req) => {
  if (!req.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return [
    ...(req.files.files || []),
    ...(req.files.images || []),
  ];
};

export const sendDirectMessage = async (req, res) => {
    try {

      console.log("REQ.USER:", req.user);   // 👈 THÊM Ở ĐÂY
    console.log("BODY:", req.body);  
        const { recipientId, content, conversationId } = req.body;
        const senderId = req.user._id;
        const uploadedFiles = getUploadedFiles(req);
        

        let conversation;


        if (!content && uploadedFiles.length === 0) {
            return res.status(400).json({ message: "Tin nhắn rỗng" });
        }

        // Check if recipient has blocked sender
        const isBlocked = await Block.findOne({
            blocker: recipientId,
            blocked: senderId
        });

        if (isBlocked) {
            return res.status(403).json({ message: "Bạn không thể gửi tin nhắn cho người dùng này vì đã bị chặn" });
        }

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
        let imageUrls = [];
let fileUrls = [];

if (uploadedFiles.length > 0) {
  const uploadPromises = uploadedFiles.map((file) => {
    if (file.mimetype.startsWith("image/")) {
      return uploadImageFromBuffer(file.buffer, {
        folder: "moji_chat/messages",
        transformation: [{ width: 800, crop: "limit" }],
      });
    } else {
      return uploadFileFromBuffer(file.buffer, {
        folder: "moji_chat/files",
      });
    }
  });

  const results = await Promise.all(uploadPromises);

  results.forEach((result, index) => {
    const file = uploadedFiles[index];

    // 🔥 FIX: validate secure_url
    if (!result?.secure_url) return;

    if (file.mimetype.startsWith("image/")) {
      imageUrls.push(result.secure_url);
    } else {
      fileUrls.push({
        url: result.secure_url,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      });
    }
  });
}
        const message = await Message.create({
            conversationId: conversation._id,
            senderId,
            content,
            imgUrls: imageUrls, //  đổi sang mảng
            fileUrls,

        });

        updateConversationAfterCreateMessage(conversation, message, senderId);
        await conversation.save();

        emitNewMessage(io, conversation, message);

        return res.status(201).json({ message });
        

    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn trực tiếp", error);
        console.log("FILES:", getUploadedFiles(req));
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const uploadedFiles = getUploadedFiles(req);

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ message: "Tin nhắn rỗng" });
    }

    let imageUrls = [];
    let fileUrls = [];

    // FIX: thêm xử lý FILE giống direct
    if (uploadedFiles.length > 0) {
      const uploadPromises = uploadedFiles.map((file) => {
        if (file.mimetype.startsWith("image/")) {
          return uploadImageFromBuffer(file.buffer, {
            folder: "moji_chat/messages",
          });
        } else {
          return uploadFileFromBuffer(file.buffer, {
            folder: "moji_chat/files",
          });
        }
      });

      const results = await Promise.all(uploadPromises);

      results.forEach((result, index) => {
        const file = uploadedFiles[index];

        if (!result?.secure_url) {
          return;
        }

        if (file.mimetype.startsWith("image/")) {
          imageUrls.push(result.secure_url);
        } else {
          fileUrls.push({
            url: result.secure_url,
            name: file.originalname,
            size: file.size,
            type: file.mimetype,
          });
        }
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content,
      imgUrls: imageUrls,
      fileUrls,
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
        message.recallBy = userId;
        message.content = null;        // Hide text content
        message.imgUrls = [];          // Hide images
        message.fileUrls = [];         // 🔥 HIDE FILES - Fix filename display

        await message.save();

        io.to(message.conversationId.toString()).emit("update-message", { message });

        return res.status(200).json({ message });
    } catch (error) {
        console.error("Lỗi khi thu hồi tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi hệ thống" });
    }
};