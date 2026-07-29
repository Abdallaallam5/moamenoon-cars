/**
 * config/db.js
 * -----------------------------------------------------------------------
 * Handles the MongoDB connection using Mongoose.
 *
 * Zero-config mode: if MONGO_URI isn't set (no .env, or the value is
 * empty), this automatically starts a local embedded MongoDB instance
 * via mongodb-memory-server — no Atlas account, install, or password
 * required. Its data is stored under server/data/mongodb-data so it
 * persists across restarts (delete that folder to reset the database).
 * -----------------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const env = require('./env');

let embeddedServer = null; // kept so we can stop it cleanly on shutdown

const startEmbeddedMongo = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');

  console.log('ℹ️  No MONGO_URI configured — starting a local embedded MongoDB...');
  console.log('   (first run downloads the MongoDB binary once, ~1-2 minutes, then it is cached)');

  const dbPath = path.join(__dirname, '..', 'data', 'mongodb-data');
  fs.mkdirSync(dbPath, { recursive: true }); // mongodb-memory-server expects this folder to already exist

  embeddedServer = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
    },
  });

  return embeddedServer.getUri('moamenoon-cars');
};

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);

    const uri = env.mongoUri || (await startEmbeddedMongo());

    // Require journal acknowledgement so writes survive an abrupt process
    // stop (e.g. the embedded MongoDB being killed on shutdown) instead of
    // being lost while only held in memory.
    const conn = await mongoose.connect(uri, { writeConcern: { w: 1, j: true } });

    console.log(`✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    if (embeddedServer) {
      console.log('   Running on a local embedded database — your data stays on this machine.');
    }

    // Log runtime connection issues after the initial successful connect
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB runtime error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect is handled by the driver...');
    });

    // Graceful shutdown on app termination
    process.on('SIGINT', async () => {
      await disconnectDB();
      console.log('🔌 MongoDB connection closed due to app termination');
      process.exit(0);
    });
  } catch (error) {
    console.error(`❌ Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.connection.close();
  if (embeddedServer) {
    await embeddedServer.stop();
    embeddedServer = null;
  }
};

module.exports = { connectDB, disconnectDB };
