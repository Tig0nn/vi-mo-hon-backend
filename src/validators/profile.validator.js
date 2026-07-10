const { z } = require("zod");

const MAIN_GOALS = [
  "save_money",
  "reduce_impulse_shopping",
  "reduce_food_drink",
  "reduce_sale_spending",
  "emergency_fund",
  "other",
];

const TRIGGER_CODES = [
  "flash_sale",
  "emotional_spending",
  "friends",
  "social_media",
  "payday",
  "social_comparison",
  "food_craving",
  "fomo",
  "self_reward",
  "other",
];

const PREFERRED_TONES = [
  "gentle",
  "funny",
  "sarcastic-light",
  "strict-but-kind",
];

const userIdSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng gửi userId.")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, {
    message:
      "User ID chỉ được chứa chữ cái, số, dấu gạch dưới và dấu gạch ngang.",
  });

const requiredPositiveInteger = (requiredMessage, invalidMessage) =>
  z
    .number({
      error: (issue) =>
        issue.input === undefined ? requiredMessage : invalidMessage,
    })
    .finite(invalidMessage)
    .int(invalidMessage)
    .positive(invalidMessage);
const monthlyBudgetSchema = requiredPositiveInteger(
  "Vui lòng nhập giới hạn chi tiêu mỗi tháng.",
  "Giới hạn chi tiêu mỗi tháng phải là số nguyên lớn hơn 0.",
);

const targetAmountSchema = requiredPositiveInteger(
  "Vui lòng nhập số tiền mục tiêu.",
  "Số tiền mục tiêu phải là số nguyên lớn hơn 0.",
);

const isValidDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const getUtcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const targetDateSchema = z
  .string({ error: "Vui lòng nhập thời hạn hoàn thành." })
  .trim()
  .min(1, "Vui lòng nhập thời hạn hoàn thành.")
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Thời hạn hoàn thành phải có định dạng YYYY-MM-DD.",
  )
  .refine(isValidDateOnly, "Thời hạn hoàn thành phải là một ngày hợp lệ.")
  .refine(
    (value) => value > getUtcDateKey(),
    "Thời hạn hoàn thành phải là một ngày trong tương lai.",
  );

const mainGoalSchema = z.enum(MAIN_GOALS, {
  error: "Mục tiêu tài chính không hợp lệ.",
});

const triggerSchema = z.enum(TRIGGER_CODES, {
  error: "Lý do dễ chi tiêu không hợp lệ.",
});

const triggersSchema = z
  .array(triggerSchema, { error: "Hãy chọn ít nhất một lúc bạn dễ tiêu tiền." })
  .min(1, "Hãy chọn ít nhất một lúc bạn dễ tiêu tiền.")
  .transform((triggers) => [...new Set(triggers)]);

const preferredToneSchema = z.enum(PREFERRED_TONES, {
  error: "Phong cách Coach không hợp lệ.",
});

const profileCreateSchema = z.object({
  userId: userIdSchema,
  displayName: z
    .string({ error: "Vui lòng nhập tên hiển thị." })
    .trim()
    .min(1, "Vui lòng nhập tên hiển thị.")
    .max(80, "Tên hiển thị không được vượt quá 80 ký tự."),
  monthlyBudget: monthlyBudgetSchema,
  mainGoal: mainGoalSchema,
  targetAmount: targetAmountSchema,
  targetDate: targetDateSchema,
  triggers: triggersSchema,
  preferredTone: preferredToneSchema.default("funny"),
});

const profileUpdateSchema = z
  .object({
    displayName: z
      .string({ error: "Tên hiển thị không hợp lệ." })
      .trim()
      .min(1, "Vui lòng nhập tên hiển thị.")
      .max(80, "Tên hiển thị không được vượt quá 80 ký tự.")
      .optional(),
    monthlyBudget: monthlyBudgetSchema.optional(),
    mainGoal: mainGoalSchema.optional(),
    targetAmount: targetAmountSchema.optional(),
    targetDate: targetDateSchema.optional(),
    triggers: triggersSchema.optional(),
    preferredTone: preferredToneSchema.optional(),
  })
  .strict(
    "Không được gửi userId hoặc field không được hỗ trợ khi cập nhật Profile.",
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: "Cần gửi ít nhất một field Profile để cập nhật.",
  });

module.exports = {
  MAIN_GOALS,
  PREFERRED_TONES,
  TRIGGER_CODES,
  profileCreateSchema,
  profileUpdateSchema,
  userIdSchema,
};
