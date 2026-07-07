const { sendError } = require('../utils/response');

const notFoundHandler = (req, res, next) => {
  return sendError(res, 'Resource not found', 404);
};

module.exports = notFoundHandler;
