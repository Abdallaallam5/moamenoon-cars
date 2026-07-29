/**
 * validators/vehicleValidator.js
 * -----------------------------------------------------------------------
 * Validation rule chains for creating/updating vehicle listings.
 * -----------------------------------------------------------------------
 */

const { body } = require('express-validator');

const currentYear = new Date().getFullYear();

const vehicleValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 120 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),

  body('category').notEmpty().withMessage('Category is required').isMongoId().withMessage('Invalid category id'),
  body('brand').notEmpty().withMessage('Brand is required').isMongoId().withMessage('Invalid brand id'),
  body('model').trim().notEmpty().withMessage('Model is required'),

  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 1950, max: currentYear + 1 })
    .withMessage(`Year must be between 1950 and ${currentYear + 1}`),

  body('mileage').notEmpty().withMessage('Mileage is required').isFloat({ min: 0 }).withMessage('Mileage cannot be negative'),

  body('fuel')
    .notEmpty()
    .withMessage('Fuel type is required')
    .isIn(['petrol', 'diesel', 'electric', 'hybrid', 'lpg'])
    .withMessage('Invalid fuel type'),

  body('transmission')
    .notEmpty()
    .withMessage('Transmission is required')
    .isIn(['manual', 'automatic', 'semi-automatic'])
    .withMessage('Invalid transmission type'),

  body('condition')
    .notEmpty()
    .withMessage('Condition is required')
    .isIn(['new', 'used', 'certified-pre-owned'])
    .withMessage('Invalid condition'),

  body('price').notEmpty().withMessage('Price is required').isFloat({ min: 0 }).withMessage('Price cannot be negative'),

  body('currency').optional().isIn(['USD', 'EGP', 'EUR', 'SAR', 'AED']).withMessage('Invalid currency'),

  body('location.city').notEmpty().withMessage('City is required'),
  body('location.country').notEmpty().withMessage('Country is required'),

  body('horsepower').optional().isFloat({ min: 0 }).withMessage('Horsepower cannot be negative'),
];

module.exports = { vehicleValidator };
