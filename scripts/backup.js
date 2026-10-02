// Consistent backup of the database, safe to run while the site is live.
//   npm run backup                       -> data/backups/app-YYYY-MM-DD.db
//   node scripts/backup.js /some/file.db -> writes exactly there
// Photos never change once uploaded, so back those up with a plain file copy / rsync (see deploy/backup.sh).
const fs = require('fs');
const path = require('path');
const cfg = require('../server/config');
const { db } = require('../server/db');

const dest = path.resolve(process.argv[2] || path.join(cfg.DATA_DIR, 'backups', `app-${new Date().toISOString().slice(0, 10)}.db`));
fs.mkdirSync(path.dirname(dest), { recursive: true });
if (fs.existsSync(dest)) fs.unlinkSync(dest);
db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
console.log(`Database backup written to ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
db.close();
