const express = require('express');
const { db } = require('../db');
const { requireAdmin, publicUser } = require('../auth');
const svc = require('../carsService');
const cache = require('../cache');
const mail = require('../mail');
const makeSellerRouter = require('./sellerCars');

const router = express.Router();
router.use(requireAdmin);

const reasonOf = (req) => (typeof (req.body || {}).reason === 'string' ? req.body.reason.trim().slice(0, 500) : '') || null;
const owner = (row) => ({ name: row.owner_name, business: row.owner_business, email: row.owner_email, lang: (db.prepare('SELECT lang FROM users WHERE id=?').get(row.owner_id) || {}).lang || 'ar' });

/* ---------- overview ---------- */
router.get('/stats', (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    pendingDealers: n("SELECT COUNT(*) n FROM users WHERE role='dealer' AND status='pending'"),
    pendingCars: n("SELECT COUNT(*) n FROM cars WHERE status='pending'"),
    publishedCars: n("SELECT COUNT(*) n FROM cars WHERE status='published'"),
    totalCars: n('SELECT COUNT(*) n FROM cars'),
    dealers: n("SELECT COUNT(*) n FROM users WHERE role='dealer' AND status='active'"),
    users: n("SELECT COUNT(*) n FROM users WHERE role='user'"),
  });
});

/* ---------- users / dealers ---------- */
router.get('/users', (req, res) => {
  const where = ["role != 'admin'"];
  const params = [];
  if (['user', 'dealer'].includes(req.query.role)) { where.push('role = ?'); params.push(req.query.role); }
  if (['active', 'pending', 'rejected', 'suspended'].includes(req.query.status)) { where.push('status = ?'); params.push(req.query.status); }
  const users = db
    .prepare(`SELECT u.*, (SELECT COUNT(*) FROM cars c WHERE c.owner_id = u.id) AS cars FROM users u WHERE ${where.join(' AND ')} ORDER BY u.created_at DESC LIMIT 300`)
    .all(...params)
    .map((u) => ({ ...publicUser(u), created_at: u.created_at, cars: u.cars }));
  res.json({ users });
});

function userAction(fn) {
  return (req, res) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ? AND role != 'admin'").get(Number(req.params.id));
    if (!u) return res.status(404).json({ error: 'NOT_FOUND' });
    const out = fn(u, req);
    if (out === false) return res.status(409).json({ error: 'BAD_STATE' });
    res.json({ ok: true });
  };
}

router.post('/users/:id/approve', userAction((u) => {
  if (u.role !== 'dealer') return false;
  db.prepare("UPDATE users SET status='active', reason=NULL, decided_at=datetime('now') WHERE id=?").run(u.id);
  mail.dealerApproved(u);
}));

router.post('/users/:id/reject', userAction((u, req) => {
  if (u.role !== 'dealer') return false;
  const reason = reasonOf(req);
  db.prepare("UPDATE users SET status='rejected', reason=?, decided_at=datetime('now') WHERE id=?").run(reason, u.id);
  mail.dealerRejected(u, reason);
}));

// Only active (already approved) accounts can be suspended, so a suspended account is always safe to reactivate.
router.post('/users/:id/suspend', userAction((u) => {
  if (u.status !== 'active') return false;
  db.prepare("UPDATE users SET status='suspended', decided_at=datetime('now') WHERE id=?").run(u.id);
}));

router.post('/users/:id/reactivate', userAction((u) => {
  if (u.status !== 'suspended') return false;
  db.prepare("UPDATE users SET status='active', decided_at=datetime('now') WHERE id=?").run(u.id);
}));

router.delete('/users/:id', userAction((u) => {
  svc.deleteCarsOf(u.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
}));

/* ---------- cars ---------- */
router.get('/cars', (req, res) => {
  const where = [];
  const params = [];
  if (['pending', 'published', 'rejected', 'sold', 'hidden'].includes(req.query.status)) { where.push('c.status = ?'); params.push(req.query.status); }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    where.push("(c.brand || ' ' || c.model) LIKE ? ESCAPE '\\'");
    params.push(`%${req.query.q.trim().slice(0, 80).replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  const args = svc.pageArgs(req.query);
  res.json(svc.listCars({ where, params, ...args, pageSize: Math.min(args.pageSize, 48), view: { admin: true } }));
});

function carAction(fn) {
  return (req, res) => {
    const row = svc.getCarRow(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    fn(row, req);
    cache.clear(); // approve / reject / hide / feature change what the public list shows
    res.json({ ok: true });
  };
}

router.post('/cars/:id/approve', carAction((row) => {
  db.prepare("UPDATE cars SET status='published', reject_reason=NULL, published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=?").run(row.id);
  if (row.owner_role !== 'admin') mail.carApproved(row, owner(row));
}));

router.post('/cars/:id/reject', carAction((row, req) => {
  const reason = reasonOf(req);
  db.prepare("UPDATE cars SET status='rejected', reject_reason=?, updated_at=datetime('now') WHERE id=?").run(reason, row.id);
  if (row.owner_role !== 'admin') mail.carRejected(row, owner(row), reason);
}));

router.post('/cars/:id/status', carAction((row, req) => {
  const s = (req.body || {}).status;
  if (!['published', 'hidden', 'sold'].includes(s)) return;
  db.prepare("UPDATE cars SET status=?, published_at=COALESCE(published_at, datetime('now')), updated_at=datetime('now') WHERE id=?").run(s, row.id);
}));

router.post('/cars/:id/feature', carAction((row, req) => {
  db.prepare('UPDATE cars SET featured=? WHERE id=?').run((req.body || {}).featured ? 1 : 0, row.id);
}));

// create / edit / delete (multipart) - shared with the dealer router
router.use('/cars', makeSellerRouter({ admin: true }));

module.exports = router;
