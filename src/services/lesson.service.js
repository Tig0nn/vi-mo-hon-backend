const lessonRepository = require('../repositories/lesson.repository');
const { createHttpError } = require('../utils/httpError');
const profileService = require('./profile.service');

const getSafeSupabaseErrorDetails = (error) => ({
  message: error && error.message ? error.message : 'Unknown database error',
  code: error && error.code ? error.code : undefined,
  hint: error && error.hint ? error.hint : undefined,
});

const handleDatabaseError = (error) => {
  console.error('[Supabase] lesson operation failed', getSafeSupabaseErrorDetails(error));
  throw createHttpError(500, 'Database error');
};

const listLessons = async (userId, bossId) => {
  await profileService.getProfile(userId);
  try {
    return { items: await lessonRepository.listLessons(userId, bossId) };
  } catch (error) {
    handleDatabaseError(error);
  }
};

const completeLesson = async (userId, lessonId, answerId) => {
  let result;
  try {
    result = await lessonRepository.completeLesson(userId, lessonId, answerId);
  } catch (error) {
    handleDatabaseError(error);
  }

  if (result.outcome === 'profile_not_found') {
    throw createHttpError(404, 'Profile not found');
  }
  if (result.outcome === 'lesson_not_found') {
    throw createHttpError(404, 'Lesson not found');
  }
  if (result.outcome === 'incorrect_answer') {
    throw createHttpError(422, 'Lesson answer is incorrect', {
      code: 'LESSON_ANSWER_INCORRECT',
      explanation: result.explanation || '',
    });
  }
  if (result.outcome === 'lesson_already_completed') {
    throw createHttpError(409, 'Lesson already completed', {
      code: 'LESSON_ALREADY_COMPLETED',
    });
  }
  if (result.outcome !== 'success') {
    throw createHttpError(500, 'Database error');
  }

  return {
    lessonId: result.lessonId,
    status: 'completed',
    progression: result.progression,
    explanation: result.explanation,
  };
};

module.exports = {
  completeLesson,
  listLessons,
};
