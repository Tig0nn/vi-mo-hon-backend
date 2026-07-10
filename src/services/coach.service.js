const mockStore = require('../data/mockStore');
const { createHttpError } = require('../utils/httpError');

const GENERAL_TRIGGER = 'general';

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
  const haystack = normalizeText(`${input.itemName} ${input.reason}`);
  const profileTrigger = (profile.triggers || []).find((trigger) => haystack.includes(normalizeText(trigger)));

  if (profileTrigger) {
    return profileTrigger;
  }

  if (/(flash|sale|deal|discount|giam gia|shopee|voucher)/.test(haystack)) {
    return 'flash sale';
  }

  if (/(stress|cang thang|chan|buon|met)/.test(haystack)) {
    return 'stress';
  }

  if (/(ban be|ru|trend|fomo|so lo)/.test(haystack)) {
    return 'FOMO';
  }

  return GENERAL_TRIGGER;
};

const chooseSuggestedAction = (profile, input, detectedTrigger) => {
  const trigger = normalizeText(detectedTrigger);
  const budgetShare = profile.monthlyBudget > 0 ? input.amount / profile.monthlyBudget : 0;

  if (trigger.includes('sale') || trigger.includes('shopee') || budgetShare >= 0.1) {
    return 'WAIT_24_HOURS';
  }

  if (trigger.includes('stress')) {
    return 'TAKE_10_MIN_BREATHER';
  }

  if (trigger.includes('fomo') || trigger.includes('ban be')) {
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

const createAntiRegretResponse = (input) => {
  const profile = mockStore.findProfileByUserId(input.userId);
  if (!profile) {
    throw createHttpError(404, 'Profile not found');
  }

  const detectedTrigger = detectTrigger(profile, input);
  const suggestedAction = chooseSuggestedAction(profile, input, detectedTrigger);
  const coachMessage = buildCoachMessage(profile, input, detectedTrigger, suggestedAction);
  const urge = mockStore.createSpendingUrge({
    ...input,
    detectedTrigger,
    suggestedAction,
  });

  return {
    urgeId: urge.id,
    coachMessage,
    suggestedAction,
    detectedTrigger,
  };
};

module.exports = {
  createAntiRegretResponse,
};
