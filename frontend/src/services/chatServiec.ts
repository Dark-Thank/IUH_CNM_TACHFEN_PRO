import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
};

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
    const res = await api.post("/messages/direct", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data.message;
  },

  async sendGroupMessage(formData: FormData) {
    const res = await api.post("/messages/group", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

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

  async downloadMessageFile(messageId: string, fileIndex: number, fileName: string) {
    const res = await api.get(`/messages/${messageId}/files/${fileIndex}`, {
      responseType: "blob",
    });

    triggerBrowserDownload(res.data, fileName);
  },
};

