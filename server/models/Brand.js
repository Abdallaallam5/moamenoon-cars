/**
 * models/Brand.js
 * -----------------------------------------------------------------------
 * Vehicle manufacturers/brands (Mercedes-Benz, BMW, Toyota, Yamaha, etc.)
 * Used for filtering and the "Popular Brands" home page section.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const slugify = require('slugify');

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    logo: {
      type: String, // path to brand logo image
      default: '',
    },
    types: [
      {
        // Which vehicle types this brand manufactures (a brand can span multiple)
        type: String,
        enum: ['car', 'motorcycle', 'truck'],
      },
    ],
    isPopular: {
      type: Boolean,
      default: false, // shown in "Popular Brands" section
    },
    listingsCount: {
      type: Number,
      default: 0, // denormalized counter, kept in sync via Vehicle hooks
    },
  },
  { timestamps: true }
);

brandSchema.pre('validate', function generateSlug(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

brandSchema.index({ isPopular: 1 });

module.exports = mongoose.model('Brand', brandSchema);
