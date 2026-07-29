/**
 * middlewares/adminMiddleware.js
 * -----------------------------------------------------------------------
 * Convenience wrapper around restrictTo('admin') for readability in
 * route files, e.g.: router.delete('/:id', protect, isAdmin, controller)
 * -----------------------------------------------------------------------
 */

const { restrictTo } = require('./authMiddleware');

const isAdmin = restrictTo('admin');

module.exports = isAdmin;
