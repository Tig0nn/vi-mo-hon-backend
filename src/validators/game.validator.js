const { z } = require('zod');

const userIdParamSchema = z.string().trim().min(1, 'userId is required');

const startSessionSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
});

const endSessionSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  damageToBoss: z.number().int().min(0).optional().default(0),
  coins: z.number().int().min(0).optional().default(0),
  savingsPoints: z.number().int().min(0).optional(),
  knowledgePoints: z.number().int().min(0).optional().default(0),
  obstaclesDodged: z.number().int().min(0).optional().default(0),
  durationSeconds: z.number().min(0).optional().default(0),
  sessionId: z.string().trim().optional(),
  sessionToken: z.string().trim().optional(),
  reason: z.string().trim().optional().default('completed'),
});

module.exports = {
  endSessionSchema,
  startSessionSchema,
  userIdParamSchema,
};
