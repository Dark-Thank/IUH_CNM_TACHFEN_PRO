import Conversation from "../models/Conversation.js";
import {
  detectPrimaryLanguage,
  generateSmartReplies,
  getChatAiErrorResponse,
  translateText,
} from "../services/chatAiService.js";

const MAX_CONTEXT_MESSAGES = 10;
const MAX_TEXT_LENGTH = 2000;

const normalizeText = (value) =>
  typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";

const ensureConversationMember = async (conversationId, userId) => {
  if (!conversationId) {
    return false;
  }

  return Boolean(await Conversation.exists({
    _id: conversationId,
    "participants.userId": userId,
  }));
};

export const getSmartReplies = async (req, res) => {
  try {
    const { conversationId, messages } = req.body;
    const isMember = await ensureConversationMember(conversationId, req.user._id);

    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cuộc trò chuyện này" });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Cần ít nhất một tin nhắn để tạo gợi ý" });
    }

    const normalizedMessages = messages
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((message) => ({
        isOwn: Boolean(message?.isOwn),
        content: normalizeText(message?.content),
      }))
      .filter((message) => message.content);

    if (normalizedMessages.length === 0) {
      return res.status(400).json({ message: "Không có nội dung hợp lệ để tạo gợi ý" });
    }

    const suggestions = await generateSmartReplies(normalizedMessages);

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error("Lỗi khi tạo gợi ý trả lời chat AI:", error);
    const aiError = getChatAiErrorResponse(error);
    return res.status(aiError.status).json({ message: aiError.message });
  }
};

export const detectUserLanguage = async (req, res) => {
  try {
    const { conversationId, messages } = req.body;
    const isMember = await ensureConversationMember(conversationId, req.user._id);

    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cuộc trò chuyện này" });
    }

    const normalizedMessages = Array.isArray(messages)
      ? messages.map(normalizeText).filter(Boolean).slice(-MAX_CONTEXT_MESSAGES)
      : [];

    if (normalizedMessages.length === 0) {
      return res.status(400).json({ message: "Cần tin nhắn của bạn để nhận diện ngôn ngữ" });
    }

    const language = await detectPrimaryLanguage(normalizedMessages);

    return res.status(200).json({ language });
  } catch (error) {
    console.error("Lỗi khi nhận diện ngôn ngữ chat AI:", error);
    const aiError = getChatAiErrorResponse(error);
    return res.status(aiError.status).json({ message: aiError.message });
  }
};

export const translateMessage = async (req, res) => {
  try {
    const { conversationId, text, targetLanguage } = req.body;
    const isMember = await ensureConversationMember(conversationId, req.user._id);

    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cuộc trò chuyện này" });
    }

    const normalizedText = normalizeText(text);
    const normalizedLanguage = normalizeText(targetLanguage);

    if (!normalizedText || !normalizedLanguage) {
      return res.status(400).json({ message: "Thiếu nội dung hoặc ngôn ngữ dịch" });
    }

    const translatedText = await translateText({
      text: normalizedText,
      targetLanguage: normalizedLanguage,
    });

    if (translatedText.trim() === "__CHAT_AI_SAME_LANGUAGE__") {
      return res.status(200).json({ translatedText: "", sameLanguage: true });
    }

    return res.status(200).json({ translatedText });
  } catch (error) {
    console.error("Lỗi khi dịch tin nhắn chat AI:", error);
    const aiError = getChatAiErrorResponse(error);
    return res.status(aiError.status).json({ message: aiError.message });
  }
};
