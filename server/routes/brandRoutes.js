/**
 * routes/brandRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const { getBrands, getBrandById, createBrand, updateBrand, deleteBrand } = require('../controllers/brandController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const { upload, setUploadFolder } = require('../middlewares/uploadMiddleware');

router.get('/', getBrands);
router.get('/:id', getBrandById);

router.post('/', protect, restrictTo('admin'), setUploadFolder('brands'), upload.single('logo'), createBrand);
router.put('/:id', protect, restrictTo('admin'), setUploadFolder('brands'), upload.single('logo'), updateBrand);
router.delete('/:id', protect, restrictTo('admin'), deleteBrand);

module.exports = router;
