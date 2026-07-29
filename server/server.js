/**
 * server.js
 * -----------------------------------------------------------------------
 * Entry point of the application.
 * Responsible ONLY for: connecting to the database and starting the
 * HTTP server. All Express configuration lives in app.js.
 * -----------------------------------------------------------------------
 */

const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');

// Connect to MongoDB, then start listening
connectDB().then(() => {
  const server = app.listen(env.port, () => {
    console.log(
      `🚀 Moamenoon Cars API running in ${env.nodeEnv} mode on http://localhost:${env.port}`
    );
  });

  // Catch unhandled promise rejections (e.g. DB errors after startup)
  process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
});
