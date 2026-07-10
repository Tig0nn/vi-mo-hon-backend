const { z } = require('zod');
const { userIdSchema } = require('./profile.validator');

const antiRegretCoachSchema = z.object({
  userId: userIdSchema,
  itemName: z.string().trim().min(1).max(120),
  amount: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(300),
  mode: z.enum(['BEFORE_PURCHASE', 'AFTER_PURCHASE']).optional(),
});

module.exports = {
  antiRegretCoachSchema,
};
