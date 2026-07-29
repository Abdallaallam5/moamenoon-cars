/**
 * models/Vehicle.js
 * -----------------------------------------------------------------------
 * The core listing model: Cars, Motorcycles, and Trucks all use this
 * single schema, differentiated by the `category` reference (whose
 * `type` field is one of 'car' | 'motorcycle' | 'truck').
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },

    // ---------------- Classification ----------------
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand is required'],
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },

    // ---------------- Core specs ----------------
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1950, 'Year must be after 1950'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the far future'],
    },
    mileage: {
      type: Number,
      required: [true, 'Mileage is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    fuel: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid', 'lpg'],
      required: [true, 'Fuel type is required'],
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic', 'semi-automatic'],
      required: [true, 'Transmission is required'],
    },
    engine: {
      type: String, // e.g. "2.0L Turbo I4"
      trim: true,
    },
    horsepower: {
      type: Number,
      min: [0, 'Horsepower cannot be negative'],
    },
    color: {
      type: String,
      trim: true,
    },
    condition: {
      type: String,
      enum: ['new', 'used', 'certified-pre-owned'],
      required: [true, 'Condition is required'],
    },

    // ---------------- Pricing ----------------
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      enum: ['USD', 'EGP', 'EUR', 'SAR', 'AED'],
      default: 'USD',
    },
    negotiable: {
      type: Boolean,
      default: false,
    },

    // ---------------- Location ----------------
    location: {
      city: { type: String, required: [true, 'City is required'], trim: true },
      country: { type: String, required: [true, 'Country is required'], trim: true },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },

    // ---------------- Media ----------------
    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // ---------------- Relations ----------------
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required'],
    },

    // ---------------- Moderation / status ----------------
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'sold'],
      default: 'pending', // admin must approve before it appears publicly
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    isFeatured: {
      type: Boolean,
      default: false, // shown in "Featured Listings" section
    },

    // ---------------- Engagement metrics ----------------
    views: {
      type: Number,
      default: 0,
    },
    favoritesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ---------------- Indexes for fast search & filtering ----------------
vehicleSchema.index({ title: 'text', description: 'text', model: 'text' }); // keyword search
vehicleSchema.index({ category: 1, status: 1 });
vehicleSchema.index({ brand: 1 });
vehicleSchema.index({ price: 1 });
vehicleSchema.index({ year: 1 });
vehicleSchema.index({ 'location.city': 1, 'location.country': 1 });
vehicleSchema.index({ createdAt: -1 });
vehicleSchema.index({ isFeatured: 1, status: 1 });

// Virtual: convenient way to fetch reviews related to this vehicle's seller
vehicleSchema.virtual('primaryImage').get(function getPrimaryImage() {
  const primary = this.images?.find((img) => img.isPrimary);
  return primary ? primary.url : this.images?.[0]?.url || null;
});

vehicleSchema.set('toJSON', { virtuals: true });
vehicleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
