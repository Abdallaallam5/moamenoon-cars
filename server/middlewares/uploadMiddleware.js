/**
 * middlewares/uploadMiddleware.js
 * -----------------------------------------------------------------------
 * Multer configuration for handling image uploads (vehicle photos,
 * user avatars, brand/category images). Stores files on disk under
 * /uploads/<subfolder>/ with a unique filename.
 * -----------------------------------------------------------------------
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const { ApiError } = require('./errorMiddleware');

// Ensure a destination folder exists (creates it recursively if missing)
const ensureFolder = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Route-specific subfolder, e.g. 'vehicles', 'avatars', 'brands'
    const subfolder = req.uploadSubfolder || 'misc';
    const destPath = path.join(env.uploadPath, subfolder);
    ensureFolder(destPath);
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Only allow common image formats
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValidExt = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const isValidMime = allowedTypes.test(file.mimetype);

  if (isValidExt && isValidMime) {
    return cb(null, true);
  }
  cb(new ApiError('Only image files (jpg, jpeg, png, webp) are allowed', 400));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxFileUploadMb * 1024 * 1024 },
});

/**
 * Middleware factory that tags the request with which subfolder to use,
 * so the same `upload` instance can serve multiple resource types.
 * Usage: router.post('/', setUploadFolder('vehicles'), upload.array('images', 10), controller)
 */
const setUploadFolder = (folderName) => (req, res, next) => {
  req.uploadSubfolder = folderName;
  next();
};

module.exports = { upload, setUploadFolder };
