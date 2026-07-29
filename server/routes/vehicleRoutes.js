/**
 * routes/vehicleRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const {
  getVehicles,
  getVehicleById,
  getSimilarVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  getMyListings,
} = require('../controllers/vehicleController');

const { protect, restrictTo, optionalAuth } = require('../middlewares/authMiddleware');
const { upload, setUploadFolder } = require('../middlewares/uploadMiddleware');
const { vehicleValidator } = require('../validators/vehicleValidator');
const validateRequest = require('../utils/validateRequest');

// IMPORTANT: specific routes ("my-listings") must come before "/:id"
router.get('/my-listings', protect, getMyListings);

router.get('/', optionalAuth, getVehicles);
router.get('/:id', optionalAuth, getVehicleById);
router.get('/:id/similar', getSimilarVehicles);

router.post(
  '/',
  protect,
  restrictTo('seller', 'admin'),
  setUploadFolder('vehicles'),
  upload.array('images', 10),
  vehicleValidator,
  validateRequest,
  createVehicle
);

router.put('/:id', protect, setUploadFolder('vehicles'), upload.array('images', 10), updateVehicle);
router.put('/:id/status', protect, restrictTo('admin'), updateVehicleStatus);
router.delete('/:id', protect, deleteVehicle);

module.exports = router;
