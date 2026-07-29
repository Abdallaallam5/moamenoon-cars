/**
 * controllers/vehicleController.js
 * -----------------------------------------------------------------------
 * Handles listing creation, retrieval (with search/filter/sort/pagination),
 * updates, deletion, and admin approval workflow.
 * -----------------------------------------------------------------------
 */

const Vehicle = require('../models/Vehicle');
const Brand = require('../models/Brand');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');
const ApiFeatures = require('../utils/apiFeatures');

// @desc    Get all vehicles (search, filter, sort, paginate)
// @route   GET /api/vehicles
// @access  Public
const getVehicles = asyncHandler(async (req, res) => {
  // Only show approved listings to the public; admins can pass status=any
  const baseFilter = {};

if (!req.query.status) {
  baseFilter.status = 'approved';
} else if (req.query.status !== 'any') {
  baseFilter.status = req.query.status;
}

  const countFeatures = new ApiFeatures(Vehicle.find(baseFilter), req.query).search().filter();
  const total = await Vehicle.countDocuments(countFeatures.mongooseQuery.getFilter());

  const features = new ApiFeatures(Vehicle.find(baseFilter), req.query)
    .search()
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const vehicles = await features.mongooseQuery
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug type')
    .populate('seller', 'name avatar');

  res.status(200).json({
    success: true,
    count: vehicles.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: vehicles,
  });
});

// @desc    Get a single vehicle by id (and increment its view count)
// @route   GET /api/vehicles/:id
// @access  Public
const getVehicleById = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id)
    .populate('brand', 'name slug logo')
    .populate('category', 'name slug type')
    .populate('seller', 'name avatar phone createdAt');

  if (!vehicle) {
    throw new ApiError('Vehicle not found', 404);
  }

  // Fire-and-forget view counter increment (doesn't block the response)
  Vehicle.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).exec();

  res.status(200).json({ success: true, data: vehicle });
});

// @desc    Get similar vehicles (same category, close price range)
// @route   GET /api/vehicles/:id/similar
// @access  Public
const getSimilarVehicles = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  const similar = await Vehicle.find({
    _id: { $ne: vehicle._id },
    category: vehicle.category,
    status: 'approved',
    price: { $gte: vehicle.price * 0.7, $lte: vehicle.price * 1.3 },
  })
    .limit(6)
    .populate('brand', 'name slug')
    .populate('category', 'name slug type');

  res.status(200).json({ success: true, data: similar });
});

// @desc    Create a new vehicle listing
// @route   POST /api/vehicles
// @access  Private (seller/admin)
const createVehicle = asyncHandler(async (req, res) => {
  // Uploaded images come from multer as req.files
  const images = (req.files || []).map((file, index) => ({
    url: `/uploads/vehicles/${file.filename}`,
    isPrimary: index === 0,
  }));

  const vehicle = await Vehicle.create({
    ...req.body,
    seller: req.user._id,
    images,
    // Admins can auto-approve their own listings; regular sellers go to "pending"
    status: req.user.role === 'admin' ? 'approved' : 'pending',
  });

  // Keep the brand's listing counter in sync
  await Brand.findByIdAndUpdate(vehicle.brand, { $inc: { listingsCount: 1 } });

  res.status(201).json({
    success: true,
    message: 'Vehicle listing created and is pending review',
    data: vehicle,
  });
});

// @desc    Update a vehicle listing
// @route   PUT /api/vehicles/:id
// @access  Private (owner/admin)
const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  const isOwner = vehicle.seller.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError('You are not authorized to update this listing', 403);
  }

  // If new images were uploaded, append them to the existing gallery
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => ({
      url: `/uploads/vehicles/${file.filename}`,
      isPrimary: false,
    }));
    req.body.images = [...vehicle.images, ...newImages];
  }

  // Non-admins editing their own listing should go back to "pending" review
  if (!req.body.status && req.user.role !== 'admin') {
    req.body.status = 'pending';
  }

  const updated = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, message: 'Vehicle updated', data: updated });
});

// @desc    Delete a vehicle listing
// @route   DELETE /api/vehicles/:id
// @access  Private (owner/admin)
const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  const isOwner = vehicle.seller.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError('You are not authorized to delete this listing', 403);
  }

  await vehicle.deleteOne();
  await Brand.findByIdAndUpdate(vehicle.brand, { $inc: { listingsCount: -1 } });

  res.status(200).json({ success: true, message: 'Vehicle deleted successfully' });
});

// @desc    Approve or reject a pending listing
// @route   PUT /api/vehicles/:id/status
// @access  Private (admin only)
const updateVehicleStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['pending', 'approved', 'rejected', 'sold'].includes(status)) {
    throw new ApiError('Invalid status value', 400);
  }

  const vehicle = await Vehicle.findByIdAndUpdate(
    req.params.id,
    { status, rejectionReason: status === 'rejected' ? rejectionReason || '' : '' },
    { new: true }
  );

  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  res.status(200).json({ success: true, message: `Listing marked as ${status}`, data: vehicle });
});

// @desc    Get listings belonging to the logged-in user
// @route   GET /api/vehicles/my-listings
// @access  Private
const getMyListings = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ seller: req.user._id })
    .sort('-createdAt')
    .populate('brand', 'name slug')
    .populate('category', 'name slug type');

  res.status(200).json({ success: true, count: vehicles.length, data: vehicles });
});

module.exports = {
  getVehicles,
  getVehicleById,
  getSimilarVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  getMyListings,
};
