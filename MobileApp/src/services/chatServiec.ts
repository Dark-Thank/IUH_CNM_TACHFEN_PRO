import { authSession } from "@/lib/authSession";
import api from "@/lib/axios";
import { getApiBaseUrl } from "@/lib/backendUrl";
import { toast } from "@/lib/toast";
import type {
  AppointmentResponseStatus,
  ConversationResponse,
  ConversationSummary,
  Message,
} from "@/types/chat";

import { useBlockStore } from "../stores/useBlockStore";

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

interface SummarizeConversationOptions {
  limit?: number;
  scope?: "recent" | "unread";
}

const parseJsonSafely = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const postMultipart = async (path: string, formData: FormData) => {
  const accessToken = authSession.getAccessToken();

  if (!accessToken) {
    throw new Error("Không tìm thấy access token");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    body: formData,
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    const error: any = new Error(
      data?.message || `Yêu cầu thất bại với mã ${response.status}`
    );
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  return data;
};

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

  async summarizeConversation(
    conversationId: string,
    options: SummarizeConversationOptions = {}
  ): Promise<ConversationSummary> {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 40));

    if (options.scope) {
      params.set("scope", options.scope);
    }

    const res = await api.get(`/conversations/${conversationId}/summary?${params.toString()}`);
    return res.data.summary;
  },

  async sendDirectMessage(
    recipientId: string,
    options: {
      content?: string;
      conversationId?: string;
      forwardedFromMessageId?: string;
      replyToMessageId?: string;
      voiceDurationSeconds?: number;
      files?: Array<{
        uri: string;
        name?: string;
        type?: string;
      }>;
    } = {}
  ) {
    try {
      const { content = "", conversationId, forwardedFromMessageId, replyToMessageId, files, voiceDurationSeconds } = options;

      if (files && files.length > 0) {
        const formData = new FormData();

        formData.append("recipientId", recipientId);
        formData.append("content", content);
        if (conversationId) formData.append("conversationId", conversationId);
        if (forwardedFromMessageId) formData.append("forwardedFromMessageId", forwardedFromMessageId);
        if (replyToMessageId) formData.append("replyToMessageId", replyToMessageId);
        if (typeof voiceDurationSeconds === "number") {
          formData.append("voiceDurationSeconds", String(voiceDurationSeconds));
        }

        files.forEach((file) => {
          formData.append("files", {
            uri: file.uri,
            name: file.name || "file.jpg",
            type: file.type || "application/octet-stream",
          } as any);
        });

        const data = await postMultipart("/messages/direct", formData);

        return data.message;
      }

      const res = await api.post("/messages/direct", {
        recipientId,
        content,
        conversationId,
        forwardedFromMessageId,
        replyToMessageId,
        voiceDurationSeconds,
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
          } catch { }

          return;
        }
      }

      throw error;
    }
  },

  // ======================
  // GROUP MESSAGE (UPLOAD FILES)
  // ======================
  async sendGroupMessage(conversationId: string, formData: FormData, voiceDurationSeconds?: number, replyToMessageId?: string) {
    formData.append("conversationId", conversationId);
    if (typeof voiceDurationSeconds === "number") {
      formData.append("voiceDurationSeconds", String(voiceDurationSeconds));
    }
    if (replyToMessageId) {
      formData.append("replyToMessageId", replyToMessageId);
    }

    const data = await postMultipart("/messages/group", formData);

    return data.message;
  },

  async createGroupPoll(payload: {
    conversationId: string;
    question: string;
    options: string[];
    hideVoters?: boolean;
    hideResultsUntilVote?: boolean;
    allowMultipleChoices?: boolean;
    allowUserAddedOptions?: boolean;
    expiresAt?: string | null;
  }) {
    const res = await api.post("/messages/group/poll", payload);
    return res.data.message;
  },

  async addOptionToGroupPoll(messageId: string, text: string) {
    const res = await api.post(`/messages/${messageId}/poll-option`, { text });
    return res.data.message;
  },

  async voteOnGroupPoll(messageId: string, optionId: string) {
    const res = await api.post(`/messages/${messageId}/poll-vote`, { optionId });
    return res.data.message;
  },

  async closeGroupPoll(messageId: string) {
    const res = await api.post(`/messages/${messageId}/poll-close`);
    return res.data.message;
  },

  async createGroupAppointment(payload: {
    conversationId: string;
    title: string;
    description?: string;
    location?: string;
    scheduledAt: string;
  }) {
    const res = await api.post("/messages/group/appointment", payload);
    return res.data.message;
  },

  async respondToGroupAppointment(messageId: string, status: AppointmentResponseStatus) {
    const res = await api.post(`/messages/${messageId}/appointment-response`, { status });
    return res.data.message;
  },

  async deleteGroupAppointment(messageId: string) {
    const res = await api.delete(`/messages/${messageId}/appointment`);
    return res.data.message;
  },

  // ======================
  // MARK AS SEEN
  // ======================
  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

  async toggleConversationPin(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/pin`);
    return res.data.conversation;
  },

  async markMessageDelivered(messageId: string) {
    const res = await api.post(`/messages/${messageId}/delivered`);
    return res.data.message;
  },

  // ======================
  // CREATE CONVERSATION
  // ======================
  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[],
    privacy: "public" | "private" = "public"
  ) {
    const res = await api.post("/conversations", {
      type,
      name,
      memberIds,
      privacy,
    });

    return res.data.conversation;
  },

  async addGroupMembers(conversationId: string, memberIds: string[]) {
    const res = await api.post(`/conversations/${conversationId}/members`, { memberIds });
    return res.data;
  },

  async generateInvitationLink(conversationId: string) {
    const res = await api.post(`/conversations/${conversationId}/generate-invite`);
    return res.data;
  },

  async shareGroupInvitation(conversationId: string, recipientId: string) {
    const res = await api.post(`/conversations/${conversationId}/share-invite`, {
      recipientId,
    });
    return res.data;
  },

  async respondToGroupInvitation(messageId: string, action: "accept" | "decline") {
    const res = await api.post(`/conversations/group-invites/${messageId}/respond`, {
      action,
    });
    return res.data;
  },

  async reviewGroupJoinRequest(
    conversationId: string,
    userId: string,
    action: "accept" | "decline"
  ) {
    const res = await api.post(`/conversations/${conversationId}/join-requests/${userId}/review`, {
      action,
    });
    return res.data;
  },

  async removeGroupMember(conversationId: string, memberId: string) {
    const res = await api.delete(`/conversations/${conversationId}/members/${memberId}`);
    return res.data.conversation;
  },

  async updateGroupMemberRole(
    conversationId: string,
    memberId: string,
    role: "deputy" | "member"
  ) {
    const res = await api.patch(`/conversations/${conversationId}/members/${memberId}/role`, { role });
    return res.data.conversation;
  },

  async transferGroupOwnership(conversationId: string, newOwnerId: string) {
    const res = await api.patch(`/conversations/${conversationId}/owner`, { newOwnerId });
    return res.data.conversation;
  },

  async leaveGroup(conversationId: string) {
    const res = await api.post(`/conversations/${conversationId}/leave`);
    return res.data;
  },

  async disbandGroup(conversationId: string) {
    const res = await api.delete(`/conversations/${conversationId}`);
    return res.data;
  },

  reactMessage: async (messageId: string, emoji: string) => {
    try {
      const accessToken = authSession.getAccessToken();

      console.log("TOKEN:", accessToken);
      console.log("URL:", `${getApiBaseUrl()}/messages/${messageId}/reaction`);

      const res = await fetch(
        `${getApiBaseUrl()}/messages/${messageId}/reaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ emoji }),
        }
      );

      const data = await parseJsonSafely(res);



      if (!res.ok) {
        throw new Error(data?.message || "React failed");
      }

      return data.message;
    } catch (err) {
      console.error("🔥 REACT ERROR:", err);
      throw err;
    }
  },

  async togglePinMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/pin`);
    return res.data.message;
  },

  async recallMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/recall`);
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


  async deleteMessageForMe(messageId: string) {
    const res = await api.put(`/messages/${messageId}/delete-for-me`);
    return res.data;
  },
  async updateGroupName(conversationId: string, name: string) {
    const res = await api.patch(`/conversations/${conversationId}/rename`, {
      name,
    });

    return res.data;
  },
  async joinGroupByToken(token: string) {
    const res = await api.post("/conversations/join-by-token", {
      token,
    });

    return res.data;
  },
  async updateGroupAvatar(
    conversationId: string,
    file: {
      uri: string;
      name?: string;
      type?: string;
    }
  ) {
    const formData = new FormData();

    formData.append("avatar", {
      uri: file.uri,
      name: file.name || "avatar.jpg",
      type: file.type || "image/jpeg",
    } as any);

    const res = await api.put(
      `/conversations/${conversationId}/avatar`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return res.data;
  }
};

