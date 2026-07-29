/**
 * controllers/favoriteController.js
 * -----------------------------------------------------------------------
 */

const Favorite = require('../models/Favorite');
const Vehicle = require('../models/Vehicle');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Get current user's favorite vehicles
// @route   GET /api/favorites
// @access  Private
const getMyFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ user: req.user._id }).populate({
    path: 'vehicle',
    populate: [
      { path: 'brand', select: 'name slug' },
      { path: 'category', select: 'name slug type' },
    ],
  });

  res.status(200).json({ success: true, count: favorites.length, data: favorites });
});

// @desc    Add a vehicle to favorites
// @route   POST /api/favorites/:vehicleId
// @access  Private
const addFavorite = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  const existing = await Favorite.findOne({ user: req.user._id, vehicle: vehicleId });
  if (existing) {
    throw new ApiError('Vehicle is already in your favorites', 400);
  }

  const favorite = await Favorite.create({ user: req.user._id, vehicle: vehicleId });
  await Vehicle.findByIdAndUpdate(vehicleId, { $inc: { favoritesCount: 1 } });

  res.status(201).json({ success: true, message: 'Added to favorites', data: favorite });
});

// @desc    Remove a vehicle from favorites
// @route   DELETE /api/favorites/:vehicleId
// @access  Private
const removeFavorite = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;

  const favorite = await Favorite.findOneAndDelete({ user: req.user._id, vehicle: vehicleId });
  if (!favorite) throw new ApiError('This vehicle is not in your favorites', 404);

  await Vehicle.findByIdAndUpdate(vehicleId, { $inc: { favoritesCount: -1 } });

  res.status(200).json({ success: true, message: 'Removed from favorites' });
});

module.exports = { getMyFavorites, addFavorite, removeFavorite };
