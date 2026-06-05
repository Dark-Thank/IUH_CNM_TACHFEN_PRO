import { GoogleGenAI } from "@google/genai";

const getGeminiModel = () =>
  process.env.CHAT_GEMINI_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

const getGroqModel = () =>
  process.env.CHAT_GROQ_MODEL ||
  "llama-3.1-8b-instant";

const getGeminiApiKey = () =>
  process.env.CHAT_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.API_KEY_GEMINI ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY;

const getGroqApiKey = () =>
  process.env.CHAT_GROQ_API_KEY ||
  process.env.GROQ_API_KEY ||
  process.env.API_KEY_GROQ ||
  process.env.GROQ_KEY ||
  process.env.GROQ_API_TOKEN;

const parseProviderError = (error, fallbackStatus = 500) => {
  if (!error?.message) {
    return { status: fallbackStatus, message: "AI request failed" };
  }

  try {
    const parsed = JSON.parse(error.message);
    return {
      status: parsed?.error?.code || fallbackStatus,
      message: parsed?.error?.message || error.message,
    };
  } catch {
    return { status: fallbackStatus, message: error.message };
  }
};

const isQuotaError = (error) => {
  const parsed = parseProviderError(error);
  const message = parsed.message.toLowerCase();

  return parsed.status === 429 ||
    parsed.status === 503 ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("high demand") ||
    message.includes("try again later") ||
    message.includes("temporar") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("busy");
};

const generateWithGemini = async (prompt) => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: getGeminiModel(),
    contents: prompt,
  });

  return (response.text || "").trim();
};

const generateWithGroq = async (prompt) => {
  const apiKey = getGroqApiKey();

  if (!apiKey) {
    throw new Error("Missing Groq API key");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(JSON.stringify({
      error: {
        code: response.status,
        message: payload?.error?.message || "Groq request failed",
      },
    }));
  }

  return (payload?.choices?.[0]?.message?.content || "").trim();
};

const generateText = async (prompt) => {
  try {
    return await generateWithGemini(prompt);
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }

    console.warn("Gemini quota/rate limit reached. Falling back to Groq.");
    return generateWithGroq(prompt);
  }
};

const stripJsonFence = (value) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parseSuggestionArray = (rawText) => {
  try {
    const parsed = JSON.parse(stripJsonFence(rawText));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
};

const formatConversationContext = (messages = []) =>
  messages
    .map((message) => {
      const sender = message.isOwn ? "Current user" : "Other user";
      return `${sender}: ${message.content}`;
    })
    .join("\n");

export const getChatAiErrorResponse = (error) => {
  const parsed = parseProviderError(error);

  if (error?.message === "Missing Gemini API key") {
    return { status: 500, message: "Backend chưa cấu hình CHAT_GEMINI_API_KEY" };
  }

  if (error?.message === "Missing Groq API key") {
    return { status: 500, message: "Gemini hết quota và backend chưa cấu hình CHAT_GROQ_API_KEY" };
  }

  if (error?.message === "fetch failed") {
    return { status: 503, message: "Backend không kết nối được AI provider" };
  }

  return {
    status: parsed.status,
    message: parsed.message,
  };
};

export const generateSmartReplies = async (messages = []) => {
  const context = formatConversationContext(messages);
  const prompt = `Analyze the conversation context below and generate exactly 3 short, natural, human-like reply suggestions for the current user.

Requirements:
- Return exactly 3 reply suggestions.
- Do not include explanations.
- Do not include numbering.
- Return only a JSON array of strings.

Conversation:
${context}`;

  const rawText = await generateText(prompt);
  const suggestions = parseSuggestionArray(rawText);

  if (suggestions.length !== 3) {
    throw new Error("AI did not return exactly 3 suggestions");
  }

  return suggestions;
};

export const detectPrimaryLanguage = async (messages = []) => {
  const prompt = `The following messages were written by the current user of a chat app.
Analyze only these current-user messages and determine the user's primary language.

Return only the language name.
If you cannot determine the language, return exactly:
Unknown
Do not translate the messages.
Do not infer the other participant's language.

Current-user messages:
${messages.join("\n")}`;

  return generateText(prompt);
};

export const translateText = async ({ text, targetLanguage }) => {
  const prompt = `Translate the following text into:
${targetLanguage}

Return only the translated text.
Do not provide explanations.
If the text is already written in ${targetLanguage}, including informal spelling, missing accents/diacritics, casing differences, abbreviations, or minor typos, return exactly:
__CHAT_AI_SAME_LANGUAGE__

Text:
${text}`;

  return generateText(prompt);
};
