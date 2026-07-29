/**
 * middlewares/authMiddleware.js
 * -----------------------------------------------------------------------
 * `protect`    - verifies the JWT and attaches the logged-in user to req.user
 * `restrictTo` - restricts a route to one or more roles (e.g. 'admin')
 * `optionalAuth` - attaches req.user if a valid token is present, but
 *                  does not fail the request if it's missing (useful for
 *                  routes like GET /vehicles/:id where guests can view
 *                  but logged-in users get extra data e.g. isFavorited)
 * -----------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('./errorMiddleware');

/**
 * Extracts the Bearer token from the Authorization header or cookie.
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError('You are not logged in. Please log in to access this resource.', 401);
  }

  // Verify token signature & expiry
  const decoded = jwt.verify(token, env.jwtSecret);

  // Make sure the user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    throw new ApiError('The user belonging to this token no longer exists.', 401);
  }

  // Make sure the account is still active
  if (!currentUser.isActive) {
    throw new ApiError('This account has been deactivated. Contact support.', 403);
  }

  // Make sure the password wasn't changed after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    throw new ApiError('Password was recently changed. Please log in again.', 401);
  }

  req.user = currentUser;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const currentUser = await User.findById(decoded.id);
    if (currentUser && currentUser.isActive) {
      req.user = currentUser;
    }
  } catch (err) {
    // Invalid/expired token on an optional route -> just continue as a guest
  }
  next();
});

/**
 * Usage: restrictTo('admin') or restrictTo('admin', 'seller')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { protect, restrictTo, optionalAuth };
