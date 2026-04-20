import { v2 as cloudinary } from "cloudinary";
import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { io } from "../socket/index.js";

import { uploadFileFromBuffer, uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import {
  emitConversationUpsert,
  emitNewMessage,
  getConversationParticipantIds,
  updateConversationAfterCreateMessage
} from "../utils/messageHelper.js";

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

const buildAsciiFilename = (value = "download") => {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/\r\n"]/g, "-")
    .trim();

  return sanitized || "download";
};

const encodeContentDispositionFilename = (value = "download") =>
  encodeURIComponent(value)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const parseCloudinaryRawFile = (fileUrl, fallbackName = "download") => {
  const parsedUrl = new URL(fileUrl);
  const rawDeliveryPath = parsedUrl.pathname.split("/raw/upload/")[1];

  if (!rawDeliveryPath) {
    throw new Error("Cloudinary raw file URL is invalid");
  }

  const versionlessPath = rawDeliveryPath.replace(/^v\d+\//, "");
  const publicId = decodeURIComponent(versionlessPath);
  const extensionMatch = publicId.match(/\.([a-zA-Z0-9]+)$/);
  const fallbackExtensionMatch = fallbackName.match(/\.([a-zA-Z0-9]+)$/);

  return {
    publicId,
    format: extensionMatch?.[1]?.toLowerCase() ?? fallbackExtensionMatch?.[1]?.toLowerCase() ?? undefined,
  };
};

const getAuthorizedMessageFile = async (messageId, fileIndex, userId) => {
  const normalizedIndex = Number.parseInt(fileIndex, 10);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
    return { status: 400, payload: { message: "File index không hợp lệ" } };
  }

  const message = await Message.findById(messageId).lean();

  if (!message) {
    return { status: 404, payload: { message: "Message không tồn tại" } };
  }

  const isParticipant = await Conversation.exists({
    _id: message.conversationId,
    "participants.userId": userId,
  });

  if (!isParticipant) {
    return { status: 403, payload: { message: "Bạn không có quyền truy cập file này" } };
  }

  const file = message.fileUrls?.[normalizedIndex];

  if (!file?.url) {
    return { status: 404, payload: { message: "File không tồn tại" } };
  }

  return { file, normalizedIndex };
};
export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
    const senderId = req.user._id;
    const uploadedFiles = getUploadedFiles(req);

    let conversation;

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ message: "Tin nhắn rỗng" });
    }

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

    const isFirstMessageInConversation = !conversation.lastMessage?._id;

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
            originalName: file.originalname,
            mimeType: file.mimetype,
          });
        }
      });

      const results = await Promise.all(uploadPromises);

      results.forEach((result, index) => {
        const file = uploadedFiles[index];

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

    let extraRooms = [];

    if (isFirstMessageInConversation) {
      await conversation.populate([
        {
          path: "participants.userId",
          select: "displayName avatarUrl",
        },
        {
          path: "seenBy",
          select: "displayName avatarUrl",
        },
        {
          path: "lastMessage.senderId",
          select: "displayName avatarUrl",
        },
      ]);

      emitConversationUpsert(io, conversation);
      extraRooms = getConversationParticipantIds(conversation);
    }

    emitNewMessage(io, conversation, message, extraRooms);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn trực tiếp", error);
    console.log("FILES:", getUploadedFiles(req));
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id.toString();

    // ✅ CHECK emoji ở đây
    if (!ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ message: "Emoji không hợp lệ" });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.isRecalled) {
      return res.status(400).json({ message: "Tin nhắn đã thu hồi" });
    }

    if (!message.reactions) {
      message.reactions = new Map();
    }

    // 👇 LẤY danh sách user của emoji hiện tại
    const currentUsers = message.reactions.get(emoji) || [];

    // 👇 CHECK user đã react chưa
    const alreadyReacted = currentUsers.some(
      (id) => id.toString() === userId
    );

    if (alreadyReacted) {
      // ❌ ĐÃ REACT → XOÁ (UNREACT)
      const newUsers = currentUsers.filter(
        (id) => id.toString() !== userId
      );

      if (newUsers.length === 0) {
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, newUsers);
      }
    } else {
      // ✅ CHƯA REACT → XOÁ REACTION CŨ + ADD MỚI

      for (const [key, users] of message.reactions.entries()) {
        const filtered = users.filter(
          (id) => id.toString() !== userId
        );

        if (filtered.length === 0) {
          message.reactions.delete(key);
        } else {
          message.reactions.set(key, filtered);
        }
      }

      message.reactions.set(emoji, [...currentUsers, userId]);
    }

    await message.save();

    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });

  } catch (error) {
    console.error(error);
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
            originalName: file.originalname,
            mimeType: file.mimetype,
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

export const downloadMessageFile = async (req, res) => {
  try {
    const { messageId, fileIndex } = req.params;
    const fileResult = await getAuthorizedMessageFile(messageId, fileIndex, req.user._id);

    if ("status" in fileResult) {
      return res.status(fileResult.status).json(fileResult.payload);
    }

    const { file } = fileResult;
    const { publicId, format } = parseCloudinaryRawFile(file.url, file.name);
    const signedDownloadUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "raw",
      type: "upload",
      attachment: file.name || "download",
    });
    const upstreamResponse = await fetch(signedDownloadUrl);

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        message: `Không thể tải file nguồn. Upstream status: ${upstreamResponse.status}`,
      });
    }

    const contentType = upstreamResponse.headers.get("content-type") || file.type || "application/octet-stream";
    const contentLength = upstreamResponse.headers.get("content-length");
    const fileName = file.name || "download";
    const asciiFileName = buildAsciiFilename(fileName);

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeContentDispositionFilename(fileName)}`
    );
    res.setHeader("Cache-Control", "private, no-store, max-age=0");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Lỗi khi tải file đính kèm:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
