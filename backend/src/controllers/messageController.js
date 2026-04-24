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

  if (["poll", "appointment"].includes(forwardedMessage.messageType)) {
    return {
      error: {
        status: 400,
        payload: { message: "Khong the chuyen tiep loai tin nhan nay" },
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

const POLL_MAX_OPTIONS = 10;
const APPOINTMENT_RESPONSE_STATUSES = ["going", "maybe", "declined"];

const parseStringArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const parseDateValue = (value, { required = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    return required ? { error: "Truong ngay gio la bat buoc" } : { value: null };
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return { error: "Ngay gio khong hop le" };
  }

  return { value: parsed };
};

const parseBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return { value: defaultValue };
  }

  if (typeof value === "boolean") {
    return { value };
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedValue)) {
      return { value: true };
    }

    if (["false", "0", "no", "off"].includes(normalizedValue)) {
      return { value: false };
    }
  }

  return { error: "Gia tri tuy chon khong hop le" };
};

const parsePollPayload = ({
  question,
  options,
  expiresAt,
  hideVoters,
  hideResultsUntilVote,
  allowMultipleChoices,
  allowUserAddedOptions,
}) => {
  const normalizedQuestion = normalizeOptionalText(question);

  if (!normalizedQuestion) {
    return { error: "Noi dung binh chon khong duoc de trong" };
  }

  const parsedOptions = parseStringArray(options);

  if (!parsedOptions) {
    return { error: "Danh sach lua chon khong hop le" };
  }

  const normalizedOptions = parsedOptions
    .map((option) => normalizeOptionalText(option))
    .filter(Boolean);

  if (normalizedOptions.length < 2) {
    return { error: "Can it nhat 2 lua chon" };
  }

  if (normalizedOptions.length > POLL_MAX_OPTIONS) {
    return { error: `Chi ho tro toi da ${POLL_MAX_OPTIONS} lua chon` };
  }

  const loweredSet = new Set();

  for (const optionText of normalizedOptions) {
    const lowered = optionText.toLowerCase();

    if (loweredSet.has(lowered)) {
      return { error: "Cac lua chon khong duoc trung nhau" };
    }

    loweredSet.add(lowered);
  }

  const expiresAtResult = parseDateValue(expiresAt);

  if (expiresAtResult.error) {
    return { error: expiresAtResult.error };
  }

  if (expiresAtResult.value && expiresAtResult.value.getTime() <= Date.now()) {
    return { error: "Han binh chon phai lon hon thoi diem hien tai" };
  }

  const hideVotersResult = parseBooleanFlag(hideVoters, false);

  if (hideVotersResult.error) {
    return { error: hideVotersResult.error };
  }

  const hideResultsUntilVoteResult = parseBooleanFlag(hideResultsUntilVote, false);

  if (hideResultsUntilVoteResult.error) {
    return { error: hideResultsUntilVoteResult.error };
  }

  const allowMultipleChoicesResult = parseBooleanFlag(allowMultipleChoices, false);

  if (allowMultipleChoicesResult.error) {
    return { error: allowMultipleChoicesResult.error };
  }

  const allowUserAddedOptionsResult = parseBooleanFlag(allowUserAddedOptions, true);

  if (allowUserAddedOptionsResult.error) {
    return { error: allowUserAddedOptionsResult.error };
  }

  return {
    value: {
      question: normalizedQuestion,
      options: normalizedOptions,
      hideVoters: hideVotersResult.value,
      hideResultsUntilVote: hideResultsUntilVoteResult.value,
      allowMultipleChoices: allowMultipleChoicesResult.value,
      allowUserAddedOptions: allowUserAddedOptionsResult.value,
      expiresAt: expiresAtResult.value,
    },
  };
};

const parsePollOptionText = (value) => {
  const normalizedText = normalizeOptionalText(value);

  if (!normalizedText) {
    return { error: "Noi dung lua chon khong duoc de trong" };
  }

  return { value: normalizedText };
};

const pollAllowsUserAddedOptions = (pollMeta) => pollMeta?.allowUserAddedOptions !== false;

const parseAppointmentPayload = ({ title, description, location, scheduledAt }) => {
  const normalizedTitle = normalizeOptionalText(title);

  if (!normalizedTitle) {
    return { error: "Tieu de lich hen khong duoc de trong" };
  }

  const scheduledAtResult = parseDateValue(scheduledAt, { required: true });

  if (scheduledAtResult.error) {
    return { error: scheduledAtResult.error };
  }

  if (scheduledAtResult.value.getTime() <= Date.now()) {
    return { error: "Thoi gian lich hen phai lon hon thoi diem hien tai" };
  }

  return {
    value: {
      title: normalizedTitle,
      description: normalizeOptionalText(description) || null,
      location: normalizeOptionalText(location) || null,
      scheduledAt: scheduledAtResult.value,
    },
  };
};

