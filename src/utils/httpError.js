const createHttpError = (status, message, errors = null) => {
  const error = new Error(message);
  error.status = status;
  if (errors) {
    error.errors = errors;
  }
  return error;
};

module.exports = {
  createHttpError,
};
