/**
 * app.js
 * -----------------------------------------------------------------------
 * Configures the Express application: security middlewares, body parsing,
 * static file serving (uploads + client), API routes, and error handling.
 * Exported (not started) so it can be reused in tests.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// Route files
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const brandRoutes = require('./routes/brandRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// ------------------------------------------------------------------
// Security & utility middlewares
// ------------------------------------------------------------------
// secure HTTP headers — CSP is customized because the client pages load
// fonts/icons/translation libraries (i18next, AOS, Swiper, Font Awesome)
// from CDNs and display images from external hosts (Unsplash, ui-avatars,
// placeholder). Helmet's default CSP is 'self'-only and silently blocks
// all of that, breaking images and translations on the client.
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
      },
    },
  })
);
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(compression()); // gzip responses
app.use(morgan(env.isProduction ? 'combined' : 'dev')); // request logging
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter to protect against brute-force / abuse
const limiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ------------------------------------------------------------------
// Static files
// ------------------------------------------------------------------
// Serve uploaded vehicle images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve the frontend (client) folder
app.use(express.static(path.join(__dirname, '..', 'client')));

// ------------------------------------------------------------------
// API Routes
// ------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint (useful for uptime monitors / load balancers)
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Moamenoon Cars API is running 🚗' });
});

// ------------------------------------------------------------------
// Root redirect
// ------------------------------------------------------------------
// This is a traditional multi-page site (not an SPA): each page is a real
// .html file under /pages, and every page's CSS/JS is linked with paths
// relative to /pages/ (e.g. "../assets/css/main.css"). So instead of a
// catch-all that serves index.html's contents at any URL (which would break
// those relative links), we simply redirect "/" to "/pages/index.html" and
// let express.static handle every other real file path. Unknown URLs fall
// through to the 404 handler below, as expected.
app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

// ------------------------------------------------------------------
// Error handling (must be LAST)
// ------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