const isPollClosed = (pollMeta) => {
  if (!pollMeta) {
    return false;
  }

  if (pollMeta.closedAt) {
    return true;
  }

  if (pollMeta.expiresAt && new Date(pollMeta.expiresAt).getTime() <= Date.now()) {
    return true;
  }

  return false;
};

const applyRecallMutation = (message, userId) => {
  message.isRecalled = true;
  message.recalledAt = new Date();
  message.recallBy = userId;
  message.content = null;
  message.imgUrls = [];
  message.fileUrls = [];
  message.voiceMeta = null;
  message.pollMeta = null;
  message.appointmentMeta = null;
};

const ensureGroupConversation = (conversation) => {
  if (!conversation || conversation.type !== "group") {
    return {
      status: 400,
      payload: { message: "Tinh nang nay chi dung cho nhom chat" },
    };
  }

  return null;
};

const loadAuthorizedGroupMessage = async (messageId, userId) => {
  const message = await Message.findById(messageId);

  if (!message) {
    return {
      error: {
        status: 404,
        payload: { message: "Tin nhan khong ton tai" },
      },
    };
  }

  const conversation = await Conversation.findById(message.conversationId);

  if (!conversation) {
    return {
      error: {
        status: 404,
        payload: { message: "Cuoc tro chuyen khong ton tai" },
      },
    };
  }

  const groupError = ensureGroupConversation(conversation);

  if (groupError) {
    return { error: groupError };
  }

  const isMember = conversation.participants.some(
    (participant) => participant.userId.toString() === userId.toString()
  );

  if (!isMember) {
    return {
      error: {
        status: 403,
        payload: { message: "Ban khong phai thanh vien cua nhom nay" },
      },
    };
  }

  return { message, conversation };
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

export const createGroupPoll = async (req, res) => {
  try {
    const senderId = req.user._id;
    const conversation = req.conversation;
    const groupError = ensureGroupConversation(conversation);

    if (groupError) {
      return res.status(groupError.status).json(groupError.payload);
    }

    const parsedPayload = parsePollPayload(req.body);

    if (parsedPayload.error) {
      return res.status(400).json({ message: parsedPayload.error });
    }

    const {
      question,
      options,
      hideVoters,
      hideResultsUntilVote,
      allowMultipleChoices,
      allowUserAddedOptions,
      expiresAt,
    } = parsedPayload.value;
    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: question,
      messageType: "poll",
      pollMeta: {
        question,
        options: options.map((optionText) => ({
          text: optionText,
          voterIds: [],
        })),
        hideVoters,
        hideResultsUntilVote,
        allowMultipleChoices,
        allowUserAddedOptions,
        expiresAt,
        createdBy: senderId,
        closedAt: null,
        closedBy: null,
      },
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);
    await conversation.save();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Loi khi tao binh chon nhom:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const voteOnGroupPoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionId } = req.body;
    const userId = req.user._id;

    if (!optionId) {
      return res.status(400).json({ message: "Thieu lua chon can binh chon" });
    }

    const result = await loadAuthorizedGroupMessage(messageId, userId);

    if (result.error) {
      return res.status(result.error.status).json(result.error.payload);
    }

    const { message } = result;

    if (message.messageType !== "poll" || !message.pollMeta) {
      return res.status(400).json({ message: "Tin nhan nay khong phai binh chon" });
    }

    if (isPollClosed(message.pollMeta)) {
      return res.status(400).json({ message: "Binh chon da dong" });
    }

    const selectedOption = message.pollMeta.options.find(
      (option) => option._id.toString() === optionId.toString()
    );

    if (!selectedOption) {
      return res.status(404).json({ message: "Khong tim thay lua chon" });
    }

    const alreadySelected = selectedOption.voterIds.some(
      (voterId) => voterId.toString() === userId.toString()
    );

    if (message.pollMeta.allowMultipleChoices) {
      if (alreadySelected) {
        selectedOption.voterIds = selectedOption.voterIds.filter(
          (voterId) => voterId.toString() !== userId.toString()
        );
      } else {
        selectedOption.voterIds.push(userId);
      }
    } else {
      message.pollMeta.options.forEach((option) => {
        option.voterIds = option.voterIds.filter(
          (voterId) => voterId.toString() !== userId.toString()
        );
      });

      if (!alreadySelected) {
        selectedOption.voterIds.push(userId);
      }
    }

    await message.save();
    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Loi khi vote binh chon:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const addOptionToGroupPoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const parsedOptionText = parsePollOptionText(req.body?.text);

    if (parsedOptionText.error) {
      return res.status(400).json({ message: parsedOptionText.error });
    }

    const result = await loadAuthorizedGroupMessage(messageId, userId);

    if (result.error) {
      return res.status(result.error.status).json(result.error.payload);
    }

    const { message } = result;

    if (message.messageType !== "poll" || !message.pollMeta) {
      return res.status(400).json({ message: "Tin nhan nay khong phai binh chon" });
    }

    if (isPollClosed(message.pollMeta)) {
      return res.status(400).json({ message: "Binh chon da dong" });
    }

    if (!pollAllowsUserAddedOptions(message.pollMeta)) {
      return res.status(400).json({ message: "Binh chon nay khong cho phep them lua chon" });
    }

    if (message.pollMeta.options.length >= POLL_MAX_OPTIONS) {
      return res.status(400).json({ message: `Chi ho tro toi da ${POLL_MAX_OPTIONS} lua chon` });
    }

    const normalizedText = parsedOptionText.value;
    const duplicatedOption = message.pollMeta.options.some(
      (option) => normalizeOptionalText(option.text).toLowerCase() === normalizedText.toLowerCase()
    );

    if (duplicatedOption) {
      return res.status(400).json({ message: "Lua chon nay da ton tai" });
    }

    message.pollMeta.options.push({
      text: normalizedText,
      voterIds: [],
    });

    await message.save();
    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Loi khi them lua chon cho binh chon:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const closeGroupPoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const result = await loadAuthorizedGroupMessage(messageId, userId);

    if (result.error) {
      return res.status(result.error.status).json(result.error.payload);
    }

    const { message } = result;

    if (message.messageType !== "poll" || !message.pollMeta) {
      return res.status(400).json({ message: "Tin nhan nay khong phai binh chon" });
    }

    if (message.pollMeta.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Chi nguoi tao moi co the dong binh chon" });
    }

    if (message.pollMeta.closedAt) {
      return res.status(200).json({ message });
    }

    if (message.pollMeta.expiresAt && new Date(message.pollMeta.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Binh chon da dong" });
    }

    message.pollMeta.closedAt = new Date();
    message.pollMeta.closedBy = userId;
    await message.save();

    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Loi khi dong binh chon:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const createGroupAppointment = async (req, res) => {
  try {
    const senderId = req.user._id;
    const conversation = req.conversation;
    const groupError = ensureGroupConversation(conversation);

    if (groupError) {
      return res.status(groupError.status).json(groupError.payload);
    }

    const parsedPayload = parseAppointmentPayload(req.body);

    if (parsedPayload.error) {
      return res.status(400).json({ message: parsedPayload.error });
    }

    const { title, description, location, scheduledAt } = parsedPayload.value;
    const now = new Date();
    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content: title,
      messageType: "appointment",
      appointmentMeta: {
        title,
        description,
        location,
        scheduledAt,
        createdBy: senderId,
        responses: [{
          userId: senderId,
          status: "going",
          respondedAt: now,
        }],
      },
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);
    await conversation.save();
    emitNewMessage(io, conversation, message);

    return res.status(201).json({ message });
  } catch (error) {
    console.error("Loi khi tao lich hen nhom:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const respondToGroupAppointment = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!APPOINTMENT_RESPONSE_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Trang thai xac nhan khong hop le" });
    }

    const result = await loadAuthorizedGroupMessage(messageId, userId);

    if (result.error) {
      return res.status(result.error.status).json(result.error.payload);
    }

    const { message } = result;

    if (message.messageType !== "appointment" || !message.appointmentMeta) {
      return res.status(400).json({ message: "Tin nhan nay khong phai lich hen" });
    }

    const existingResponse = message.appointmentMeta.responses.find(
      (response) => response.userId.toString() === userId.toString()
    );

    if (existingResponse) {
      existingResponse.status = status;
      existingResponse.respondedAt = new Date();
    } else {
      message.appointmentMeta.responses.push({
        userId,
        status,
        respondedAt: new Date(),
      });
    }

    await message.save();
    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Loi khi xac nhan lich hen:", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteGroupAppointment = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const result = await loadAuthorizedGroupMessage(messageId, userId);

    if (result.error) {
      return res.status(result.error.status).json(result.error.payload);
    }

    const { message } = result;

    if (message.isRecalled) {
      return res.status(200).json({ message });
    }

    if (message.messageType !== "appointment" || !message.appointmentMeta) {
      return res.status(400).json({ message: "Tin nhan nay khong phai lich hen" });
    }

    if (message.appointmentMeta.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Chi nguoi tao moi co the xoa lich hen" });
    }

    applyRecallMutation(message, userId);
    await message.save();

    io.to(message.conversationId.toString()).emit("update-message", { message });

    return res.status(200).json({ message });
  } catch (error) {
    console.error("Loi khi xoa lich hen:", error);
    return res.status(500).json({ message: "Loi he thong" });
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
    message.pollMeta = null;
    message.appointmentMeta = null;

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

