const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');
const geminiService = require('./gemini.service');

const GENERAL_TRIGGER = 'other';

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const formatVnd = (amount) => `${Number(amount).toLocaleString('vi-VN')}đ`;

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
  const profileTrigger = (profile.triggers || []).find((trigger) => haystack.includes(normalizeText(trigger)));

  if (profileTrigger) {
    const normalizedProfileTrigger = normalizeText(profileTrigger)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    if (['flash_sale', 'fomo', 'friends', 'emotional', 'self_reward', 'other'].includes(normalizedProfileTrigger)) {
      return normalizedProfileTrigger;
    }
  }

  if (/(flash|sale|deal|discount|giam gia|shopee|voucher)/.test(haystack)) {
    return 'flash_sale';
  }

  if (/(stress|cang thang|chan|buon|met)/.test(haystack)) {
    return 'emotional';
  }

  if (/(tu thuong|self reward|reward|thuong ban than)/.test(haystack)) {
    return 'self_reward';
  }

  if (/(ban be|ru|trend|fomo|so lo)/.test(haystack)) {
    if (/(ban be|ru)/.test(haystack)) {
      return 'friends';
    }

    return 'fomo';
  }

  return GENERAL_TRIGGER;
};

const chooseSuggestedAction = (profile, input, detectedTrigger) => {
  const trigger = normalizeText(detectedTrigger);
  const budgetShare = profile.monthlyBudget > 0 ? input.amount / profile.monthlyBudget : 0;

  if (trigger.includes('flash_sale') || trigger.includes('sale') || trigger.includes('shopee') || budgetShare >= 0.1) {
    return 'WAIT_24_HOURS';
  }

  if (trigger.includes('emotional')) {
    return 'TAKE_10_MIN_BREATHER';
  }

  if (trigger.includes('fomo') || trigger.includes('friends')) {
    return 'ASK_IF_YOU_STILL_WANT_IT_TOMORROW';
  }

  return 'COMPARE_WITH_GOAL';
};

const buildCoachMessage = (profile, input, detectedTrigger, suggestedAction) => {
  const itemName = truncate(input.itemName, 32);
  const goal = truncate(profile.mainGoal || 'mục tiêu tài chính của bạn', 44);
  const amount = formatVnd(input.amount);
  const triggerText = detectedTrigger === GENERAL_TRIGGER ? 'cơn muốn mua này' : `trigger "${detectedTrigger}"`;
  const tone = normalizeText(profile.preferredTone || 'gentle').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

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

  const message = messages[tone] || fallbackByAction[suggestedAction] || messages.gentle;
  if (message.length <= 180) {
    return message;
  }

  return `Khoan chốt ${itemName}. Đợi 24h, so với goal "${goal}", rồi quyết nha.`;
};

const buildRecentSpendingSummary = (userId) => {
  const recentExpenses = mockStore.listExpensesByUserId(userId, { page: 1, pageSize: 3 });
  const totalSpent = mockStore.sumExpensesByUserId(userId);

  if (recentExpenses.items.length === 0) {
    return 'No recent spending recorded.';
  }

  const items = recentExpenses.items
    .map((expense) => {
      const category = expense.category || 'uncategorized';
      return `${category}: ${formatVnd(expense.amount)}`;
    })
    .join('; ');

  return `Total recorded spending: ${formatVnd(totalSpent)}. Recent expenses: ${items}.`;
};

const listRecentExpenseContext = (userId) =>
  mockStore.listExpensesByUserId(userId, { page: 1, pageSize: 5 }).items.map((expense) => ({
    amount: expense.amount,
    category: expense.category || 'uncategorized',
    occurredAt: expense.occurredAt,
    text: expense.text || null,
  }));

const buildRecentExpenseSummaryForChat = (recentExpenses) => {
  if (!recentExpenses.length) {
    return 'No recent spending recorded.';
  }

  return recentExpenses
    .map((expense) => `${expense.category}: ${formatVnd(expense.amount)}`)
    .join('; ');
};

const getSafeGeminiErrorDetails = (error) => ({
  name: error && error.name ? error.name : 'Error',
  status: error && error.status ? error.status : undefined,
  code: error && error.code ? error.code : undefined,
});

const createAntiRegretResponse = async (input, options = {}) => {
  const profile = mockStore.findProfileByUserId(input.userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const detectedTrigger = detectTrigger(profile, input);
  const suggestedAction = chooseSuggestedAction(profile, input, detectedTrigger);
  const urge = mockStore.createSpendingUrge({
    ...input,
    detectedTrigger,
    suggestedAction,
  });
  const fallbackCoachMessage = buildCoachMessage(profile, input, detectedTrigger, suggestedAction);
  const generateCoachMessage =
    options.generateCoachMessage || geminiService.generateAntiRegretCoachMessage;

  let coachMessage = fallbackCoachMessage;
  let providerUsed = 'fallback';
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
      recentSpendingSummary: buildRecentSpendingSummary(input.userId),
    });

    if (generatedMessage) {
      coachMessage = generatedMessage;
      providerUsed = 'gemini';
    }
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown Gemini error';
    console.warn(`[Gemini] failed: ${message}`, getSafeGeminiErrorDetails(error));
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
  const profile = mockStore.findProfileByUserId(input.userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const monthlySpent = mockStore.sumExpensesByUserId(input.userId);
  const recentExpenses = listRecentExpenseContext(input.userId);
  const generateChatReply = options.generateChatReply || geminiService.generateCoachChatReply;

  const generatedReply = await generateChatReply({
    userMessage: input.message,
    mainGoal: profile.mainGoal,
    triggers: profile.triggers || [],
    preferredTone: profile.preferredTone,
    monthlyBudget: profile.monthlyBudget,
    monthlySpent,
    recentExpenses,
    recentSpendingSummary: buildRecentExpenseSummaryForChat(recentExpenses),
  });

  return {
    reply: generatedReply.reply,
    suggestedQuestions: generatedReply.suggestedQuestions,
    providerUsed: 'gemini',
    retryCount: generatedReply.retryCount || 0,
  };
};

module.exports = {
  buildCoachMessage,
  createChatResponse,
  createAntiRegretResponse,
  detectTrigger,
};
