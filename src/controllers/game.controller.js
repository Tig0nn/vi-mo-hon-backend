const gameService = require('../services/game.service');
const { sendError, sendSuccess } = require('../utils/response');
const { formatZodErrors } = require('../utils/validation');
const {
  endSessionSchema,
  startSessionSchema,
  userIdParamSchema,
} = require('../validators/game.validator');

const getTickets = async (req, res, next) => {
  const result = userIdParamSchema.safeParse(req.params.userId);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    const data = await gameService.getTicketStatus(result.data);
    return sendSuccess(res, data, 'Lấy thông tin vé chơi thành công', 200);
  } catch (error) {
    return next(error);
  }
};

const startSession = async (req, res, next) => {
  const result = startSessionSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    const data = await gameService.startSession(result.data.userId);
    return sendSuccess(res, data, 'Khởi tạo ván chơi thành công', 200);
  } catch (error) {
    return next(error);
  }
};

const endSession = async (req, res, next) => {
  const result = endSessionSchema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validation failed', 422, formatZodErrors(result.error));
  }

  try {
    const data = await gameService.endSession(result.data);
    return sendSuccess(res, data, 'Kết thúc ván chơi và cập nhật phần thưởng thành công', 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  endSession,
  getTickets,
  startSession,
};
