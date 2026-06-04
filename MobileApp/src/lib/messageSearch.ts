import type { Conversation, Message } from "@/types/chat";

export type MessageSearchDateFilter = "all" | "1d" | "7d" | "30d" | "year";

export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const getConversationTitleForSearch = (
  conversation: Conversation,
  currentUserId?: string
) => {
  if (conversation.type === "group") {
    return conversation.group?.name || "Nhóm chat";
  }

  return (
    conversation.participants.find((participant) => participant._id !== currentUserId)?.displayName ||
    "Cuộc trò chuyện"
  );
};

export const getConversationSearchBody = (
  conversation: Conversation,
  currentUserId?: string
) =>
  normalizeSearchText(getConversationTitleForSearch(conversation, currentUserId));

export const getMessageSearchBody = (message: Message) => {
  const textParts: string[] = [];

  if (message.content) {
    textParts.push(message.content);
  }

  if (message.replyTo?.content) {
    textParts.push(message.replyTo.content);
  }

  if (message.forwardedFrom?.content) {
    textParts.push(message.forwardedFrom.content);
  }

  if (message.pollMeta) {
    textParts.push(message.pollMeta.question);
    textParts.push(...message.pollMeta.options.map((option) => option.text));
  }

  if (message.appointmentMeta) {
    textParts.push(message.appointmentMeta.title);

    if (message.appointmentMeta.description) {
      textParts.push(message.appointmentMeta.description);
    }

    if (message.appointmentMeta.location) {
      textParts.push(message.appointmentMeta.location);
    }
  }

  if (message.groupInviteMeta) {
    textParts.push(message.groupInviteMeta.groupName);
    if (message.groupInviteMeta.invitationUrl) {
      textParts.push(message.groupInviteMeta.invitationUrl);
    }
  }

  if (message.fileUrls?.length) {
    textParts.push(...message.fileUrls.map((file) => file.name));
  }

  if (message.messageType === "voice") {
    textParts.push("Tin nhắn thoại");
  }

  if (message.messageType === "call") {
    textParts.push("Cuộc gọi");
  }

  return textParts.join(" ").trim();
};

export const getMessageSenderId = (message: Message) => {
  const sender = message.senderId as unknown;

  if (typeof sender === "string") {
    return sender;
  }

  if (sender && typeof sender === "object" && "_id" in sender) {
    return String((sender as { _id?: string })._id ?? "");
  }

  return "";
};

export const getMessageSenderName = (
  message: Message,
  conversation: Conversation,
  currentUserId?: string
) => {
  const senderId = getMessageSenderId(message);

  if (senderId === currentUserId) {
    return "Bạn";
  }

  return (
    conversation.participants.find((participant) => participant._id === senderId)?.displayName ||
    "Thành viên"
  );
};

export const matchesDateFilter = (createdAt: string, filter: MessageSearchDateFilter) => {
  if (filter === "all") {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) {
    return false;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (filter) {
    case "1d":
      return now - createdTime <= dayMs;
    case "7d":
      return now - createdTime <= 7 * dayMs;
    case "30d":
      return now - createdTime <= 30 * dayMs;
    case "year":
      return new Date(createdAt).getFullYear() === new Date(now).getFullYear();
    default:
      return true;
  }
};

export const buildSearchSnippet = (text: string, query: string, maxLength = 90) => {
  const source = text.trim();

  if (!source) {
    return "";
  }

  if (!query.trim()) {
    return source.length <= maxLength ? source : `${source.slice(0, maxLength).trimEnd()}...`;
  }

  const normalizedSource = normalizeSearchText(source);
  const normalizedQuery = normalizeSearchText(query);
  const matchIndex = normalizedSource.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return source.length <= maxLength ? source : `${source.slice(0, maxLength).trimEnd()}...`;
  }

  const start = Math.max(0, matchIndex - 24);
  const end = Math.min(source.length, matchIndex + query.length + 40);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
};
