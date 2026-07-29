/**
 * models/Message.js
 * -----------------------------------------------------------------------
 * Represents an inquiry a buyer sends to a seller about a specific
 * vehicle listing (e.g. via the vehicle details page contact form).
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle reference is required'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver (seller) is required'],
    },
    name: {
      type: String,
      trim: true, // fallback for guest inquiries without an account
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ vehicle: 1 });

module.exports = mongoose.model('Message', messageSchema);
