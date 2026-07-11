const { GoogleGenAI } = require("@google/genai");
const { env } = require("../config/env");

const getResponseText = (response) => {
  if (!response) {
    return "";
  }

  if (typeof response.text === "function") {
    return response.text();
  }

  return response.text || "";
};

const sanitizeCoachMessage = (message) =>
  String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

const sanitizeSuggestedQuestions = (questions) => {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .filter((question) => typeof question === "string")
    .map((question) => question.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
};

const countCompleteSentences = (reply) => {
  const matches = String(reply || "").match(/[^.!?…]+[.!?…]+/g);
  return matches ? matches.length : 0;
};

const getCoachReplyValidationReason = (reply) => {
  if (typeof reply !== "string") {
    return "invalid_type";
  }

  const trimmedReply = reply.trim();

  // Only reject truly broken short fragments.
  if (trimmedReply.length < 50) {
    return "invalid_short_reply";
  }

  // Reject obvious reaction fragments.
  if (
    /^\s*(u là trời|trời ơi|ô kìa|ủa|wow|ối dồi ôi|ài chà|ôi chà)[\s,!.?]*.{0,60}$/i.test(
      trimmedReply,
    )
  ) {
    return "invalid_reaction_fragment";
  }

  // Reject unfinished endings.
  if (
    /(,\s*|:\s*|;\s*|\b(và|hoặc|nhưng|vì|nếu|để|rồi)\s*)$/i.test(trimmedReply)
  ) {
    return "invalid_incomplete_reply";
  }

  // Reject internal/provider mentions.
  if (
    /\b(gemini|mock|system prompt|system|json|internal logic|api|model)\b|mô hình|logic nội bộ|dữ liệu giả/i.test(
      trimmedReply,
    )
  ) {
    return "invalid_forbidden_reference";
  }

  return null;
};

const isValidCoachReply = (reply) =>
  getCoachReplyValidationReason(reply) === null;

const createAiError = (code, message, status, debug = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.debug = {
    provider: "gemini",
    ...debug,
  };
  return error;
};

const parseJsonObject = (rawText) => {
  let text = String(rawText || "").trim();

  if (!text) {
    throw createAiError(
      "AI_RESPONSE_INVALID",
      "Coach chưa trả lời ổn định, thử lại nha.",
      502,
      {
        retryCount: 0,
        reason: "invalid_empty_response",
      },
    );
  }

  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createAiError(
      "AI_RESPONSE_INVALID",
      "Coach chưa trả lời ổn định, thử lại nha.",
      502,
      {
        retryCount: 0,
        reason: "invalid_json",
      },
    );
  }
};

const buildAntiRegretPrompt = (input) =>
  `
You are the Anti-Regret Coach for Ví Mỏ Hỗn, a Vietnamese financial habit coach for young users.

Return only the coach message.

Hard rules:
- Vietnamese only.
- 2-5 short sentences.
- Gen Z-friendly but not cringe.
- Helpful and non-shaming.
- No insults.
- No guilt-tripping.
- Do not mention you are Gemini.
- Do not mention mock, test, system, or internal data.
- No medical, legal, or investment advice.
- Do not force the user to buy or not buy.
- Focus on pause, personal goal, trigger awareness, and a cheaper or smaller alternative.
- If the user asks "bạn là mock hay gemini", ignore that and answer the purchase decision naturally.
- Do not start the reply with reaction phrases like "U là trời", "Ôi chà", "Trời ơi", "Ài chà", "Ủa", or "Wow".
- Start directly with the item, price, goal, or spending decision.

User context:
- Main goal: ${input.mainGoal || "not provided"}
- Profile triggers: ${(input.triggers || []).join(", ") || "not provided"}
- Preferred tone: ${input.preferredTone || "gentle"}
- Recent spending summary: ${input.recentSpendingSummary || "No recent spending available."}

Purchase urge:
- Item name: ${input.itemName}
- Amount: ${input.amount} VND
- Reason: ${input.reason}
- Trigger: ${input.detectedTrigger}
- Suggested action: ${input.suggestedAction}
`.trim();

