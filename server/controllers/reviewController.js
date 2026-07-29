/**
 * controllers/reviewController.js
 * -----------------------------------------------------------------------
 */

const Review = require('../models/Review');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Get all reviews for a specific seller
// @route   GET /api/reviews/seller/:sellerId
// @access  Public
const getSellerReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ seller: req.params.sellerId, isApproved: true })
    .sort('-createdAt')
    .populate('reviewer', 'name avatar');

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  res.status(200).json({
    success: true,
    count: reviews.length,
    averageRating: Number(avgRating.toFixed(1)),
    data: reviews,
  });
});

// @desc    Create a review for a seller
// @route   POST /api/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { seller, vehicle, rating, comment } = req.body;

  if (seller === req.user._id.toString()) {
    throw new ApiError('You cannot review yourself', 400);
  }

  const existing = await Review.findOne({ reviewer: req.user._id, seller });
  if (existing) {
    throw new ApiError('You have already reviewed this seller. You can edit your existing review instead.', 400);
  }

  const review = await Review.create({
    reviewer: req.user._id,
    seller,
    vehicle,
    rating,
    comment,
  });

  res.status(201).json({ success: true, message: 'Review submitted', data: review });
});

// @desc    Update own review
// @route   PUT /api/reviews/:id
// @access  Private (author only)
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError('Review not found', 404);

  if (review.reviewer.toString() !== req.user._id.toString()) {
    throw new ApiError('You can only edit your own reviews', 403);
  }

  review.rating = req.body.rating ?? review.rating;
  review.comment = req.body.comment ?? review.comment;
  await review.save();

  res.status(200).json({ success: true, message: 'Review updated', data: review });
});

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (author or admin)
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError('Review not found', 404);

  const isAuthor = review.reviewer.toString() === req.user._id.toString();
  if (!isAuthor && req.user.role !== 'admin') {
    throw new ApiError('You are not authorized to delete this review', 403);
  }

  await review.deleteOne();
  res.status(200).json({ success: true, message: 'Review deleted successfully' });
});

// @desc    Get every review in the system, approved or not (moderation view)
// @route   GET /api/reviews/admin/all
// @access  Private (admin)
const getAllReviewsAdmin = asyncHandler(async (req, res) => {
  const reviews = await Review.find()
    .sort('-createdAt')
    .populate('reviewer', 'name avatar')
    .populate('seller', 'name avatar')
    .populate('vehicle', 'title');

  res.status(200).json({ success: true, count: reviews.length, data: reviews });
});

// @desc    Approve or hide a review
// @route   PUT /api/reviews/:id/approve
// @access  Private (admin)
const toggleApproveReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError('Review not found', 404);

  review.isApproved = req.body.isApproved !== undefined ? req.body.isApproved : !review.isApproved;
  await review.save();

  res.status(200).json({ success: true, message: 'Review moderation updated', data: review });
});

module.exports = {
  getSellerReviews,
  createReview,
  updateReview,
  deleteReview,
  getAllReviewsAdmin,
  toggleApproveReview,
};
