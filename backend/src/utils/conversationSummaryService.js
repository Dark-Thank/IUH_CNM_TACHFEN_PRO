const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
const DEFAULT_MESSAGE_LIMIT = 40;
const MAX_MESSAGE_LIMIT = 100;

const SUMMARY_SCOPE_LABELS = {
    recent: "các tin nhắn gần đây",
    unread: "các tin nhắn chưa đọc",
};

const normalizeText = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value.replace(/\s+/g, " ").trim();
};

const summarizeAttachmentInfo = (message) => {
    const parts = [];

    if (Array.isArray(message?.imgUrls) && message.imgUrls.length > 0) {
        parts.push(message.imgUrls.length === 1 ? "1 hình ảnh" : `${message.imgUrls.length} hình ảnh`);
    }

    if (Array.isArray(message?.fileUrls) && message.fileUrls.length > 0) {
        parts.push(message.fileUrls.length === 1 ? `1 tệp: ${message.fileUrls[0]?.name || "không tên"}` : `${message.fileUrls.length} tệp đính kèm`);
    }

    return parts.join(", ");
};

const formatMessageContent = (message) => {
    const trimmedContent = normalizeText(message?.content);

    if (trimmedContent) {
        return trimmedContent;
    }

    if (message?.messageType === "poll") {
        const question = normalizeText(message?.pollMeta?.question);
        return question ? `Bình chọn: ${question}` : "Bình chọn";
    }

    if (message?.messageType === "appointment") {
        const title = normalizeText(message?.appointmentMeta?.title);
        return title ? `Lịch hẹn: ${title}` : "Lịch hẹn";
    }

    if (message?.messageType === "voice") {
        return "Tin nhắn thoại";
    }

    if (message?.messageType === "call") {
        return normalizeText(message?.content) || "Cuộc gọi";
    }

    return summarizeAttachmentInfo(message) || "Tin nhắn không có nội dung văn bản";
};

const buildConversationTranscript = ({ conversation, messages, userId }) => {
    const currentUserId = userId?.toString?.() || String(userId || "");

    return messages.map((message) => {
        const senderId = message?.senderId?._id?.toString?.() || message?.senderId?.toString?.() || "";
        const senderName = senderId === currentUserId
            ? "Bạn"
            : message?.senderId?.displayName || "Thành viên";
        const createdAt = message?.createdAt
            ? new Date(message.createdAt).toLocaleString("vi-VN")
            : "Không rõ thời gian";
        const content = formatMessageContent(message);
        const attachmentInfo = summarizeAttachmentInfo(message);

        return `- [${createdAt}] ${senderName}: ${content}${attachmentInfo && content !== attachmentInfo ? ` (${attachmentInfo})` : ""}`;
    }).join("\n");
};

const buildPrompt = ({ conversation, transcript, scope = "recent" }) => {
    const conversationLabel = conversation.type === "group"
        ? `Nhóm "${normalizeText(conversation.group?.name) || "Không tên"}"`
        : "Đoạn chat cá nhân";
    const scopeLabel = SUMMARY_SCOPE_LABELS[scope] || SUMMARY_SCOPE_LABELS.recent;

    return [
        `Hãy tóm tắt ngắn gọn cuộc trò chuyện sau bằng tiếng Việt.`,
        `Bối cảnh: ${conversationLabel}.`,
        `Phạm vi cần tóm tắt: ${scopeLabel}.`,
        `Yêu cầu:`,
        `1. Trả về JSON hợp lệ với các khóa: summary, bullets, actionItems.`,
        `2. summary là chuỗi 2-4 câu, nêu ý chính gần đây nhất.`,
        `3. bullets là mảng tối đa 5 ý ngắn.`,
        `4. actionItems là mảng các việc cần theo dõi, có thể rỗng.`,
        `5. Không bịa nội dung ngoài dữ liệu được cung cấp.`,
        `Dữ liệu hội thoại:`,
        transcript,
    ].join("\n");
};

const parseSummaryPayload = (rawContent) => {
    const fallbackText = normalizeText(rawContent);

    if (!fallbackText) {
        return {
            summary: "Chưa thể tạo tóm tắt từ dữ liệu hiện tại.",
            bullets: [],
            actionItems: [],
        };
    }

    try {
        const parsed = JSON.parse(rawContent);

        return {
            summary: normalizeText(parsed?.summary) || fallbackText,
            bullets: Array.isArray(parsed?.bullets)
                ? parsed.bullets.map((item) => normalizeText(item)).filter(Boolean).slice(0, 5)
                : [],
            actionItems: Array.isArray(parsed?.actionItems)
                ? parsed.actionItems.map((item) => normalizeText(item)).filter(Boolean).slice(0, 5)
                : [],
        };
    } catch {
        return {
            summary: fallbackText,
            bullets: [],
            actionItems: [],
        };
    }
};

export const buildConversationSummary = async ({ conversation, messages, userId, limit = DEFAULT_MESSAGE_LIMIT, scope = "recent" }) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
        const error = new Error("Missing GROQ_API_KEY");
        error.code = "GROQ_API_KEY_MISSING";
        throw error;
    }

    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_MESSAGE_LIMIT, 1), MAX_MESSAGE_LIMIT);
    const selectedMessages = messages.slice(-safeLimit);
    const transcript = buildConversationTranscript({ conversation, messages: selectedMessages, userId });

    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "Bạn là trợ lý tóm tắt hội thoại cho ứng dụng chat. Luôn trả về JSON hợp lệ, ngắn gọn, chính xác, bằng tiếng Việt.",
                },
                {
                    role: "user",
                    content: buildPrompt({ conversation, transcript, scope }),
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Groq request failed with status ${response.status}`);
        error.code = "GROQ_REQUEST_FAILED";
        error.details = errorBody;
        throw error;
    }

    const payload = await response.json();
    const rawContent = payload?.choices?.[0]?.message?.content || "";
    const parsed = parseSummaryPayload(rawContent);

    return {
        ...parsed,
        provider: "groq",
        model: payload?.model || DEFAULT_MODEL,
        messageCount: selectedMessages.length,
        scope,
    };
};