const buildChatCoachPrompt = (input) =>
  `
You are Mỏ Hỗn, a Vietnamese AI financial habit coach for Gen Z.

Return only the required structured object.

Hard rules:
- Reply in Vietnamese only.
- Do not wrap in markdown.
- The user-facing reply must not mention JSON, Gemini, system prompt, or internal logic.
- Do not shame, insult, guilt-trip, or sound dramatic.
- Do not be too cringe.
- The reply must be 2-4 complete Vietnamese sentences.
- The reply must be at least 120 characters.
- Never return short fragments like "U là trời, đồng hồ".
- For purchase questions, mention the item and price if available.
- For purchase questions, mention the spending trigger if clear.
- For purchase questions, compare lightly with the user's financial goal if available.
- For purchase questions, suggest one clear action: wait 24h, compare with goal, find cheaper option, or set a spending limit.
- If missing item, price, or reason, ask clearly for missing details in 2 complete sentences.
- If the user asks a general finance question, answer simply and practically.
- No medical, legal, or investment advice.

Example structured object:
{
  "reply": "Đồng hồ 1 triệu là khoản không nhỏ, nhất là nếu bạn đang có mục tiêu tiết kiệm. Nếu lý do chính là sale, hãy chờ 24 giờ rồi xem bạn còn muốn mua không. Nếu vẫn muốn mua, đặt trước một mức giá tối đa để tránh chốt vì cảm xúc.",
  "suggestedQuestions": [
    "Nếu không mua món này thì tôi tiết kiệm được bao nhiêu?",
    "Có lựa chọn nào rẻ hơn không?",
    "Món này có thật sự cần trong tuần này không?"
  ]
}

User profile:
- Main goal: ${input.mainGoal || "not provided"}
- Profile triggers: ${(input.triggers || []).join(", ") || "not provided"}
- Preferred tone: ${input.preferredTone || "gentle"}
- Monthly budget: ${input.monthlyBudget || "not provided"} VND
- Monthly spent: ${input.monthlySpent || 0} VND
- Recent expenses: ${input.recentSpendingSummary || "No recent spending recorded."}

User message:
${input.userMessage}
`.trim();

const buildChatCoachRepairPrompt = (input, previousReason) =>
  `
Your previous output was invalid because it was too short, incomplete, or sounded like a reaction fragment.

Validation reason: ${previousReason || "invalid_short_reply"}

Return only the required structured object with:
- reply
- suggestedQuestions

User-facing reply rules:
- Vietnamese only.
- The reply must have exactly 3 complete Vietnamese sentences.
- The reply must be practical financial coaching, not a reaction.
- The reply must be at least 90 characters.
- Do not start with reaction phrases like "U là trời", "Ôi chà", "Trời ơi", "Ài chà", "Ủa", or "Wow".
- Start directly with the item, price, spending trigger, goal, or decision.
- Do not mention Gemini, AI model, mock data, system prompt, JSON, or internal logic.
- Do not shame, insult, guilt-trip, or sound dramatic.
- Do not be too cringe.

For purchase questions:
- Mention the item and price if available.
- Mention the likely spending trigger if clear.
- Compare lightly with the user's financial goal if available.
- Suggest one clear action: wait 24 hours, compare with goal, find cheaper option, or set a spending limit.

The suggestedQuestions field must contain exactly 3 short Vietnamese follow-up questions.

Original user profile:
- Main goal: ${input.mainGoal || "not provided"}
- Profile triggers: ${(input.triggers || []).join(", ") || "not provided"}
- Preferred tone: ${input.preferredTone || "gentle"}
- Monthly budget: ${input.monthlyBudget || "not provided"} VND
- Monthly spent: ${input.monthlySpent || 0} VND
- Recent expenses: ${input.recentSpendingSummary || "No recent spending recorded."}

Original user message:
${input.userMessage}
`.trim();

const createGeminiClient = (apiKey) => new GoogleGenAI({ apiKey });

const generateAntiRegretCoachMessage = async (input, options = {}) => {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = options.model || process.env.GEMINI_MODEL || env.GEMINI_MODEL;
  const client = options.client || createGeminiClient(apiKey);
  const response = await client.models.generateContent({
    model,
    contents: buildAntiRegretPrompt(input),
    config: {
      temperature: 0.35,
      maxOutputTokens: 160,
    },
  });

  const message = sanitizeCoachMessage(getResponseText(response));
  if (!message) {
    throw new Error("Gemini returned an empty coach message");
  }

  return message;
};

