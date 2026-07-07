const { z } = require('zod');
const { userIdSchema } = require('./profile.validator');

const paginationSchema = z.object({
  userId: userIdSchema,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const quickExpenseSchema = z
  .object({
    userId: userIdSchema,
    text: z.string().trim().min(1).max(500).optional(),
    amount: z.coerce.number().int().positive().optional(),
    category: z.string().trim().min(1).max(50).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .refine((value) => value.text || value.amount, {
    message: 'Either text or amount is required',
  });

module.exports = {
  paginationSchema,
  quickExpenseSchema,
};
