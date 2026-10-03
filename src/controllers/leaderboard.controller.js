const leaderboardService = require('../services/leaderboard.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const { leaderboardQuerySchema } = require('../validators/leaderboard.validator');

const getLeaderboard = async (req, res, next) => {
  const result = leaderboardQuerySchema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    const data = await leaderboardService.getLeaderboard(result.data);
    return sendSuccess(res, data, 'Lấy bảng xếp hạng thành công', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getLeaderboard,
};
