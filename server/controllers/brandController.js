/**
 * controllers/brandController.js
 * -----------------------------------------------------------------------
 */

const Brand = require('../models/Brand');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Get all brands (optionally filter by vehicle type or popularity)
// @route   GET /api/brands
// @access  Public
const getBrands = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.types = req.query.type;
  if (req.query.popular === 'true') filter.isPopular = true;

  const brands = await Brand.find(filter).sort('name');
  res.status(200).json({ success: true, count: brands.length, data: brands });
});

// @desc    Get a single brand
// @route   GET /api/brands/:id
// @access  Public
const getBrandById = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw new ApiError('Brand not found', 404);
  res.status(200).json({ success: true, data: brand });
});

// @desc    Create a brand
// @route   POST /api/brands
// @access  Private (admin)
const createBrand = asyncHandler(async (req, res) => {
  const logo = req.file ? `/uploads/brands/${req.file.filename}` : '';
  const brand = await Brand.create({ ...req.body, logo });
  res.status(201).json({ success: true, message: 'Brand created', data: brand });
});

// @desc    Update a brand
// @route   PUT /api/brands/:id
// @access  Private (admin)
const updateBrand = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (req.file) updates.logo = `/uploads/brands/${req.file.filename}`;

  const brand = await Brand.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!brand) throw new ApiError('Brand not found', 404);

  res.status(200).json({ success: true, message: 'Brand updated', data: brand });
});

// @desc    Delete a brand
// @route   DELETE /api/brands/:id
// @access  Private (admin)
const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findByIdAndDelete(req.params.id);
  if (!brand) throw new ApiError('Brand not found', 404);
  res.status(200).json({ success: true, message: 'Brand deleted successfully' });
});

module.exports = { getBrands, getBrandById, createBrand, updateBrand, deleteBrand };
