const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const { UPLOAD_DIR } = require('./config');
const { ValidationError } = require('./validate');

const MAX_IMAGES = 8;
const MAX_BYTES = 6 * 1024 * 1024;
const FULL_SIDE = 1600; // longest side of the full-size photo
const THUMB = { width: 640, height: 480 }; // list cards (4:3)

// keep image work from starving the web server on small machines
sharp.concurrency(Number(process.env.SHARP_THREADS) || 2);
sharp.cache({ items: 50, memory: 64 });

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_IMAGES, fileSize: MAX_BYTES, fields: 30, fieldSize: 20000, parts: 60 },
});

/** Accepts multipart bodies with up to 8 files in the "images" field. */
const receiveImages = parser.array('images', MAX_IMAGES);

/* ---------- limit how many uploads are processed at the same time ----------
 * Photo processing is CPU/RAM heavy, so only a few uploads run at once; the others wait in a short queue
 * (nothing is read from them yet, so waiting costs no memory). Only a very long or very full queue is refused.
 */
const MAX_ACTIVE = Number(process.env.MAX_CONCURRENT_UPLOADS) || 4;
const MAX_QUEUE = 40;
const QUEUE_WAIT_MS = 20e3;
let active = 0;
const waiters = [];

function acquire() {
  let waiter = null;
  const promise = new Promise((resolve, reject) => {
    if (active < MAX_ACTIVE) {
      active += 1;
      return resolve();
    }
    if (waiters.length >= MAX_QUEUE) return reject(new Error('queue full'));
    waiter = {
      grant: () => {
        clearTimeout(waiter.timer);
        active += 1;
        resolve();
      },
      timer: setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error('queue timeout'));
      }, QUEUE_WAIT_MS),
    };
    waiters.push(waiter);
  });
  const cancel = () => {
    if (waiter && waiters.includes(waiter)) {
      clearTimeout(waiter.timer);
      waiters.splice(waiters.indexOf(waiter), 1);
    }
  };
  return { promise, cancel };
}

function release() {
  active -= 1;
  const next = waiters.shift();
  if (next) next.grant();
}

async function uploadGate(req, res, next) {
  const { promise, cancel } = acquire();
  let held = false;
  let closed = false;
  res.once('close', () => {
    closed = true;
    if (held) release();
    else cancel();
  });
  try {
    await promise;
  } catch (_) {
    if (!closed) {
      res.set('Retry-After', '5');
      res.status(503).json({ error: 'BUSY' });
    }
    return;
  }
  if (closed) return release(); // the visitor left while waiting: hand the slot back
  held = true;
  next();
}

/** Quick pre-check of the real file type from its signature - never trust the client's mimetype/extension. */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

const SAFE_NAME = /^[a-f0-9]{32}(_t)?\.(jpg|png|webp)$/;
const NEW_FULL = /^[a-f0-9]{32}\.webp$/;

/** Cards use the small version. Photos uploaded before thumbnails existed have none - they fall back to the full file. */
const thumbName = (file) => (NEW_FULL.test(file) ? file.replace(/\.webp$/, '_t.webp') : file);

function removeFiles(names) {
  for (const n of names || []) {
    if (!SAFE_NAME.test(n)) continue;
    fs.unlink(path.join(UPLOAD_DIR, n), () => {});
    if (NEW_FULL.test(n)) fs.unlink(path.join(UPLOAD_DIR, thumbName(n)), () => {});
  }
}

/**
 * Decodes and re-encodes every photo: auto-rotates, strips EXIF/GPS, caps the size, converts to WebP
 * and writes a small thumbnail next to it. A file that is not a real, decodable image is rejected.
 * Returns the stored file names (the full-size ones).
 */
async function saveImages(files) {
  const saved = [];
  try {
    for (const f of files || []) {
      if (!sniff(f.buffer)) throw new ValidationError('BAD_IMAGE', 'images');
      let full;
      let thumb;
      try {
        const src = sharp(f.buffer, { failOn: 'error', limitInputPixels: 60e6 }).rotate();
        // effort 2 (default is 4) halves the processing time for ~4% larger files - measured on real photos
        full = await src.clone().resize({ width: FULL_SIDE, height: FULL_SIDE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 2 }).toBuffer();
        thumb = await src.clone().resize({ ...THUMB, fit: 'cover', position: 'centre' }).webp({ quality: 74, effort: 2 }).toBuffer();
      } catch (_) {
        throw new ValidationError('BAD_IMAGE', 'images');
      }
      const id = crypto.randomBytes(16).toString('hex');
      const name = `${id}.webp`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), full, { flag: 'wx' });
      saved.push(name); // registered first so a failed thumbnail write still cleans up the full file
      fs.writeFileSync(path.join(UPLOAD_DIR, thumbName(name)), thumb, { flag: 'wx' });
    }
  } catch (e) {
    removeFiles(saved);
    throw e;
  }
  return saved;
}

module.exports = { receiveImages, uploadGate, saveImages, removeFiles, thumbName, MAX_IMAGES };
