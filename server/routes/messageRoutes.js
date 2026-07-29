/**
 * routes/messageRoutes.js
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getInbox,
  getSentMessages,
  markAsRead,
  getAllMessagesAdmin,
  deleteMessage,
} = require('../controllers/messageController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

router.use(protect);

// IMPORTANT: specific route ("admin/all") must come before "/:id" routes
router.get('/admin/all', restrictTo('admin'), getAllMessagesAdmin);

router.post('/', sendMessage);
router.get('/inbox', getInbox);
router.get('/sent', getSentMessages);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteMessage);

module.exports = router;
