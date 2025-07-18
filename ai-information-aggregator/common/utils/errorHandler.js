/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error handler middleware for Express
 */
const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message = 'Internal Server Error', isOperational = false } = err;
  
  // Log error
  req.app.locals.logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  // Send error response
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: isOperational ? message : 'Internal Server Error'
  });
};

/**
 * Handle uncaught exceptions
 */
const setupUncaughtExceptionHandler = (logger) => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    
    // Exit with failure
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
const setupUnhandledRejectionHandler = (logger) => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    // Exit with failure
    process.exit(1);
  });
};

module.exports = {
  ApiError,
  errorHandler,
  setupUncaughtExceptionHandler,
  setupUnhandledRejectionHandler
};