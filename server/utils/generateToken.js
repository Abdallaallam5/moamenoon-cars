/**
 * utils/generateToken.js
 * -----------------------------------------------------------------------
 * Signs a JWT for a given user id. Kept as a single reusable helper so
 * the signing options (secret, expiry) stay consistent everywhere.
 * -----------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

module.exports = generateToken;
