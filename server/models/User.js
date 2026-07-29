/**
 * models/User.js
 * -----------------------------------------------------------------------
 * Represents both regular users (buyers/sellers) and admins.
 * Passwords are hashed with bcrypt before saving (never stored in plain text).
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries by default
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+0-9\s-]{7,20}$/, 'Please provide a valid phone number'],
    },
    avatar: {
      type: String,
      default: '', // path to uploaded avatar image
    },
    role: {
      type: String,
      enum: ['user', 'seller', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true, // allows admins to soft-disable accounts
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ar'],
      default: 'en',
    },
    location: {
      city: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  { timestamps: true }
);

// Hash the password before saving, only if it was modified
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Keep passwordChangedAt in sync (used to invalidate old JWTs after a reset)
userSchema.pre('save', function setPasswordChangedAt(next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method: compare a plain password against the hashed one
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: check if password was changed after a given JWT was issued
userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtTimestamp) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
  return jwtTimestamp < changedTimestamp;
};

// Never expose sensitive fields when converting to JSON
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
