const coachService = require('../services/coach.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { antiRegretCoachSchema } = require('../validators/coach.validator');

const createAntiRegretResponse = (req, res, next) => {
  const result = antiRegretCoachSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(
      res,
      coachService.createAntiRegretResponse(result.data),
      'Coach response generated',
      200
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createAntiRegretResponse,
};
