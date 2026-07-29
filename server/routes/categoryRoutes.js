/**
 * routes/categoryRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { upload, setUploadFolder } = require('../middlewares/uploadMiddleware');

router.get('/', getCategories);
router.get('/:id', getCategoryById);

router.post('/', protect, restrictTo('admin'), setUploadFolder('categories'), upload.single('image'), createCategory);
router.put('/:id', protect, restrictTo('admin'), setUploadFolder('categories'), upload.single('image'), updateCategory);
router.delete('/:id', protect, restrictTo('admin'), deleteCategory);

module.exports = router;
