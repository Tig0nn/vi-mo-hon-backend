const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  if (!err.status || err.status >= 500) {
    console.error(err.stack);
  }

  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(res, message, statusCode, err.errors || null);
};

module.exports = errorHandler;
