import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";
import { toast } from "sonner";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`
    );

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

 async sendDirectMessage(formData: FormData) {
  try {
    const res = await api.post("/messages/direct", formData);

    return res.data.message;
  } catch (error: any) {
    if (error.response?.status === 403 && error.response.data?.message?.includes('chặn')) {
      toast.error(error.response.data.message || "Bạn đã bị người dùng này chặn");
      throw error;
    }
    throw error;
  }
},

  async sendGroupMessage(formData: FormData) {
  const res = await api.post("/messages/group", formData);

  return res.data.message;
},

  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[]
  ) {
    const res = await api.post("/conversations", { type, name, memberIds });
    return res.data.conversation;
  },

  async togglePinMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/pin`);
    return res.data.message;
  },

  async recallMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/recall`);
    return res.data;
  },
};

