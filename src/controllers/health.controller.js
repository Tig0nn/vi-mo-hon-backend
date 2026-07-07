const { sendSuccess } = require('../utils/response');

const getHealthStatus = (req, res) => {
  return sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() }, 'Server is healthy', 200);
};

module.exports = {
  getHealthStatus,
};
