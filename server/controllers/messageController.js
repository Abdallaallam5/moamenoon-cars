/**
 * controllers/messageController.js
 * -----------------------------------------------------------------------
 * Handles buyer -> seller inquiries about vehicle listings.
 * -----------------------------------------------------------------------
 */

const Message = require('../models/Message');
const Vehicle = require('../models/Vehicle');
const { ApiError, asyncHandler } = require('../middlewares/errorMiddleware');

// @desc    Send an inquiry message about a vehicle
// @route   POST /api/messages
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
  const { vehicleId, content, name, email, phone } = req.body;

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new ApiError('Vehicle not found', 404);

  if (vehicle.seller.toString() === req.user._id.toString()) {
    throw new ApiError('You cannot send an inquiry about your own listing', 400);
  }

  const message = await Message.create({
    vehicle: vehicleId,
    sender: req.user._id,
    receiver: vehicle.seller,
    content,
    name: name || req.user.name,
    email: email || req.user.email,
    phone: phone || req.user.phone,
  });

  res.status(201).json({ success: true, message: 'Message sent to seller', data: message });
});

// @desc    Get messages received by the current user (as a seller)
// @route   GET /api/messages/inbox
// @access  Private
const getInbox = asyncHandler(async (req, res) => {
  const messages = await Message.find({ receiver: req.user._id })
    .sort('-createdAt')
    .populate('vehicle', 'title images price')
    .populate('sender', 'name avatar');

  res.status(200).json({ success: true, count: messages.length, data: messages });
});

// @desc    Get messages sent by the current user (as a buyer)
// @route   GET /api/messages/sent
// @access  Private
const getSentMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find({ sender: req.user._id })
    .sort('-createdAt')
    .populate('vehicle', 'title images price')
    .populate('receiver', 'name avatar');

  res.status(200).json({ success: true, count: messages.length, data: messages });
});

// @desc    Mark a message as read
// @route   PUT /api/messages/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ _id: req.params.id, receiver: req.user._id });
  if (!message) throw new ApiError('Message not found', 404);

  message.isRead = true;
  await message.save();

  res.status(200).json({ success: true, message: 'Message marked as read', data: message });
});

// @desc    Get every message in the system (moderation view)
// @route   GET /api/messages/admin/all
// @access  Private (admin)
const getAllMessagesAdmin = asyncHandler(async (req, res) => {
  const messages = await Message.find()
    .sort('-createdAt')
    .populate('vehicle', 'title images price')
    .populate('sender', 'name email avatar')
    .populate('receiver', 'name email avatar');

  res.status(200).json({ success: true, count: messages.length, data: messages });
});

// @desc    Delete any message
// @route   DELETE /api/messages/:id
// @access  Private (admin or the message's own sender/receiver)
const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw new ApiError('Message not found', 404);

  const isParticipant =
    message.sender.toString() === req.user._id.toString() ||
    message.receiver.toString() === req.user._id.toString();
  if (!isParticipant && req.user.role !== 'admin') {
    throw new ApiError('You are not authorized to delete this message', 403);
  }

  await message.deleteOne();
  res.status(200).json({ success: true, message: 'Message deleted successfully' });
});

module.exports = {
  sendMessage,
  getInbox,
  getSentMessages,
  markAsRead,
  getAllMessagesAdmin,
  deleteMessage,
};
