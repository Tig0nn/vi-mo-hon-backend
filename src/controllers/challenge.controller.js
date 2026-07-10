const challengeService = require('../services/challenge.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const {
  challengeCompleteSchema,
  challengeIdSchema,
  challengeListQuerySchema,
} = require('../validators/challenge.validator');

const listActiveChallenges = async (req, res, next) => {
  const result = challengeListQuerySchema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, await challengeService.listActiveChallenges(result.data.userId), 'Challenges retrieved', 200);
  } catch (error) {
    return next(error);
  }
};

const completeChallenge = async (req, res, next) => {
  const paramsResult = challengeIdSchema.safeParse(req.params.challengeId);
  if (!paramsResult.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(paramsResult.error));
  }

  const bodyResult = challengeCompleteSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(bodyResult.error));
  }

  try {
    return sendSuccess(
      res,
      await challengeService.completeChallenge(bodyResult.data.userId, paramsResult.data),
      'Challenge completed',
      200
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  completeChallenge,
  listActiveChallenges,
};
