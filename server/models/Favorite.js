/**
 * models/Favorite.js
 * -----------------------------------------------------------------------
 * Join model representing a user "saving"/"liking" a vehicle listing.
 * A compound unique index prevents the same user favoriting the same
 * vehicle more than once.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate favorites (one user can favorite one vehicle only once)
favoriteSchema.index({ user: 1, vehicle: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
