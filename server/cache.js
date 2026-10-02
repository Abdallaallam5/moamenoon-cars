// Tiny in-memory "micro cache" for the public, anonymous read endpoints (car list / details / filters).
// A busy page can be requested hundreds of times per second; answering from memory for a few seconds
// takes almost all the load off the database. Logged-in users always get a fresh answer.
const TTL = process.env.MICROCACHE_MS !== undefined ? Number(process.env.MICROCACHE_MS) : 10000;
const MAX_ENTRIES = 500;
const store = new Map();

function clear() {
  store.clear();
}

function microcache(req, res, next) {
  if (!TTL || req.method !== 'GET' || req.user) return next();
  const key = req.originalUrl;
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.type('json').send(hit.body);
  }
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
      store.set(key, { body: JSON.stringify(body), exp: Date.now() + TTL });
    }
    res.set('X-Cache', 'MISS');
    return send(body);
  };
  next();
}

module.exports = { microcache, clear };
