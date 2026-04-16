import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

const pageLimit = 50;

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

export const chatService = {
  // ======================
  // CONVERSATIONS
  // ======================
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  // ======================
  // MESSAGES
  // ======================
  async fetchMessages(
    id: string,
    cursor?: string
  ): Promise<FetchMessageProps> {
    const res = await api.get(`/conversations/${id}/messages`, {
      params: {
        limit: pageLimit,
        ...(cursor ? { cursor } : {}),
      },
    });

    return {
      messages: res.data.messages,
      cursor: res.data.nextCursor,
    };
  },

  // ======================
  // DIRECT MESSAGE (UPLOAD FILES)
  // ======================
  async sendDirectMessage(formData: FormData) {
    const res = await api.post("/messages/direct", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data.message;
  },

  // ======================
  // GROUP MESSAGE (UPLOAD FILES)
  // ======================
  async sendGroupMessage(conversationId: string, formData: FormData) {
    formData.append("conversationId", conversationId);

    const res = await api.post("/messages/group", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data.message;
  },

  // ======================
  // MARK AS SEEN
  // ======================
  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

  // ======================
  // CREATE CONVERSATION
  // ======================
  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[]
  ) {
    const res = await api.post("/conversations", {
      type,
      name,
      memberIds,
    });

    return res.data.conversation;
  },

  async recallMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/recall`);
    return res.data.message;
  },

  async togglePinMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/pin`);
    return res.data.message;
  },
};
