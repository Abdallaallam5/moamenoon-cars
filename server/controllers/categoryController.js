/**
 * controllers/categoryController.js
 * -----------------------------------------------------------------------
 */

const Category = require('../models/Category');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Get all categories (optionally filter by type or featured flag)
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.featured === 'true') filter.isFeatured = true;

  const categories = await Category.find(filter).sort('order');
  res.status(200).json({ success: true, count: categories.length, data: categories });
});

// @desc    Get a single category
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError('Category not found', 404);
  res.status(200).json({ success: true, data: category });
});

// @desc    Create a category
// @route   POST /api/categories
// @access  Private (admin)
const createCategory = asyncHandler(async (req, res) => {
  const image = req.file ? `/uploads/categories/${req.file.filename}` : '';
  const category = await Category.create({ ...req.body, image });
  res.status(201).json({ success: true, message: 'Category created', data: category });
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private (admin)
const updateCategory = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (req.file) updates.image = `/uploads/categories/${req.file.filename}`;

  const category = await Category.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError('Category not found', 404);

  res.status(200).json({ success: true, message: 'Category updated', data: category });
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private (admin)
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new ApiError('Category not found', 404);
  res.status(200).json({ success: true, message: 'Category deleted successfully' });
});

module.exports = { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
