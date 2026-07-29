/**
 * models/Review.js
 * -----------------------------------------------------------------------
 * Reviews/ratings left by users about a seller (and optionally tied to
 * a specific vehicle transaction).
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller being reviewed is required'],
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle', // optional: review can reference the specific listing
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    isApproved: {
      type: Boolean,
      default: true, // admin can moderate/hide inappropriate reviews
    },
  },
  { timestamps: true }
);

// A reviewer can only leave one review per seller (edit instead of duplicate)
reviewSchema.index({ reviewer: 1, seller: 1 }, { unique: true });
reviewSchema.index({ seller: 1, isApproved: 1 });

module.exports = mongoose.model('Review', reviewSchema);
