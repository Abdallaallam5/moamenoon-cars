const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const svc = require('../carsService');
const { microcache } = require('../cache');

const router = express.Router();
router.use(microcache); // anonymous visitors are served from memory for a few seconds

/* ---------- public catalogue ---------- */
router.get('/', (req, res) => {
  const { where, params } = svc.publicFilters(req.query);
  res.json(svc.listCars({ where, params, soldLast: true, ...svc.pageArgs(req.query) }));
});

router.get('/meta', (req, res) => {
  const brands = db
    .prepare("SELECT DISTINCT brand FROM cars WHERE status IN ('published','sold') ORDER BY brand COLLATE NOCASE")
    .all()
    .map((r) => r.brand);
  const counts = {};
  for (const r of db.prepare("SELECT category, COUNT(*) AS n FROM cars WHERE status IN ('published','sold') GROUP BY category").all()) counts[r.category] = r.n;
  res.json({ brands, counts });
});

router.get('/:id', (req, res) => {
  const row = svc.getCarRow(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
  const isOwner = req.user && req.user.id === row.owner_id;
  const isAdmin = req.user && req.user.role === 'admin';
  const publicly = row.status === 'published' || row.status === 'sold';
  if (!publicly && !isOwner && !isAdmin) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ car: svc.getDetail(row, { owner: isOwner, admin: isAdmin }) });
});

/* ---------- favourites (any signed-in user) ---------- */
const fav = express.Router();
fav.use(requireAuth);

fav.get('/ids', (req, res) => {
  res.json({ ids: db.prepare('SELECT car_id FROM favorites WHERE user_id = ?').all(req.user.id).map((r) => r.car_id) });
});

fav.get('/', (req, res) => {
  const { where, params } = svc.publicFilters({});
  where.push('c.id IN (SELECT car_id FROM favorites WHERE user_id = ?)');
  params.push(req.user.id);
  res.json(svc.listCars({ where, params, pageSize: 48, page: 1 }));
});

fav.post('/:id', (req, res) => {
  const row = svc.getCarRow(Number(req.params.id));
  if (!row || !['published', 'sold'].includes(row.status)) return res.status(404).json({ error: 'NOT_FOUND' });
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, car_id) VALUES (?, ?)').run(req.user.id, row.id);
  res.json({ ok: true });
});

fav.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND car_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

module.exports = { cars: router, favorites: fav };
