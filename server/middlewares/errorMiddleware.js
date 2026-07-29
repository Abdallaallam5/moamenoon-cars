/**
 * middlewares/errorMiddleware.js
 * -----------------------------------------------------------------------
 * Centralized error handling for the whole API.
 * Every controller can simply do: `next(new ApiError('message', 404))`
 * or throw inside an async handler wrapped with `asyncHandler`.
 * -----------------------------------------------------------------------
 */

const env = require('../config/env');

/**
 * Custom error class that carries an HTTP status code alongside the message.
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps an async controller so any rejected promise is forwarded to
 * Express's error handler instead of crashing the process.
 * Usage: router.get('/', asyncHandler(controllerFn))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 handler - runs when no route matched the request.
 */
const notFound = (req, res, next) => {
  const error = new ApiError(`Route not found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Final error handler - must be registered LAST in app.js (4 arguments).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode && err.statusCode !== 200 ? err.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired, please log in again';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only expose stack trace in development, never in production
    stack: env.isProduction ? undefined : err.stack,
  });
};

module.exports = { ApiError, asyncHandler, notFound, errorHandler };
