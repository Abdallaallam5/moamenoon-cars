const crypto = require('crypto');
const { promisify } = require('util');
const { db } = require('./db');
const { SECRET, IS_PROD } = require('./config');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'sid';
const TTL_MS = 14 * 24 * 3600 * 1000;

/* ---------- passwords ---------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [v, s, k] = String(stored).split('$');
  if (v !== 's1' || !s || !k) return false;
  const key = await scrypt(password, Buffer.from(s, 'base64'), 64);
  const expected = Buffer.from(k, 'base64');
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

/* ---------- signed session cookie ---------- */
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function makeToken(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return o.e > Date.now() ? o.u : null;
  } catch (_) {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) {
        try {
          out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
        } catch (_) {
          /* ignore malformed cookie */
        }
      }
    });
  return out;
}

function setSession(res, userId) {
  res.cookie(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: TTL_MS,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' });
}

/* ---------- middleware ---------- */
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');

function attachUser(req, res, next) {
  req.user = null;
  const id = readToken(parseCookies(req.headers.cookie)[COOKIE]);
  if (id) {
    const u = getUser.get(id);
    if (u && u.status !== 'suspended') req.user = u;
  }
  next();
}

/** Blocks cross-site state-changing requests (defence in depth on top of SameSite=Lax). */
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === req.get('host');
    } catch (_) {
      ok = false;
    }
    if (!ok) return res.status(403).json({ error: 'FORBIDDEN' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' });
  next();
}

/** Approved dealers (and the admin) may upload cars. */
function requireSeller(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (u.role === 'admin' || (u.role === 'dealer' && u.status === 'active')) return next();
  return res.status(403).json({ error: u.role === 'dealer' ? 'DEALER_NOT_APPROVED' : 'FORBIDDEN' });
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, business: u.business, role: u.role, status: u.status, lang: u.lang, reason: u.reason };
}

module.exports = {
  hashPassword,
  verifyPassword,
  setSession,
  clearSession,
  attachUser,
  sameOrigin,
  requireAuth,
  requireAdmin,
  requireSeller,
  publicUser,
};
