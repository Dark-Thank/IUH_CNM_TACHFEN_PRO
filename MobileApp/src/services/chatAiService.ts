import api from "@/lib/axios";

export type SmartReplyContextMessage = {
  isOwn: boolean;
  content: string;
};

export const chatAiService = {
  async getSmartReplies(conversationId: string, messages: SmartReplyContextMessage[]) {
    const res = await api.post("/chat-ai/smart-replies", {
      conversationId,
      messages,
    });

    return res.data.suggestions as string[];
  },

  async detectLanguage(conversationId: string, messages: string[]) {
    const res = await api.post("/chat-ai/detect-language", {
      conversationId,
      messages,
    });

    return res.data.language as string;
  },

  async translateMessage(conversationId: string, text: string, targetLanguage: string) {
    const res = await api.post("/chat-ai/translate", {
      conversationId,
      text,
      targetLanguage,
    });

    return res.data as {
      translatedText: string;
      sameLanguage?: boolean;
    };
  },
};
