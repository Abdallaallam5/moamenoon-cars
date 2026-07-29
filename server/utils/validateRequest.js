/**
 * utils/validateRequest.js
 * -----------------------------------------------------------------------
 * Runs after an express-validator rule chain to collect any validation
 * errors and turn them into a consistent 400 ApiError response.
 * Usage: router.post('/register', registerValidator, validateRequest, controller)
 * -----------------------------------------------------------------------
 */

const { validationResult } = require('express-validator');
const { ApiError } = require('../middlewares/errorMiddleware');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((err) => err.msg)
      .join(', ');
    return next(new ApiError(message, 400));
  }
  next();
};

module.exports = validateRequest;
