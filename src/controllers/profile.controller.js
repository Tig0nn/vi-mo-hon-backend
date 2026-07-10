const profileService = require('../services/profile.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { profileCreateSchema, profileUpdateSchema, userIdSchema } = require('../validators/profile.validator');

const createProfile = async (req, res, next) => {
  const result = profileCreateSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 400, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, await profileService.createProfile(result.data), 'Profile created', 201);
  } catch (error) {
    return next(error);
  }
};

const getProfile = async (req, res, next) => {
  const result = userIdSchema.safeParse(req.params.userId);
  if (!result.success) {
    return sendError(res, 'Validation failed', 400, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, await profileService.getProfile(result.data), 'Profile retrieved', 200);
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  const userIdResult = userIdSchema.safeParse(req.params.userId);
  if (!userIdResult.success) {
    return sendError(res, 'Validation failed', 400, formatZodErrors(userIdResult.error));
  }

  const bodyResult = profileUpdateSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return sendError(res, 'Validation failed', 400, formatZodErrors(bodyResult.error));
  }

  try {
    return sendSuccess(
      res,
      await profileService.updateProfile(userIdResult.data, bodyResult.data),
      'Profile updated',
      200
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProfile,
  getProfile,
  updateProfile,
};
