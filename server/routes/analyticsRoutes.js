/**
 * routes/analyticsRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const { getAnalyticsOverview } = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// Every route below is admin-only
router.use(protect, restrictTo('admin'));

router.get('/overview', getAnalyticsOverview);

module.exports = router;
