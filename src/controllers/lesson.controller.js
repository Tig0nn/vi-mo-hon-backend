const lessonService = require('../services/lesson.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const {
  lessonCompleteSchema,
  lessonIdSchema,
  lessonListQuerySchema,
} = require('../validators/lesson.validator');

const listLessons = async (req, res, next) => {
  const result = lessonListQuerySchema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(
      res,
      await lessonService.listLessons(result.data.userId, result.data.bossId),
      'Lessons retrieved',
      200,
    );
  } catch (error) {
    return next(error);
  }
};

const completeLesson = async (req, res, next) => {
  const paramsResult = lessonIdSchema.safeParse(req.params.lessonId);
  if (!paramsResult.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(paramsResult.error));
  }

  const bodyResult = lessonCompleteSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(bodyResult.error));
  }

  try {
    return sendSuccess(
      res,
      await lessonService.completeLesson(
        bodyResult.data.userId,
        paramsResult.data,
        bodyResult.data.answerId,
      ),
      'Lesson completed',
      200,
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  completeLesson,
  listLessons,
};
