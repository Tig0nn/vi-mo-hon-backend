const { z } = require('zod');
const { userIdSchema } = require('./profile.validator');

const antiRegretCoachSchema = z.object({
  userId: userIdSchema,
  itemName: z.string().trim().min(1).max(120),
  amount: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(300),
  trigger: z.enum(['flash_sale', 'fomo', 'friends', 'emotional', 'self_reward', 'other']).optional(),
  mode: z.enum(['BEFORE_PURCHASE', 'AFTER_PURCHASE']).optional(),
});

const chatCoachSchema = z.object({
  userId: userIdSchema,
  message: z.string().trim().min(1).max(500),
});

module.exports = {
  antiRegretCoachSchema,
  chatCoachSchema,
};
