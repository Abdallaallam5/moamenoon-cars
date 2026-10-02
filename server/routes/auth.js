const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { hashPassword, verifyPassword, setSession, clearSession, publicUser } = require('../auth');
const { parseSignup, parseEmail, ValidationError } = require('../validate');
const mail = require('../mail');

const router = express.Router();
const limiter = (limit, windowMs, extra = {}) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'RATE_LIMIT' }, ...extra });

// Used to keep login timing similar whether or not the email exists
const DUMMY_HASH = 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post('/signup', limiter(20, 3600e3), async (req, res) => {
  const d = parseSignup(req.body || {});
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email)) throw Object.assign(new ValidationError('EMAIL_TAKEN', 'email'), { status: 409 });

  const isDealer = d.type === 'dealer';
  const hash = await hashPassword(d.password);
  const r = db
    .prepare('INSERT INTO users (email,name,phone,business,pass_hash,role,status,lang) VALUES (?,?,?,?,?,?,?,?)')
    .run(d.email, d.name, d.phone, d.business, hash, d.type, isDealer ? 'pending' : 'active', d.lang);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);

  setSession(res, user.id);
  if (isDealer) {
    mail.newDealerRequest(user);
    mail.dealerReceived(user);
  }
  res.status(201).json({ user: publicUser(user) });
});

// only failed logins count towards the limit
router.post('/login', limiter(15, 900e3, { skipSuccessfulRequests: true }), async (req, res) => {
  const email = parseEmail((req.body || {}).email);
  const password = String((req.body || {}).password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = await verifyPassword(password, user ? user.pass_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'BAD_LOGIN' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'ACCOUNT_SUSPENDED' });
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

module.exports = router;
