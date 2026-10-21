function notFoundHandler(req, res, next) {
  const fullPath = req.originalUrl || req.baseUrl || req.path;
  if (fullPath.startsWith('/api') || req.baseUrl.startsWith('/api')) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${fullPath} not found`
      }
    });
  }
  next();
}

function globalErrorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred';

  // Do not leak internal stack traces or database connection details to clients
  res.status(status).json({
    error: {
      code,
      message
    }
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
