import api from "@/lib/axios";
import type { AppointmentResponseStatus, ConversationResponse, ConversationSummary, Message } from "@/types/chat";
import { toast } from "sonner";

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

interface SummarizeConversationOptions {
  limit?: number;
  scope?: "recent" | "unread";
}

const pageLimit = 50;

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
    
  },
  async renameGroup(conversationId: string, name: string) {
  const res = await api.patch(`/conversations/${conversationId}/rename`, {
    name,
  });

  return res.data;
},

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`
    );

    return { messages: res.data.messages, cursor: res.data.nextCursor };
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
  async updateGroupAvatar(conversationId: string, file: File) {
  const formData = new FormData();
  formData.append("avatar", file);

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
},
  async sendDirectMessage(formData: FormData) {
    try {
      const res = await api.post("/messages/direct", formData);

      return res.data.message;
    } catch (error: any) {
      if (
        error.response?.status === 403 &&
        error.response.data?.message?.includes("chặn")
      ) {
        toast.error(error.response.data.message || "Bạn đã bị người dùng này chặn");
      }

      throw error;
    }
  },

  async sendGroupMessage(formData: FormData) {
    const res = await api.post("/messages/group", formData);

    return res.data.message;
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

  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[],
    privacy: "public" | "private" = "public"
  ) {
    const res = await api.post("/conversations", { type, name, memberIds, privacy });
    return res.data.conversation;
  },

  async addGroupMembers(conversationId: string, memberIds: string[]) {
    const res = await api.post(`/conversations/${conversationId}/members`, { memberIds });
    return res.data;
  },

  async reviewGroupJoinRequest(conversationId: string, userId: string, action: "accept" | "decline") {
    const res = await api.post(`/conversations/${conversationId}/join-requests/${userId}/review`, { action });
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

  async togglePinMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/pin`);
    return res.data.message;
  },
  async reactToMessage(messageId: string, emoji: string) {
    const res = await api.post(`/messages/${messageId}/reaction`, { emoji });
    return res.data.message;
  },
  async recallMessage(messageId: string) {
    const res = await api.put(`/messages/${messageId}/recall`);
    return res.data.message;
  },

  async deleteMessageForMe(messageId: string) {
    const res = await api.put(`/messages/${messageId}/delete-for-me`);
    return res.data;
  },

  async downloadMessageFile(messageId: string, fileIndex: number, fileName: string) {
    const res = await api.get(`/messages/${messageId}/files/${fileIndex}`, {
      responseType: "blob",
    });

    triggerBrowserDownload(res.data, fileName);
  },

  async generateInvitationLink(conversationId: string) {
    const res = await api.post(`/conversations/${conversationId}/generate-invite`);
    return res.data;
  },

  async shareGroupInvitation(conversationId: string, recipientId: string) {
    const res = await api.post(`/conversations/${conversationId}/share-invite`, { recipientId });
    return res.data;
  },

  async joinGroupByToken(token: string) {
    const res = await api.post("/conversations/join-by-token", { token });
    return res.data;
  },

  async respondToGroupInvitation(messageId: string, action: "accept" | "decline") {
    const res = await api.post(`/conversations/group-invites/${messageId}/respond`, { action });
    return res.data;
  },
};



