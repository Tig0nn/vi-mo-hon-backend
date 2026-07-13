const { z } = require('zod');
const { userIdSchema } = require('./profile.validator');

const resourceIdSchema = (label) => z.string().trim().min(1).max(80).regex(
  /^[A-Za-z0-9_-]+$/,
  `${label} can only contain letters, numbers, underscores, and hyphens`,
);

const lessonIdSchema = resourceIdSchema('Lesson ID');
const bossIdSchema = resourceIdSchema('Boss ID');
const answerIdSchema = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, {
  message: 'Answer ID can only contain letters, numbers, underscores, and hyphens',
});

const lessonListQuerySchema = z.object({
  userId: userIdSchema,
  bossId: bossIdSchema,
});

const lessonCompleteSchema = z.object({
  userId: userIdSchema,
  answerId: answerIdSchema,
});

module.exports = {
  lessonCompleteSchema,
  lessonIdSchema,
  lessonListQuerySchema,
};
