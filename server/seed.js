const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');
const { hashPassword, verifyPassword } = require('./auth');
const { ADMIN_EMAIL, ADMIN_PASSWORD, DATA_DIR } = require('./config');

/**
 * Makes sure the owner's admin account exists.
 * - ADMIN_PASSWORD set in .env  -> account is created / its password is synced to it (also how you reset it).
 * - not set and no admin yet    -> a random password is generated and saved to data/admin-initial-password.txt
 */
async function seedAdmin() {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_EMAIL);

  if (ADMIN_PASSWORD) {
    if (ADMIN_PASSWORD.length < 8) {
      console.warn('[admin] ADMIN_PASSWORD must be at least 8 characters - ignored.');
      return;
    }
    if (!row) {
      const hash = await hashPassword(ADMIN_PASSWORD);
      db.prepare("INSERT INTO users (email,name,phone,pass_hash,role,status) VALUES (?,?,?,?,'admin','active')").run(ADMIN_EMAIL, 'Admin', '0', hash);
      console.log(`[admin] admin account created for ${ADMIN_EMAIL}`);
    } else if (row.role !== 'admin' || !(await verifyPassword(ADMIN_PASSWORD, row.pass_hash))) {
      const hash = await hashPassword(ADMIN_PASSWORD);
      db.prepare("UPDATE users SET pass_hash=?, role='admin', status='active' WHERE id=?").run(hash, row.id);
      console.log('[admin] admin password updated from ADMIN_PASSWORD');
    }
    return;
  }

  if (!row) {
    const password = crypto.randomBytes(9).toString('base64url');
    const hash = await hashPassword(password);
    db.prepare("INSERT INTO users (email,name,phone,pass_hash,role,status) VALUES (?,?,?,?,'admin','active')").run(ADMIN_EMAIL, 'Admin', '0', hash);
    const file = path.join(DATA_DIR, 'admin-initial-password.txt');
    fs.writeFileSync(file, `email:    ${ADMIN_EMAIL}\npassword: ${password}\n\nSet ADMIN_PASSWORD in .env to choose your own, then delete this file.\n`, { mode: 0o600 });
    console.log(`[admin] admin account created for ${ADMIN_EMAIL}. Initial password saved in: ${file}`);
  }
}

module.exports = { seedAdmin };
