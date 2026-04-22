import { v2 as cloudinary } from "cloudinary";
import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { io } from "../socket/index.js";

import { uploadFileFromBuffer, uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import {
  emitConversationUpsert,
  emitNewMessage,
  formatMessageForClient,
  getConversationParticipantIds,
  updateConversationAfterCreateMessage
} from "../utils/messageHelper.js";

const normalizeOptionalText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const cloneFileUrls = (fileUrls = []) =>
  fileUrls.map((file) => ({
    url: file.url,
    name: file.name,
    size: file.size,
    type: file.type,
  }));

const buildForwardedFromSnapshot = (message) => ({
  messageId: message._id,
  conversationId: message.conversationId,
  senderId: message.senderId,
  content: message.content ?? null,
  imgUrls: [...(message.imgUrls || [])],
  fileUrls: cloneFileUrls(message.fileUrls || []),
  createdAt: message.createdAt,
});

const buildReplySnapshot = (message) => ({
  messageId: message._id,
  senderId: message.senderId,
  content: message.content ?? null,
  messageType: message.messageType || "text",
  imgUrls: [...(message.imgUrls || [])],
  fileUrls: cloneFileUrls(message.fileUrls || []),
  createdAt: message.createdAt,
});

const resolveForwardedMessage = async (forwardedFromMessageId, userId) => {
  if (!forwardedFromMessageId) {
    return { forwardedMessage: null, forwardedFrom: null };
  }

  const forwardedMessage = await Message.findById(forwardedFromMessageId).lean();

  if (!forwardedMessage) {
    return {
      error: {
        status: 404,
        payload: { message: "Tin nhắn cần chuyển tiếp không tồn tại" },
      },
    };
  }

  if (forwardedMessage.isRecalled) {
    return {
      error: {
        status: 400,
        payload: { message: "Không thể chuyển tiếp tin nhắn đã thu hồi" },
      },
    };
  }

  const isParticipant = await Conversation.exists({
    _id: forwardedMessage.conversationId,
    "participants.userId": userId,
  });

  if (!isParticipant) {
    return {
      error: {
        status: 403,
        payload: { message: "Bạn không có quyền chuyển tiếp tin nhắn này" },
      },
    };
  }

  return {
    forwardedMessage,
    forwardedFrom: buildForwardedFromSnapshot(forwardedMessage),
  };
};

const resolveReplyMessage = async ({ replyToMessageId, conversationId, userId }) => {
  if (!replyToMessageId) {
    return { replyMessage: null, replyTo: null };
  }

  if (!conversationId) {
    return {
      error: {
        status: 400,
        payload: { message: "Cần conversationId để trả lời tin nhắn" },
      },
    };
  }

  const replyMessage = await Message.findById(replyToMessageId).lean();

  if (!replyMessage) {
    return {
      error: {
        status: 404,
        payload: { message: "Tin nhắn được trả lời không tồn tại" },
      },
    };
  }

  if (replyMessage.conversationId.toString() !== conversationId.toString()) {
    return {
      error: {
        status: 400,
        payload: { message: "Chỉ có thể trả lời tin nhắn trong cùng cuộc trò chuyện" },
      },
    };
  }

  const isParticipant = await Conversation.exists({
    _id: conversationId,
    "participants.userId": userId,
  });

  if (!isParticipant) {
    return {
      error: {
        status: 403,
        payload: { message: "Bạn không có quyền trả lời tin nhắn này" },
      },
    };
  }

  if (replyMessage.isRecalled) {
    return {
      error: {
        status: 400,
        payload: { message: "Không thể trả lời tin nhắn đã thu hồi" },
      },
    };
  }

  return {
    replyMessage,
    replyTo: buildReplySnapshot(replyMessage),
  };
};

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

const isAudioFile = (file) => file?.mimetype?.startsWith("audio/");

const parseVoiceDurationSeconds = (value) => {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
};

const buildVoiceMessageMeta = ({ content, uploadedFiles, voiceDurationSeconds }) => {
  const imageCount = uploadedFiles.filter((file) => file.mimetype?.startsWith("image/")).length;
  const audioFiles = uploadedFiles.filter(isAudioFile);

  if (imageCount > 0 || audioFiles.length !== 1 || uploadedFiles.length !== 1) {
    return {
      messageType: "text",
      voiceMeta: null,
    };
  }

  return {
    messageType: "voice",
    voiceMeta: {
      durationSeconds: parseVoiceDurationSeconds(voiceDurationSeconds),
      mimeType: audioFiles[0].mimetype || null,
    },
  };
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
    const { recipientId, content, conversationId, forwardedFromMessageId, replyToMessageId, voiceDurationSeconds } = req.body;
    const senderId = req.user._id;
    const uploadedFiles = getUploadedFiles(req);
    const trimmedContent = normalizeOptionalText(content);

    const forwardedResult = await resolveForwardedMessage(
      forwardedFromMessageId,
      senderId
    );

    if (forwardedResult.error) {
      return res.status(forwardedResult.error.status).json(forwardedResult.error.payload);
    }

    const { forwardedMessage, forwardedFrom } = forwardedResult;

    let conversation;

    if (forwardedMessage && uploadedFiles.length > 0) {
      return res.status(400).json({ message: "Không thể thêm file mới khi chuyển tiếp tin nhắn" });
    }

    if (!trimmedContent && uploadedFiles.length === 0 && !forwardedMessage) {
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

    const replyResult = await resolveReplyMessage({
      replyToMessageId,
      conversationId: conversation._id,
      userId: senderId,
    });

    if (replyResult.error) {
      return res.status(replyResult.error.status).json(replyResult.error.payload);
    }

    const { replyTo } = replyResult;

    const isFirstMessageInConversation = !conversation.lastMessage?._id;

    let imageUrls = forwardedMessage ? [...(forwardedMessage.imgUrls || [])] : [];
    let fileUrls = forwardedMessage ? cloneFileUrls(forwardedMessage.fileUrls || []) : [];

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
    const resolvedContent = trimmedContent || forwardedMessage?.content || null;

    if (!resolvedContent && imageUrls.length === 0 && fileUrls.length === 0) {
      return res.status(400).json({ message: "Tin nhắn chuyển tiếp không có nội dung hợp lệ" });
    }

    const { messageType, voiceMeta } = buildVoiceMessageMeta({
      content: resolvedContent,
      uploadedFiles,
      voiceDurationSeconds,
    });

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: resolvedContent,
      messageType,
      voiceMeta,
      imgUrls: imageUrls,
      fileUrls,
      forwardedFrom,
      replyTo,
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

    const formattedMessage = await formatMessageForClient(message);

    emitNewMessage(io, conversation, formattedMessage, extraRooms);

    return res.status(201).json({ message: formattedMessage });
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

    const formattedMessage = await formatMessageForClient(message);

    io.to(message.conversationId.toString()).emit("update-message", { message: formattedMessage });

    return res.status(200).json({ message: formattedMessage });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
export const sendGroupMessage = async (req, res) => {
  try {
    const { content, forwardedFromMessageId, replyToMessageId, voiceDurationSeconds } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const uploadedFiles = getUploadedFiles(req);
    const trimmedContent = normalizeOptionalText(content);

    const forwardedResult = await resolveForwardedMessage(
      forwardedFromMessageId,
      senderId
    );

    if (forwardedResult.error) {
      return res.status(forwardedResult.error.status).json(forwardedResult.error.payload);
    }

    const { forwardedMessage, forwardedFrom } = forwardedResult;

    const replyResult = await resolveReplyMessage({
      replyToMessageId,
      conversationId: conversation._id,
      userId: senderId,
    });

    if (replyResult.error) {
      return res.status(replyResult.error.status).json(replyResult.error.payload);
    }

    const { replyTo } = replyResult;

    if (forwardedMessage && uploadedFiles.length > 0) {
      return res.status(400).json({ message: "Không thể thêm file mới khi chuyển tiếp tin nhắn" });
    }

    if (!trimmedContent && uploadedFiles.length === 0 && !forwardedMessage) {
      return res.status(400).json({ message: "Tin nhắn rỗng" });
    }

    let imageUrls = forwardedMessage ? [...(forwardedMessage.imgUrls || [])] : [];
    let fileUrls = forwardedMessage ? cloneFileUrls(forwardedMessage.fileUrls || []) : [];

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

    const resolvedContent = trimmedContent || forwardedMessage?.content || null;

    if (!resolvedContent && imageUrls.length === 0 && fileUrls.length === 0) {
      return res.status(400).json({ message: "Tin nhắn chuyển tiếp không có nội dung hợp lệ" });
    }

    const { messageType, voiceMeta } = buildVoiceMessageMeta({
      content: resolvedContent,
      uploadedFiles,
      voiceDurationSeconds,
    });

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: resolvedContent,
      messageType,
      voiceMeta,
      imgUrls: imageUrls,
      fileUrls,
      forwardedFrom,
      replyTo,
    });


    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();

    const formattedMessage = await formatMessageForClient(message);

    emitNewMessage(io, conversation, formattedMessage);

    return res.status(201).json({ message: formattedMessage });

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

    const formattedMessage = await formatMessageForClient(message);

    // notify via socket
    io.to(message.conversationId.toString()).emit("update-message", { message: formattedMessage });

    return res.status(200).json({ message: formattedMessage });
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
    message.voiceMeta = null;

    await message.save();

    const formattedMessage = await formatMessageForClient(message);

    io.to(message.conversationId.toString()).emit("update-message", { message: formattedMessage });

    return res.status(200).json({ message: formattedMessage });
  } catch (error) {
    console.error("Lỗi khi thu hồi tin nhắn:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    // Kiểm tra user có trong conversation không
    const isParticipant = await Conversation.exists({
      _id: message.conversationId,
      "participants.userId": userId,
    });

    if (!isParticipant) {
      return res.status(403).json({ message: "Bạn không có quyền xóa tin nhắn này" });
    }

    // Thêm user vào deletedForUsers (nếu chưa có)
    if (!message.deletedForUsers.includes(userId)) {
      message.deletedForUsers.push(userId);
      await message.save();

      const formattedMessage = await formatMessageForClient(message);

      // Emit realtime update
      io.to(message.conversationId.toString()).emit("update-message", { message: formattedMessage });
    }

    return res.status(200).json({ message: "Đã xóa tin nhắn cho bạn" });
  } catch (error) {
    console.error("Lỗi khi xóa tin nhắn cho tôi:", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const markMessageDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id.toString();

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    const isParticipant = await Conversation.exists({
      _id: message.conversationId,
      "participants.userId": userId,
    });

    if (!isParticipant) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật trạng thái tin nhắn này" });
    }

    if (message.senderId.toString() === userId) {
      return res.status(200).json({ message });
    }

    const alreadyDelivered = (message.deliveredTo || []).some(
      (deliveredUserId) => deliveredUserId.toString() === userId
    );

    if (!alreadyDelivered) {
      message.deliveredTo.push(userId);
      await message.save();

      const formattedMessage = await formatMessageForClient(message);

      io.to(message.conversationId.toString()).emit("update-message", { message: formattedMessage });
    }

    return res.status(200).json({ message: await formatMessageForClient(message) });
  } catch (error) {
    console.error("Lỗi khi cập nhật đã nhận tin nhắn:", error);
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

