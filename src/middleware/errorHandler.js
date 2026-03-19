// Global error-handling middleware — must have 4 parameters for Express to recognize it
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error.';

  res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
