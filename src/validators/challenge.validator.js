const { z } = require('zod');
const { userIdSchema } = require('./profile.validator');

const challengeIdSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, {
  message: 'Challenge ID can only contain letters, numbers, underscores, and hyphens',
});

const challengeListQuerySchema = z.object({
  userId: userIdSchema,
});

const challengeCompleteSchema = z.object({
  userId: userIdSchema,
});

module.exports = {
  challengeCompleteSchema,
  challengeIdSchema,
  challengeListQuerySchema,
};
