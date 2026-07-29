/**
 * routes/favoriteRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const { getMyFavorites, addFavorite, removeFavorite } = require('../controllers/favoriteController');
const { protect } = require('../middlewares/authMiddleware');

// All favorite routes require an authenticated user
router.use(protect);

router.get('/', getMyFavorites);
router.post('/:vehicleId', addFavorite);
router.delete('/:vehicleId', removeFavorite);

module.exports = router;
