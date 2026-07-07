const dashboardService = require('../services/dashboard.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { userIdSchema } = require('../validators/profile.validator');

const getDashboard = (req, res, next) => {
  const result = userIdSchema.safeParse(req.params.userId);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    return sendSuccess(res, dashboardService.getDashboard(result.data), 'Dashboard retrieved', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
};
