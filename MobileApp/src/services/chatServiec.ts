import { authSession } from "@/lib/authSession";
import { getApiBaseUrl } from "@/lib/backendUrl";
import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const pageLimit = 50;
const attachmentDirectory = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}attachments/`;

const sanitizeAttachmentFileName = (value = "download") =>
  value.replace(/[\\/:*?"<>|]/g, "-").trim() || "download";

const ensureAttachmentDirectory = async () => {
  const info = await FileSystem.getInfoAsync(attachmentDirectory);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(attachmentDirectory, {
      intermediates: true,
    });
  }

  return attachmentDirectory;
};

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

  async downloadMessageFile(
    messageId: string,
    fileIndex: number,
    fileName: string,
    mimeType?: string
  ) {
    const accessToken = authSession.getAccessToken();

    if (!accessToken) {
      throw new Error("Không tìm thấy access token");
    }

    const directory = await ensureAttachmentDirectory();
    const localFileName = `${Date.now()}-${sanitizeAttachmentFileName(fileName)}`;
    const fileUri = `${directory}${localFileName}`;
    const downloadUrl = `${getApiBaseUrl()}/messages/${messageId}/files/${fileIndex}`;

    const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (downloadResult.status !== 200) {
      throw new Error(`Tải file thất bại với mã ${downloadResult.status}`);
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType,
        dialogTitle: fileName,
      });
    }

    return downloadResult.uri;
  },
};
