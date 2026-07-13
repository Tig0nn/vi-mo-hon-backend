const mockStore = require("../data/mockStore");
const expenseRepository = require("../repositories/expense.repository");
const { createHttpError } = require("../utils/httpError");
const geminiService = require("./gemini.service");
const profileService = require("./profile.service");

const GENERAL_TRIGGER = "other";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_DURATION_SECONDS = 60;
const AUDIO_FORMATS = {
  wav: {
    extensions: [".wav"],
    mimeTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
  },
  m4a: {
    extensions: [".m4a"],
    mimeTypes: ["audio/m4a", "audio/mp4", "audio/x-m4a"],
  },
};

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const formatVnd = (amount) => `${Number(amount).toLocaleString("vi-VN")}đ`;

const truncate = (value, maxLength) => {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
};

const detectTrigger = (profile, input) => {
  if (input.trigger) {
    return input.trigger;
  }

  const haystack = normalizeText(`${input.itemName} ${input.reason}`);
  const profileTrigger = (profile.triggers || []).find((trigger) =>
    haystack.includes(normalizeText(trigger)),
  );

  if (profileTrigger) {
    const normalizedProfileTrigger = normalizeText(profileTrigger)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    if (
      [
        "flash_sale",
        "fomo",
        "friends",
        "emotional",
        "self_reward",
        "other",
      ].includes(normalizedProfileTrigger)
    ) {
      return normalizedProfileTrigger;
    }
  }

  if (/(flash|sale|deal|discount|giam gia|shopee|voucher)/.test(haystack)) {
    return "flash_sale";
  }

  if (/(stress|cang thang|chan|buon|met)/.test(haystack)) {
    return "emotional";
  }

  if (/(tu thuong|self reward|reward|thuong ban than)/.test(haystack)) {
    return "self_reward";
  }

  if (/(ban be|ru|trend|fomo|so lo)/.test(haystack)) {
    if (/(ban be|ru)/.test(haystack)) {
      return "friends";
    }

    return "fomo";
  }

  return GENERAL_TRIGGER;
};

const chooseSuggestedAction = (profile, input, detectedTrigger) => {
  const trigger = normalizeText(detectedTrigger);
  const budgetShare =
    profile.monthlyBudget > 0 ? input.amount / profile.monthlyBudget : 0;

  if (
    trigger.includes("flash_sale") ||
    trigger.includes("sale") ||
    trigger.includes("shopee") ||
    budgetShare >= 0.1
  ) {
    return "WAIT_24_HOURS";
  }

  if (trigger.includes("emotional")) {
    return "TAKE_10_MIN_BREATHER";
  }

  if (trigger.includes("fomo") || trigger.includes("friends")) {
    return "ASK_IF_YOU_STILL_WANT_IT_TOMORROW";
  }

  return "COMPARE_WITH_GOAL";
};

const buildCoachMessage = (
  profile,
  input,
  detectedTrigger,
  suggestedAction,
) => {
  const itemName = truncate(input.itemName, 32);
  const goal = truncate(profile.mainGoal || "mục tiêu tài chính của bạn", 44);
  const amount = formatVnd(input.amount);
  const triggerText =
    detectedTrigger === GENERAL_TRIGGER
      ? "cơn muốn mua này"
      : `trigger "${detectedTrigger}"`;
  const tone = normalizeText(profile.preferredTone || "gentle")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const messages = {
    funny: `Deal có vẻ thơm, nhưng ${triggerText} đang kéo bạn đó. Đợi 24h rồi chốt ${itemName}; ${amount} nên phục vụ goal "${goal}" nha.`,
    sarcastic_light: `Não bảo "chốt đi", ví bảo "từ từ". Với ${itemName} ${amount}, đợi 24h rồi so với goal "${goal}" nha.`,
    strict_but_kind: `Khoan chốt ${itemName}. ${amount} là tiền thật, nên đợi 24h và hỏi: nó có giúp goal "${goal}" không?`,
    gentle: `Từ từ nha. Trước khi mua ${itemName} ${amount}, thử đợi 24h và so với goal "${goal}" đã.`,
  };

  const fallbackByAction = {
    TAKE_10_MIN_BREATHER: `Tạm pause 10 phút nha. Nếu vẫn muốn ${itemName}, hãy xem nó có đáng đổi bớt goal "${goal}" không.`,
    ASK_IF_YOU_STILL_WANT_IT_TOMORROW: `Để mai hãy hỏi lại: mình thật sự muốn ${itemName}, hay chỉ đang cuốn theo mood? Goal "${goal}" vẫn ở đó nha.`,
    COMPARE_WITH_GOAL: `Check nhanh: ${itemName} có giúp goal "${goal}" không? Nếu chưa chắc, để vào wishlist trước nha.`,
    WAIT_24_HOURS: messages.gentle,
  };

  const message =
    messages[tone] || fallbackByAction[suggestedAction] || messages.gentle;
  if (message.length <= 180) {
    return message;
  }

  return `Khoan chốt ${itemName}. Đợi 24h, so với goal "${goal}", rồi quyết nha.`;
};

