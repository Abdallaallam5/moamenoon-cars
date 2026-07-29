/**
 * routes/reviewRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const {
  getSellerReviews,
  createReview,
  updateReview,
  deleteReview,
  getAllReviewsAdmin,
  toggleApproveReview,
} = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

router.get('/seller/:sellerId', getSellerReviews);

// IMPORTANT: specific route ("admin/all") must come before "/:id" routes
router.get('/admin/all', protect, restrictTo('admin'), getAllReviewsAdmin);

router.post('/', protect, createReview);
router.put('/:id', protect, updateReview);
router.put('/:id/approve', protect, restrictTo('admin'), toggleApproveReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
