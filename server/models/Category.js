/**
 * models/Category.js
 * -----------------------------------------------------------------------
 * Vehicle categories, e.g. top-level: "Cars", "Motorcycles", "Trucks",
 * and featured sub-categories like "Luxury Cars", "SUV", "Electric",
 * "Sports", "Pickup".
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: [true, 'English name is required'], trim: true },
      ar: { type: String, required: [true, 'Arabic name is required'], trim: true },
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    type: {
      // Top-level vehicle type this category belongs to
      type: String,
      enum: ['car', 'motorcycle', 'truck'],
      required: [true, 'Category type is required'],
    },
    icon: {
      type: String, // Font Awesome class, e.g. "fa-car-side"
      default: 'fa-car',
    },
    image: {
      type: String, // path to category thumbnail image
      default: '',
    },
    isFeatured: {
      type: Boolean,
      default: false, // shown in "Featured Categories" section on home page
    },
    order: {
      type: Number,
      default: 0, // controls display order
    },
  },
  { timestamps: true }
);

// Auto-generate a URL-friendly slug from the English name
categorySchema.pre('validate', function generateSlug(next) {
  if (this.isModified('name.en') || !this.slug) {
    this.slug = slugify(this.name.en, { lower: true, strict: true });
  }
  next();
});


categorySchema.index({ type: 1, isFeatured: 1 });

module.exports = mongoose.model('Category', categorySchema);
