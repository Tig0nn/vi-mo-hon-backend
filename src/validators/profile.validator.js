const { z } = require('zod');

const userIdSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, {
  message: 'User ID can only contain letters, numbers, underscores, and hyphens',
});

const profileCreateSchema = z.object({
  userId: userIdSchema,
  displayName: z.string().trim().min(1).max(100),
  monthlyBudget: z.coerce.number().int().nonnegative(),
  currency: z.string().trim().min(1).max(10).default('VND'),
  mainGoal: z.string().trim().min(1).max(200).optional(),
  triggers: z.array(z.string().trim().min(1).max(80)).optional(),
  preferredTone: z.string().trim().min(1).max(50).optional(),
});

const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    monthlyBudget: z.coerce.number().int().nonnegative().optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    mainGoal: z.string().trim().min(1).max(200).optional(),
    triggers: z.array(z.string().trim().min(1).max(80)).optional(),
    preferredTone: z.string().trim().min(1).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field is required',
  });

module.exports = {
  profileCreateSchema,
  profileUpdateSchema,
  userIdSchema,
};
