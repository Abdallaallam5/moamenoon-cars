// Creates (or updates) the admin account directly in the database.
//   npm run admin                       -> asks for email (default: ADMIN_EMAIL) and password
//   npm run admin -- --email=me@x.com   -> asks only for the password
// The password is typed in your terminal (hidden) and stored hashed - it is never written to a file.
const readline = require('readline');
const { db } = require('../server/db');
const { hashPassword } = require('../server/auth');
const { parseEmail, ValidationError } = require('../server/validate');
const cfg = require('../server/config');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
const lines = rl[Symbol.asyncIterator]();
let masking = false;
const write = rl._writeToOutput;
rl._writeToOutput = function (s) {
  if (masking && /^[^\r\n]$/.test(s)) return process.stdout.write('*'); // hide typed characters
  return write.call(rl, s);
};

async function ask(question, hidden = false) {
  process.stdout.write(question);
  masking = hidden;
  const { value, done } = await lines.next();
  masking = false;
  if (hidden && process.stdin.isTTY) process.stdout.write('\n');
  return done ? '' : String(value).trim();
}

(async () => {
  const arg = process.argv.find((a) => a.startsWith('--email='));
  let email = arg ? arg.slice(8) : await ask(`Admin email [${cfg.ADMIN_EMAIL}]: `);
  email = parseEmail(email || cfg.ADMIN_EMAIL);

  const password = await ask('Password (8+ characters): ', true);
  if (password.length < 8 || password.length > 100) throw new ValidationError('WEAK_PASSWORD', 'password');
  const again = await ask('Repeat password: ', true);
  if (again !== password) {
    console.error('\nThe two passwords do not match. Nothing was changed.');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const row = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (row) {
    db.prepare("UPDATE users SET pass_hash = ?, role = 'admin', status = 'active' WHERE id = ?").run(hash, row.id);
    console.log(`\nDone: ${email} is now an admin and its password was updated.`);
  } else {
    db.prepare("INSERT INTO users (email,name,phone,pass_hash,role,status) VALUES (?,?,?,?,'admin','active')").run(email, 'Admin', '0', hash);
    console.log(`\nDone: admin account created for ${email}.`);
  }
  console.log('Log in from /auth.html with this email and the password you just typed.');
  rl.close();
})().catch((e) => {
  const msg = e instanceof ValidationError ? `Invalid ${e.field}: ${e.code}` : e.message;
  console.error(`\nFailed: ${msg}`);
  process.exit(1);
});
