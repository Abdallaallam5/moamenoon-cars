const path = require('path');
const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const cfg = require('./server/config');
const { db } = require('./server/db');
const { attachUser, sameOrigin, requireAuth, requireSeller } = require('./server/auth');
const { seedAdmin } = require('./server/seed');
const authRoutes = require('./server/routes/auth');
const { cars: carsRoutes, favorites: favoriteRoutes } = require('./server/routes/cars');
const makeSellerRouter = require('./server/routes/sellerCars');
const adminRoutes = require('./server/routes/admin');

const app = express();
app.disable('x-powered-by');
// Behind nginx / Cloudflare / the host's proxy, the real visitor IP (rate limits) and https detection depend on this.
// TRUST_PROXY = number of proxies in front of the app (nginx only = 1, Cloudflare + nginx = 2).
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
else if (cfg.IS_PROD) app.set('trust proxy', 1);
app.use(compression());

app.use((req, res, next) => {
  if (cfg.IS_PROD && req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000'); // 180 days, https only
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
});

// Uploaded car photos (random file names, so they can be cached for a long time)
app.use(
  '/uploads',
  express.static(cfg.UPLOAD_DIR, {
    index: false,
    dotfiles: 'deny',
    immutable: true,
    maxAge: '30d',
    setHeaders: (res) => res.setHeader('Content-Security-Policy', "default-src 'none'"),
  })
);

/* ---------- API ---------- */
// health check first: it must stay cheap and never be rate limited (monitors and load balancers call it constantly)
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ ok: true });
});
// generous per-visitor cap on the whole API (about 10 requests/second) - blunts scrapers and floods without touching real users
app.use(
  '/api',
  rateLimit({ windowMs: 60e3, limit: Number(process.env.API_RATE_LIMIT) || 600, standardHeaders: true, legacyHeaders: false, message: { error: 'RATE_LIMIT' } })
);
app.use('/api', express.json({ limit: '50kb' }), sameOrigin, attachUser);
app.use('/api/auth', authRoutes);
app.use('/api/cars', carsRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/my/cars', requireAuth, requireSeller, makeSellerRouter({ admin: false }));
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

/* ---------- website ---------- */
app.use(
  express.static(cfg.PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      // pictures: a week. CSS/JS: 5 minutes (cheap, and a new version reaches everyone quickly). HTML: always re-checked.
      let cc = 'no-cache';
      if (/\.(jpe?g|png|webp|svg|ico)$/i.test(filePath)) cc = 'public, max-age=604800';
      else if (/\.(css|js)$/i.test(filePath)) cc = 'public, max-age=300';
      res.setHeader('Cache-Control', cc);
    },
  })
);
app.use((req, res) => res.status(404).sendFile(path.join(cfg.PUBLIC_DIR, 'index.html')));

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // validation / multer errors -> a code the UI can translate
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE', field: 'images' });
  if (err && (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')) return res.status(400).json({ error: 'TOO_MANY_IMAGES', field: 'images' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_REQUEST' });
  if (err && err.status && err.status < 500 && typeof err.code === 'string') return res.status(err.status).json({ error: err.code, field: err.field });
  console.error(err);
  res.status(500).json({ error: 'SERVER' });
});

/* ---------- start / stop ---------- */
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', e);
  process.exit(1); // the process manager (pm2 / systemd) restarts us cleanly
});

seedAdmin()
  .catch((e) => console.error('[admin] seed failed:', e))
  .finally(() => {
    const server = app.listen(cfg.PORT, () => console.log(`Moamenoon showroom running on ${cfg.SITE_URL} (port ${cfg.PORT})`));
    // keep-alive slightly above typical proxy timeouts, so nginx/Cloudflare never reuse a connection we just closed
    server.keepAliveTimeout = 65e3;
    server.headersTimeout = 66e3;

    // finish in-flight requests and flush the database before exiting (deploys / restarts)
    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down...`);
      server.close(() => {
        try {
          db.close();
        } catch (_) {
          /* already closed */
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10e3).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
