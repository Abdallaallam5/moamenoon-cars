const { db, tx } = require('./db');
const { saveImages, removeFiles, thumbName, MAX_IMAGES } = require('./upload');
const { ValidationError, CATEGORIES } = require('./validate');
const cache = require('./cache');

const MAX_CARS_PER_OWNER = Number(process.env.MAX_CARS_PER_DEALER) || 300;

const BASE = `
SELECT c.*,
  u.role AS owner_role, u.business AS owner_business, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
  (SELECT file FROM car_images i WHERE i.car_id = c.id ORDER BY i.position, i.id LIMIT 1) AS cover,
  (SELECT COUNT(*) FROM car_images i WHERE i.car_id = c.id) AS image_count
FROM cars c JOIN users u ON u.id = c.owner_id`;

const imgUrl = (f) => (f ? `/uploads/${f}` : null);

/** Public shape - never exposes the seller's personal details. */
function toCar(r, { owner = false, admin = false } = {}) {
  const car = {
    id: r.id,
    category: r.category,
    brand: r.brand,
    model: r.model,
    year: r.year,
    condition: r.condition,
    price: r.price,
    mileage: r.mileage,
    transmission: r.transmission,
    fuel: r.fuel,
    color: r.color,
    engine_cc: r.engine_cc,
    // public on purpose: the dealer typed it in the car form as the contact number for this listing
    whatsapp: r.whatsapp,
    status: r.status,
    featured: Boolean(r.featured),
    cover: imgUrl(r.cover ? thumbName(r.cover) : null), // small version: this is what list cards load
    image_count: r.image_count,
    published_at: r.published_at,
    seller: r.owner_role === 'admin' ? { type: 'showroom', name: null } : { type: 'dealer', name: r.owner_business || null },
  };
  if (owner || admin) {
    car.reject_reason = r.reject_reason;
    car.created_at = r.created_at;
    car.updated_at = r.updated_at;
  }
  if (admin) {
    car.owner = { id: r.owner_id, name: r.owner_name, email: r.owner_email, phone: r.owner_phone, business: r.owner_business, role: r.owner_role };
  }
  return car;
}

function imagesOf(carId) {
  return db.prepare('SELECT id, file FROM car_images WHERE car_id = ? ORDER BY position, id').all(carId);
}

function getCarRow(id) {
  return db.prepare(`${BASE} WHERE c.id = ?`).get(id);
}

function getDetail(row, opts) {
  const car = toCar(row, opts);
  car.description = row.description;
  car.images = imagesOf(row.id).map((i) => ({ id: i.id, url: imgUrl(i.file), thumb: imgUrl(thumbName(i.file)) }));
  return car;
}

/* ---------- listing ---------- */
const ORDERS = {
  new: 'c.featured DESC, COALESCE(c.published_at, c.created_at) DESC, c.id DESC',
  price_asc: 'c.price IS NULL, c.price ASC, c.id DESC',
  price_desc: 'c.price DESC, c.id DESC',
};

function listCars({ where = [], params = [], sort = 'new', page = 1, pageSize = 12, soldLast = false, view = {} }) {
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // every filter only touches the cars table, so counting needs no join
  const total = db.prepare(`SELECT COUNT(*) AS n FROM cars c ${w}`).get(...params).n;
  // soldLast (public list only shows 'published' + 'sold'): 'published' < 'sold' alphabetically, so ordering by status puts
  // available cars first AND lets the index in db.js do the sorting
  const order = (soldLast ? 'c.status ASC, ' : '') + (ORDERS[sort] || ORDERS.new);
  // Pick and sort the page first (cheap: cars table only), and only THEN look up cover photo / photo count / seller for those
  // few rows. Doing the lookups for every matching car before sorting is what made this query slow on a big catalogue.
  const rows = db
    .prepare(
      `SELECT c.*,
         u.role AS owner_role, u.business AS owner_business, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
         (SELECT file FROM car_images i WHERE i.car_id = c.id ORDER BY i.position, i.id LIMIT 1) AS cover,
         (SELECT COUNT(*) FROM car_images i WHERE i.car_id = c.id) AS image_count
       FROM (SELECT * FROM cars c ${w} ORDER BY ${order} LIMIT ? OFFSET ?) c
       JOIN users u ON u.id = c.owner_id
       ORDER BY ${order}`
    )
    .all(...params, pageSize, (page - 1) * pageSize);
  return { items: rows.map((r) => toCar(r, view)), total, page, pageSize };
}

const escLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const intOr = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** Filters shared by the public list and the favourites list. */
function publicFilters(q) {
  const where = ["c.status IN ('published','sold')"];
  const params = [];
  if (CATEGORIES.includes(q.category)) { where.push('c.category = ?'); params.push(q.category); }
  if (['new', 'used'].includes(q.condition)) { where.push('c.condition = ?'); params.push(q.condition); }
  if (typeof q.brand === 'string' && q.brand.trim()) { where.push('c.brand = ? COLLATE NOCASE'); params.push(q.brand.trim().slice(0, 60)); }
  if (typeof q.q === 'string' && q.q.trim()) {
    // brand / model / colour. (Searching the long description too made every search ~60% slower for little gain.)
    where.push("(c.brand LIKE ? ESCAPE '\\' OR c.model LIKE ? ESCAPE '\\' OR c.color LIKE ? ESCAPE '\\')");
    const like = `%${escLike(q.q.trim().slice(0, 80))}%`;
    params.push(like, like, like);
  }
  if (intOr(q.yearMin, 0)) { where.push('c.year >= ?'); params.push(intOr(q.yearMin, 0)); }
  if (intOr(q.priceMax, 0)) { where.push('c.price <= ?'); params.push(intOr(q.priceMax, 0)); }
  return { where, params };
}

function pageArgs(q) {
  return { page: intOr(q.page, 1), pageSize: Math.min(intOr(q.pageSize, 12), 48), sort: q.sort };
}

/* ---------- writes ---------- */
const INSERT_CAR = `INSERT INTO cars (owner_id,category,brand,model,year,condition,price,mileage,transmission,fuel,color,engine_cc,description,whatsapp,status,published_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

async function createCar(ownerId, d, files, status) {
  if (!files.length) throw new ValidationError('NO_IMAGES', 'images');
  if (db.prepare('SELECT COUNT(*) AS n FROM cars WHERE owner_id = ?').get(ownerId).n >= MAX_CARS_PER_OWNER) {
    throw Object.assign(new ValidationError('CAR_LIMIT', 'cars'), { status: 409 });
  }
  const names = await saveImages(files);
  try {
    const id = tx(() => {
      const r = db
        .prepare(INSERT_CAR)
        .run(ownerId, d.category, d.brand, d.model, d.year, d.condition, d.price, d.mileage, d.transmission, d.fuel, d.color, d.engine_cc, d.description, d.whatsapp, status, status === 'published' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null);
      const id = Number(r.lastInsertRowid);
      const ins = db.prepare('INSERT INTO car_images (car_id,file,position) VALUES (?,?,?)');
      names.forEach((n, i) => ins.run(id, n, i));
      return id;
    });
    cache.clear();
    return id;
  } catch (e) {
    removeFiles(names);
    throw e;
  }
}

/**
 * keepIds: ids of existing images to keep, in display order (null = keep all).
 * status:  new status, or undefined to leave it as is.
 */
async function updateCar(car, d, { keepIds = null, files = [], status } = {}) {
  const existing = imagesOf(car.id);
  const keep = (keepIds === null ? existing.map((i) => i.id) : keepIds).filter((id) => existing.some((e) => e.id === id));
  if (keep.length + files.length < 1) throw new ValidationError('NO_IMAGES', 'images');
  if (keep.length + files.length > MAX_IMAGES) throw new ValidationError('TOO_MANY_IMAGES', 'images');

  const names = await saveImages(files);
  const drop = existing.filter((e) => !keep.includes(e.id));
  try {
    tx(() => {
      db.prepare(
        `UPDATE cars SET category=?,brand=?,model=?,year=?,condition=?,price=?,mileage=?,transmission=?,fuel=?,color=?,engine_cc=?,description=?,whatsapp=?,updated_at=datetime('now') WHERE id=?`
      ).run(d.category, d.brand, d.model, d.year, d.condition, d.price, d.mileage, d.transmission, d.fuel, d.color, d.engine_cc, d.description, d.whatsapp, car.id);
      if (status) {
        db.prepare('UPDATE cars SET status = ?, reject_reason = NULL WHERE id = ?').run(status, car.id);
      }
      for (const e of drop) db.prepare('DELETE FROM car_images WHERE id = ?').run(e.id);
      keep.forEach((id, i) => db.prepare('UPDATE car_images SET position = ? WHERE id = ?').run(i, id));
      const ins = db.prepare('INSERT INTO car_images (car_id,file,position) VALUES (?,?,?)');
      names.forEach((n, j) => ins.run(car.id, n, keep.length + j));
    });
  } catch (e) {
    removeFiles(names);
    throw e;
  }
  removeFiles(drop.map((d2) => d2.file));
  cache.clear();
}

function deleteCar(id) {
  const files = imagesOf(id).map((i) => i.file);
  db.prepare('DELETE FROM cars WHERE id = ?').run(id);
  removeFiles(files);
  cache.clear();
}

/** Removes every car (and its photos) owned by a user - used when a user is deleted. */
function deleteCarsOf(ownerId) {
  for (const c of db.prepare('SELECT id FROM cars WHERE owner_id = ?').all(ownerId)) deleteCar(c.id);
}

function parseKeep(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((n) => Number.isInteger(n))) return arr;
  } catch (_) {
    /* fall through */
  }
  throw new ValidationError('BAD_REQUEST', 'images');
}

module.exports = { getCarRow, getDetail, toCar, listCars, publicFilters, pageArgs, createCar, updateCar, deleteCar, deleteCarsOf, parseKeep, imagesOf };
