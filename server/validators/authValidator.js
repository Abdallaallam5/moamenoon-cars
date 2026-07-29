/**
 * validators/authValidator.js
 * -----------------------------------------------------------------------
 * Validation rule chains for authentication routes, using express-validator.
 * Each export is an array of middlewares that populate req errors,
 * checked at the end by the `validate` helper in the controller.
 * -----------------------------------------------------------------------
 */

const { body } = require('express-validator');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),

  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^[+0-9\s-]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
];

const loginValidator = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const updatePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

module.exports = { registerValidator, loginValidator, updatePasswordValidator };