const buildRecentSpendingSummary = (recentExpenses, totalSpent) => {
  if (recentExpenses.length === 0) {
    return "No recent spending recorded.";
  }

  const items = recentExpenses
    .map((expense) => {
      const category = expense.category || "uncategorized";
      return `${category}: ${formatVnd(expense.amount)}`;
    })
    .join("; ");

  return `Total recorded spending: ${formatVnd(totalSpent)}. Recent expenses: ${items}.`;
};

const toCoachExpense = (expense) => ({
  amount: expense.amount,
  category: expense.category || "uncategorized",
  occurredAt: expense.occurredAt,
  text: expense.text || null,
});

const getRecentSpendingContext = async (userId) => {
  try {
    const recent = await expenseRepository.listExpensesByUserId(userId, {
      page: 1,
      pageSize: 5,
    });
    if (recent.pagination.totalItems > 0) {
      return {
        recentExpenses: recent.items.map(toCoachExpense),
        totalSpent: await expenseRepository.sumExpensesByUserId(userId),
      };
    }
  } catch (error) {
    console.warn(
      "[Supabase] coach spending context unavailable",
      getSafeGeminiErrorDetails(error),
    );
  }

  const mockExpenses = mockStore.listExpensesByUserId(userId, {
    page: 1,
    pageSize: 5,
  }).items;
  return {
    recentExpenses: mockExpenses.map(toCoachExpense),
    totalSpent: mockStore.sumExpensesByUserId(userId),
  };
};

const buildRecentExpenseSummaryForChat = (recentExpenses) => {
  if (!recentExpenses.length) {
    return "No recent spending recorded.";
  }

  return recentExpenses
    .map((expense) => `${expense.category}: ${formatVnd(expense.amount)}`)
    .join("; ");
};

const getSafeGeminiErrorDetails = (error) => ({
  name: error && error.name ? error.name : "Error",
  status: error && error.status ? error.status : undefined,
  code: error && error.code ? error.code : undefined,
});

const getFileExtension = (filename = "") => {
  const match = String(filename).toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
};

const getAudioFormat = (file) => {
  const extension = getFileExtension(file.originalname);
  const mimeType = String(file.mimetype || "").toLowerCase();

  return Object.entries(AUDIO_FORMATS).find(([, format]) => {
    return (
      format.extensions.includes(extension) ||
      format.mimeTypes.includes(mimeType)
    );
  });
};

const readAtomSize = (buffer, offset) => {
  if (offset + 8 > buffer.length) {
    return null;
  }

  const size32 = buffer.readUInt32BE(offset);
  if (size32 === 1) {
    if (offset + 16 > buffer.length) {
      return null;
    }

    const size64 = buffer.readBigUInt64BE(offset);
    if (size64 > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }

    return Number(size64);
  }

  if (size32 === 0) {
    return buffer.length - offset;
  }

  return size32;
};

const getMp4DurationSeconds = (buffer, start = 0, end = buffer.length) => {
  let offset = start;

  while (offset + 8 <= end) {
    const atomSize = readAtomSize(buffer, offset);
    if (!atomSize || atomSize < 8 || offset + atomSize > end) {
      return null;
    }

    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const headerSize = buffer.readUInt32BE(offset) === 1 ? 16 : 8;
    const payloadStart = offset + headerSize;
    const payloadEnd = offset + atomSize;

    if (type === "mvhd") {
      const version = buffer.readUInt8(payloadStart);
      if (version === 1 && payloadStart + 36 <= payloadEnd) {
        const timescale = buffer.readUInt32BE(payloadStart + 20);
        const duration = buffer.readBigUInt64BE(payloadStart + 24);
        return timescale > 0 ? Number(duration) / timescale : null;
      }

      if (version === 0 && payloadStart + 24 <= payloadEnd) {
        const timescale = buffer.readUInt32BE(payloadStart + 12);
        const duration = buffer.readUInt32BE(payloadStart + 16);
        return timescale > 0 ? duration / timescale : null;
      }

      return null;
    }

    if (["moov", "trak", "mdia"].includes(type)) {
      const duration = getMp4DurationSeconds(buffer, payloadStart, payloadEnd);
      if (duration !== null) {
        return duration;
      }
    }

    offset += atomSize;
  }

  return null;
};

const getWavDurationSeconds = (buffer) => {
  if (
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return null;
  }

  let offset = 12;
  let byteRate = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > buffer.length) {
      return null;
    }

    if (chunkId === "fmt " && chunkSize >= 16) {
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    }

    if (chunkId === "data") {
      dataSize = chunkSize;
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!byteRate || !dataSize) {
    return null;
  }

  return dataSize / byteRate;
};

