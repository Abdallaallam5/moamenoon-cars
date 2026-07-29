/**
 * routes/userRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getDashboardStats,
} = require('../controllers/userController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// Every route below is admin-only
router.use(protect, restrictTo('admin'));

router.get('/dashboard-stats', getDashboardStats);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
