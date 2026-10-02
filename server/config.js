const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch (_) {
  /* .env is optional */
}

const env = process.env;
const DATA_DIR = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadSecret() {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 24) return env.SESSION_SECRET;
  const file = path.join(DATA_DIR, 'session.secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (_) {
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

const PORT = Number(env.PORT) || 3000;
const ADMIN_EMAIL = (env.ADMIN_EMAIL || 'moamnoon.co@gmail.com').trim().toLowerCase();

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  PORT,
  IS_PROD: env.NODE_ENV === 'production',
  SECRET: loadSecret(),
  ADMIN_EMAIL,
  ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',
  SITE_URL: (env.SITE_URL || `http://localhost:${PORT}`).replace(/\/+$/, ''),
  BRAND: 'مؤمنون للسيارات',
  SMTP: {
    user: (env.SMTP_USER || ADMIN_EMAIL).trim(),
    pass: (env.SMTP_PASS || '').replace(/\s+/g, ''), // Gmail app passwords are shown with spaces
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 465,
  },
};
