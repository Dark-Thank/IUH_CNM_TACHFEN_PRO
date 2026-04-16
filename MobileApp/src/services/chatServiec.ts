import api from "@/lib/axios";
import { toast } from "@/lib/toast";
import type { ConversationResponse, Message } from "@/types/chat";
import { useBlockStore } from "../stores/useBlockStore";

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

async sendDirectMessage(
  recipientId: string,
  options: {
    content?: string;
    imgUrl?: string;
    conversationId?: string;
    files?: File[]; // hoặc ReactNativeFile nếu RN
  } = {}
) {
  try {
    const { content = "", imgUrl, conversationId, files } = options;

    // 👉 Nếu có file → dùng FormData
    if (files && files.length > 0) {
      const formData = new FormData();

      formData.append("recipientId", recipientId);
      formData.append("content", content);
      if (conversationId) formData.append("conversationId", conversationId);
      if (imgUrl) formData.append("imgUrl", imgUrl);

      files.forEach((file, index) => {
        formData.append("files", file);
      });

      const res = await api.post("/messages/direct", formData);

      return res.data.message;
    }

    // 👉 Không có file → gửi JSON (nhẹ hơn)
    const res = await api.post("/messages/direct", {
      recipientId,
      content,
      imgUrl,
      conversationId,
    });

    return res.data.message;

  } catch (error: any) {
    // ✅ Handle bị block
    if (error.response?.status === 403) {
      const data = error.response.data;

      if (
        data.message?.includes("chặn") ||
        data.type === "YOU_ARE_BLOCKED"
      ) {
        toast.error("Bạn đã bị người dùng này chặn");

        // update store nếu có
        try {
          useBlockStore.getState().setBlockedBy(recipientId);
        } catch {}

        return;
      }
    }

    throw error;
  }
},

  // ======================
  // GROUP MESSAGE (UPLOAD FILES)
  // ======================
  async sendGroupMessage(conversationId: string, formData: FormData) {
    formData.append("conversationId", conversationId);

    const res = await api.post("/messages/group", formData);

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
