/**
 * controllers/analyticsController.js
 * -----------------------------------------------------------------------
 * Aggregated statistics for the admin dashboard's Analytics panel:
 * trends over time, breakdowns by status/type/brand/city, price stats,
 * top listings, and a merged recent-activity feed.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Message = require('../models/Message');
const Review = require('../models/Review');
const Brand = require('../models/Brand');
const Category = require('../models/Category');
const { asyncHandler } = require('../middlewares/errorMiddleware');

// Builds an array of { year, month } for the last `months` months (oldest first)
const lastMonths = (months) => {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return result;
};

// Merges a sparse Mongo $group-by-month result into a dense, ordered series
const fillMonthlySeries = (raw, months = 12) => {
  const frame = lastMonths(months);
  const map = new Map(raw.map((r) => [`${r._id.year}-${r._id.month}`, r.count]));
  return frame.map(({ year, month }) => ({
    label: `${year}-${String(month).padStart(2, '0')}`,
    count: map.get(`${year}-${month}`) || 0,
  }));
};

// @desc    Full analytics payload for the admin dashboard
// @route   GET /api/analytics/overview
// @access  Private (admin)
const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const monthsBack = 12;
  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [
    totals,
    vehiclesByStatus,
    vehiclesByTypeRaw,
    topBrands,
    topCities,
    listingsTrendRaw,
    usersTrendRaw,
    priceStatsRaw,
    viewsAgg,
    mostViewed,
    recentVehicles,
    recentUsers,
    recentMessages,
  ] = await Promise.all([
    Promise.all([
      User.countDocuments(),
      Vehicle.countDocuments(),
      Brand.countDocuments(),
      Category.countDocuments(),
      Message.countDocuments(),
      Review.countDocuments(),
    ]),

    Vehicle.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),

    Vehicle.aggregate([
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'cat' } },
      { $unwind: '$cat' },
      { $group: { _id: '$cat.type', count: { $sum: 1 } } },
    ]),

    Vehicle.aggregate([
      { $group: { _id: '$brand', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
      { $unwind: '$brand' },
      { $project: { _id: 0, name: '$brand.name', count: 1 } },
    ]),

    Vehicle.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $project: { _id: 0, city: '$_id', count: 1 } },
    ]),

    Vehicle.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),

    User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),

    Vehicle.aggregate([
      { $match: { status: 'approved' } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'cat' } },
      { $unwind: '$cat' },
      {
        $group: {
          _id: '$cat.type',
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
    ]),

    Vehicle.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }]),

    Vehicle.find().sort('-views').limit(5).select('title views price currency').populate('brand', 'name'),

    Vehicle.find().sort('-createdAt').limit(5).select('title status price currency createdAt').populate('brand', 'name'),

    User.find().sort('-createdAt').limit(5).select('name email role createdAt'),

    Message.find().sort('-createdAt').limit(5).populate('vehicle', 'title').populate('sender', 'name'),
  ]);

  const [totalUsers, totalVehicles, totalBrands, totalCategories, totalMessages, totalReviews] = totals;

  res.status(200).json({
    success: true,
    data: {
      totals: { totalUsers, totalVehicles, totalBrands, totalCategories, totalMessages, totalReviews },
      vehiclesByStatus: vehiclesByStatus.map((s) => ({ status: s._id, count: s.count })),
      vehiclesByType: vehiclesByTypeRaw.map((t) => ({ type: t._id, count: t.count })),
      topBrands,
      topCities,
      listingsTrend: fillMonthlySeries(listingsTrendRaw, monthsBack),
      usersTrend: fillMonthlySeries(usersTrendRaw, monthsBack),
      priceStats: priceStatsRaw.map((p) => ({
        type: p._id,
        avgPrice: Math.round(p.avgPrice || 0),
        minPrice: p.minPrice || 0,
        maxPrice: p.maxPrice || 0,
      })),
      totalViews: (viewsAgg[0] && viewsAgg[0].totalViews) || 0,
      mostViewed,
      recentActivity: {
        vehicles: recentVehicles,
        users: recentUsers,
        messages: recentMessages,
      },
    },
  });
});

module.exports = { getAnalyticsOverview };
