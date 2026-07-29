/**
 * config/env.js
 * -----------------------------------------------------------------------
 * Loads and validates environment variables from the .env file.
 * Exporting them from a single module means every other file in the app
 * imports config from ONE place instead of calling process.env directly.
 * -----------------------------------------------------------------------
 */

const dotenv = require('dotenv');
const path = require('path');

// Load the .env file located at the project root (server/.env).
// A .env file is entirely OPTIONAL for local development — if it's
// missing, sensible defaults below let the app run out of the box with
// zero configuration (using a local embedded MongoDB, see config/db.js).
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// In production you MUST provide a real secret via the environment.
if (isProduction && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is required in production. Set it in your environment and restart.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.warn(
    '⚠️  No JWT_SECRET set — using an insecure default for local development only. ' +
      'Create a server/.env file with your own JWT_SECRET before deploying anywhere real.'
  );
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5000',

  // Optional: if unset, config/db.js automatically starts a local embedded
  // MongoDB instance — no Atlas account, install, or password needed.
  mongoUri: process.env.MONGO_URI || '',

  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  jwtCookieExpiresIn: Number(process.env.JWT_COOKIE_EXPIRES_IN) || 30,

  maxFileUploadMb: Number(process.env.MAX_FILE_UPLOAD_MB) || 5,
  uploadPath: process.env.UPLOAD_PATH || './uploads',

  // Used only by the seeder script to bootstrap the first admin account.
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',

  rateLimit: {
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15,
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  },

  isProduction,
};