const getAudioDurationSeconds = (formatName, buffer) => {
  if (formatName === "wav") {
    return getWavDurationSeconds(buffer);
  }

  if (formatName === "m4a") {
    return getMp4DurationSeconds(buffer);
  }

  return null;
};

const validateAudioFile = (file) => {
  if (!file) {
    throw createHttpError(400, "Missing audio file");
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw createHttpError(413, "Audio file must be 10MB or smaller");
  }

  const formatEntry = getAudioFormat(file);
  if (!formatEntry) {
    throw createHttpError(422, "Audio file must be m4a or wav");
  }

  const [formatName] = formatEntry;
  const durationSeconds = getAudioDurationSeconds(formatName, file.buffer);
  if (durationSeconds === null) {
    throw createHttpError(422, "Could not read audio duration");
  }

  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw createHttpError(422, "Audio duration must be 60 seconds or shorter");
  }

  return {
    formatName,
    durationSeconds,
  };
};

const createAntiRegretResponse = async (input, options = {}) => {
  const profile = await profileService.getProfile(input.userId);

  const detectedTrigger = detectTrigger(profile, input);
  const suggestedAction = chooseSuggestedAction(
    profile,
    input,
    detectedTrigger,
  );
  const urge = mockStore.createSpendingUrge({
    ...input,
    detectedTrigger,
    suggestedAction,
  });
  const fallbackCoachMessage = buildCoachMessage(
    profile,
    input,
    detectedTrigger,
    suggestedAction,
  );
  const generateCoachMessage =
    options.generateCoachMessage ||
    geminiService.generateAntiRegretCoachMessage;
  const spendingContext = await getRecentSpendingContext(input.userId);

  let coachMessage = fallbackCoachMessage;
  let providerUsed = "fallback";
  try {
    const generatedMessage = await generateCoachMessage({
      mainGoal: profile.mainGoal,
      triggers: profile.triggers || [],
      preferredTone: profile.preferredTone,
      itemName: input.itemName,
      amount: input.amount,
      reason: input.reason,
      detectedTrigger,
      suggestedAction,
      recentSpendingSummary: buildRecentSpendingSummary(
        spendingContext.recentExpenses,
        spendingContext.totalSpent,
      ),
    });

    if (generatedMessage) {
      coachMessage = generatedMessage;
      providerUsed = "gemini";
    }
  } catch (error) {
    const message =
      error && error.message ? error.message : "Unknown Gemini error";
    console.warn(
      `[Gemini] failed: ${message}`,
      getSafeGeminiErrorDetails(error),
    );
  }

  mockStore.updateSpendingUrgeCoachMessage(urge.id, coachMessage);

  return {
    urgeId: urge.id,
    coachMessage,
    suggestedAction,
    detectedTrigger,
    providerUsed,
  };
};

const createChatResponse = async (input, options = {}) => {
  const profile = await profileService.getProfile(input.userId);

  const spendingContext = await getRecentSpendingContext(input.userId);
  const generateChatReply =
    options.generateChatReply || geminiService.generateCoachChatReply;

  const generatedReply = await generateChatReply({
    userMessage: input.message,
    mainGoal: profile.mainGoal,
    triggers: profile.triggers || [],
    preferredTone: profile.preferredTone,
    monthlyBudget: profile.monthlyBudget,
    monthlySpent: spendingContext.totalSpent,
    recentExpenses: spendingContext.recentExpenses,
    recentSpendingSummary: buildRecentExpenseSummaryForChat(
      spendingContext.recentExpenses,
    ),
  });

  return {
    reply: generatedReply.reply,
    suggestedQuestions: generatedReply.suggestedQuestions,
    providerUsed: "gemini",
    retryCount: generatedReply.retryCount || 0,
  };
};

const createVoiceMessageResponse = async (input, options = {}) => {
  const userId = String(input.userId || "").trim();
  if (!userId) {
    throw createHttpError(422, "Validation failed", {
      userId: ["Required"],
    });
  }

  validateAudioFile(input.audioFile);

  const generateVoiceTranscription =
    options.generateVoiceTranscription || geminiService.generateVoiceTranscription;
  const transcribedText = await generateVoiceTranscription({
    audioBuffer: input.audioFile.buffer,
    mimeType: input.audioFile.mimetype,
  });

  const chatResponse = await createChatResponse(
    {
      userId,
      message: transcribedText,
    },
    options,
  );

  return {
    transcribedText,
    coachReply: chatResponse.reply,
    suggestedQuestions: chatResponse.suggestedQuestions,
    providerUsed: chatResponse.providerUsed,
    retryCount: chatResponse.retryCount,
  };
};

module.exports = {
  buildCoachMessage,
  createChatResponse,
  createVoiceMessageResponse,
  createAntiRegretResponse,
  detectTrigger,
  validateAudioFile,
};
