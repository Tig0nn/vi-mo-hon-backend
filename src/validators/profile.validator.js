const { z } = require('zod');

const userIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, {
  message: 'User ID can only contain letters, numbers, underscores, and hyphens',
});

const nullableNonnegativeIntegerSchema = z.union([z.null(), z.coerce.number().int().nonnegative()]);
const targetDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'targetDate must be a valid date',
  })
  .nullable();
const preferredToneSchema = z.enum(['gentle', 'funny', 'sarcastic-light', 'strict-but-kind']);

const profileCreateSchema = z.object({
  userId: userIdSchema,
  displayName: z.string().trim().min(1).max(100),
  monthlyBudget: nullableNonnegativeIntegerSchema,
  currency: z.string().trim().min(1).max(10).default('VND'),
  mainGoal: z.string().trim().min(1).max(200),
  targetAmount: nullableNonnegativeIntegerSchema.optional(),
  targetDate: targetDateSchema.optional(),
  triggers: z.array(z.string().trim().min(1).max(80)).default([]),
  preferredTone: preferredToneSchema.default('funny'),
});

const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    monthlyBudget: nullableNonnegativeIntegerSchema.optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    mainGoal: z.string().trim().min(1).max(200).optional(),
    targetAmount: nullableNonnegativeIntegerSchema.optional(),
    targetDate: targetDateSchema.optional(),
    triggers: z.array(z.string().trim().min(1).max(80)).optional(),
    preferredTone: preferredToneSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required',
  });

module.exports = {
  profileCreateSchema,
  profileUpdateSchema,
  userIdSchema,
};