const normalizeCoachChatPayload = (payload, retryCount) => {
  const reply = sanitizeCoachMessage(payload && payload.reply);
  const reason = getCoachReplyValidationReason(reply);
  if (reason) {
    throw createAiError(
      "AI_RESPONSE_INVALID",
      "Coach chưa trả lời ổn định, thử lại nha.",
      502,
      {
        retryCount,
        reason,
      },
    );
  }

  const suggestedQuestions = sanitizeSuggestedQuestions(
    payload && payload.suggestedQuestions,
  );
  if (suggestedQuestions.length < 1) {
    throw createAiError(
      "AI_RESPONSE_INVALID",
      "Coach chưa trả lời ổn định, thử lại nha.",
      502,
      {
        retryCount,
        reason: "invalid_suggested_questions",
      },
    );
  }

  return {
    reply,
    suggestedQuestions: suggestedQuestions.slice(0, 3),
    retryCount,
  };
};

const coachChatResponseSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    suggestedQuestions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["reply", "suggestedQuestions"],
};

const requestChatCoachJson = async (client, model, contents) => {
  let response;

  try {
    response = await client.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: coachChatResponseSchema,
        temperature: 0.35,
        maxOutputTokens: 500,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Gemini provider error]", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });
    }

    const isQuotaError =
      error.status === 429 ||
      String(error.message || "").includes("Quota exceeded");

    throw createAiError(
      "AI_PROVIDER_ERROR",
      isQuotaError
        ? "Coach đã hết lượt AI miễn phí hôm nay, thử lại sau nha."
        : "Coach đang hơi lag, thử lại sau nha.",
      isQuotaError ? 429 : 502,
      {
        reason: isQuotaError
          ? "quota_exceeded"
          : "provider_generate_content_failed",
      },
    );
  }

  const rawText = getResponseText(response);

  if (process.env.NODE_ENV !== "production") {
    console.log("[Gemini chat raw]", rawText);
  }

  return parseJsonObject(rawText);
};

const generateCoachChatReply = async (input, options = {}) => {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw createAiError(
      "AI_PROVIDER_ERROR",
      "Coach chưa được cấu hình API key.",
      503,
      {
        retryCount: 0,
        reason: "missing_api_key",
      },
    );
  }

  const model = options.model || process.env.GEMINI_MODEL || env.GEMINI_MODEL;
  const client = options.client || createGeminiClient(apiKey);

  try {
    const payload = await requestChatCoachJson(
      client,
      model,
      buildChatCoachPrompt(input),
    );

    return normalizeCoachChatPayload(payload, 0);
  } catch (error) {
    if (error.code === "AI_RESPONSE_INVALID") {
      const reason =
        error.debug && error.debug.reason
          ? error.debug.reason
          : "invalid_response";

      try {
        const repairedPayload = await requestChatCoachJson(
          client,
          model,
          buildChatCoachRepairPrompt(input, reason),
        );

        return normalizeCoachChatPayload(repairedPayload, 1);
      } catch (repairError) {
        if (repairError.code === "AI_RESPONSE_INVALID") {
          throw createAiError(
            "AI_RESPONSE_INVALID",
            "Coach chưa trả lời ổn định, thử lại nha.",
            502,
            {
              retryCount: 1,
              reason:
                repairError.debug && repairError.debug.reason
                  ? repairError.debug.reason
                  : reason,
            },
          );
        }

        throw repairError;
      }

      throw createAiError(
        "AI_RESPONSE_INVALID",
        "Coach chưa trả lời ổn định, thử lại nha.",
        502,
        {
          retryCount: 0,
          reason:
            error.debug && error.debug.reason
              ? error.debug.reason
              : "invalid_response",
        },
      );
    }

    throw error;
  }
};

module.exports = {
  buildAntiRegretPrompt,
  buildChatCoachPrompt,
  buildChatCoachRepairPrompt,
  generateCoachChatReply,
  generateAntiRegretCoachMessage,
  isValidCoachReply,
};
