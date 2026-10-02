const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const svc = require('../carsService');
const cache = require('../cache');
const { receiveImages, uploadGate } = require('../upload');
const { parseCar, ValidationError } = require('../validate');
const mail = require('../mail');

// A user can save/edit at most this many cars per hour (stops scripts from filling the disk)
const uploadLimiter = rateLimit({
  windowMs: 3600e3,
  limit: (req) => (req.user && req.user.role === 'admin' ? 500 : 80),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u${req.user.id}`,
  message: { error: 'RATE_LIMIT' },
});

/**
 * Create / edit / delete cars.
 *  - admin: false -> dealer's own cars. New and edited cars go back to "pending" for the owner to review.
 *  - admin: true  -> the owner (admin) manages any car; his own cars are published immediately.
 */
function makeRouter({ admin }) {
  const router = express.Router();

  const loadCar = (req, res) => {
    const row = svc.getCarRow(Number(req.params.id));
    if (!row || (!admin && row.owner_id !== req.user.id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return null;
    }
    return row;
  };

  // Every dealer listing needs its own contact number; the owner (admin) may leave it empty (falls back to the showroom number)
  const needWhatsapp = (req, data) => {
    if (!admin && req.user.role !== 'admin' && !data.whatsapp) throw new ValidationError('INVALID_WHATSAPP', 'whatsapp');
  };

  const notifyAdmin = (carId) => {
    const row = svc.getCarRow(carId);
    if (row && row.owner_role !== 'admin') mail.newCarForReview(row, { name: row.owner_name, business: row.owner_business, email: row.owner_email });
  };

  if (!admin) {
    router.get('/', (req, res) => {
      const out = svc.listCars({ where: ['c.owner_id = ?'], params: [req.user.id], pageSize: 48, view: { owner: true } });
      res.json(out);
    });
  }

  // order matters: limits first, then the (memory-hungry) upload parsing, then the image processing
  router.post('/', uploadLimiter, uploadGate, receiveImages, async (req, res) => {
    const data = parseCar(req.body || {});
    needWhatsapp(req, data);
    const status = req.user.role === 'admin' ? 'published' : 'pending';
    const id = await svc.createCar(req.user.id, data, req.files || [], status);
    if (status === 'pending') notifyAdmin(id);
    res.status(201).json({ id, status });
  });

  router.put('/:id', uploadLimiter, uploadGate, receiveImages, async (req, res) => {
    const row = loadCar(req, res);
    if (!row) return;
    const data = parseCar(req.body || {});
    needWhatsapp(req, data);
    const keepIds = svc.parseKeep(req.body && req.body.keep);
    const resubmit = row.owner_role !== 'admin' && !admin ? 'pending' : undefined;
    await svc.updateCar(row, data, { keepIds, files: req.files || [], status: resubmit });
    if (resubmit) notifyAdmin(row.id);
    res.json({ ok: true, status: resubmit || row.status });
  });

  router.delete('/:id', (req, res) => {
    const row = loadCar(req, res);
    if (!row) return;
    svc.deleteCar(row.id);
    res.json({ ok: true });
  });

  if (!admin) {
    router.post('/:id/sold', (req, res) => {
      const row = loadCar(req, res);
      if (!row) return;
      if (row.status !== 'published') return res.status(409).json({ error: 'BAD_STATE' });
      db.prepare("UPDATE cars SET status='sold', updated_at=datetime('now') WHERE id=?").run(row.id);
      cache.clear();
      res.json({ ok: true });
    });
  }

  return router;
}

module.exports = makeRouter;
