/**
 * controllers/userController.js
 * -----------------------------------------------------------------------
 * Admin-facing user management + dashboard statistics.
 * -----------------------------------------------------------------------
 */

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Message = require('../models/Message');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (admin)
const getUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;

  const users = await User.find(filter).sort('-createdAt');
  res.status(200).json({ success: true, count: users.length, data: users });
});

// @desc    Get a single user
// @route   GET /api/users/:id
// @access  Private (admin)
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError('User not found', 404);
  res.status(200).json({ success: true, data: user });
});

// @desc    Update a user's role or active status
// @route   PUT /api/users/:id
// @access  Private (admin)
const updateUser = asyncHandler(async (req, res) => {
  const allowedFields = ['role', 'isActive', 'isVerified'];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError('User not found', 404);

  res.status(200).json({ success: true, message: 'User updated', data: user });
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private (admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError('User not found', 404);
  res.status(200).json({ success: true, message: 'User deleted successfully' });
});

// @desc    Get dashboard statistics (users, listings, pending approvals, messages)
// @route   GET /api/users/dashboard-stats
// @access  Private (admin)
const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalVehicles, pendingVehicles, approvedVehicles, totalMessages, vehiclesByCategory] =
    await Promise.all([
      User.countDocuments(),
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'pending' }),
      Vehicle.countDocuments({ status: 'approved' }),
      Message.countDocuments(),
      Vehicle.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { _id: 0, category: '$category.name', count: 1 } },
      ]),
    ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalVehicles,
      pendingVehicles,
      approvedVehicles,
      totalMessages,
      vehiclesByCategory,
    },
  });
});

module.exports = { getUsers, getUserById, updateUser, deleteUser, getDashboardStats };
