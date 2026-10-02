// Simple load test for the site (no extra packages needed).
//   node scripts/loadtest.js http://localhost:3000 [connections=50] [seconds=8]
//
// Run it against a COPY / test instance, from another computer if you can, and not while real customers are busy.
// The app limits every visitor (IP) to 600 API requests/minute by default, so a test from one machine will start
// getting "429" answers. For a raw-capacity test start the TEST server with:  API_RATE_LIMIT=100000000
const [target = 'http://localhost:3000', conc = 50, secs = 8] = process.argv.slice(2);
const base = new URL(target);
const lib = base.protocol === 'https:' ? require('https') : require('http');
const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity });

const get = (p) =>
  new Promise((resolve) => {
    const t = process.hrtime.bigint();
    const req = lib.get({ host: base.hostname, port: base.port || undefined, path: p, agent, headers: { 'accept-encoding': 'gzip' } }, (r) => {
      let n = 0;
      r.on('data', (c) => (n += c.length));
      r.on('end', () => resolve({ ms: Number(process.hrtime.bigint() - t) / 1e6, status: r.statusCode, bytes: n }));
    });
    req.on('error', () => resolve({ ms: 0, status: 0, bytes: 0 }));
    req.setTimeout(15000, () => req.destroy());
  });

const getJson = (p) =>
  new Promise((resolve, reject) => {
    lib.get({ host: base.hostname, port: base.port || undefined, path: p }, (r) => {
      let s = '';
      r.on('data', (c) => (s += c));
      r.on('end', () => {
        try { resolve(JSON.parse(s)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

async function run(name, pick) {
  const lat = [];
  const codes = {};
  let ok = 0, bytes = 0;
  const start = Date.now();
  const end = start + Number(secs) * 1000;
  await Promise.all(
    Array.from({ length: Number(conc) }, async () => {
      while (Date.now() < end) {
        const r = await get(pick());
        codes[r.status] = (codes[r.status] || 0) + 1;
        if (r.status === 200) { ok++; lat.push(r.ms); bytes += r.bytes; }
      }
    })
  );
  const el = (Date.now() - start) / 1000;
  lat.sort((a, b) => a - b);
  const p = (q) => (lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] || 0).toFixed(0);
  const bad = Object.entries(codes).filter(([c]) => c !== '200').map(([c, n]) => `${c}x${n}`).join(' ');
  console.log(`${name.padEnd(34)} ${String(Math.round(ok / el)).padStart(6)} req/s | p50 ${p(0.5).padStart(5)} ms | p95 ${p(0.95).padStart(5)} ms | p99 ${p(0.99).padStart(5)} ms${bad ? ` | other answers: ${bad}` : ''}`);
}

(async () => {
  const first = await getJson('/api/cars?pageSize=48').catch(() => null);
  if (!first) return console.error('Could not read /api/cars - is the site running at', target, '?');
  const ids = first.items.map((c) => c.id);
  const covers = first.items.map((c) => c.cover).filter(Boolean);
  console.log(`\n${target} - ${conc} connections, ${secs}s per test, catalogue: ${first.total} cars\n`);
  await run('home page', () => '/');
  await run('car list (page 1)', () => '/api/cars?pageSize=12');
  await run('car list (random filters)', () => `/api/cars?pageSize=12&category=${rnd(['import', 'disabled', 'trucks'])}&sort=${rnd(['new', 'price_asc', 'price_desc'])}`);
  if (ids.length) await run('car details', () => `/api/cars/${rnd(ids)}`);
  if (covers.length) await run('car photo (thumbnail)', () => rnd(covers));
  await run('mix: 60% list / 20% details / 20% photos', () => {
    const r = Math.random();
    if (r < 0.6 || !ids.length) return '/api/cars?pageSize=12';
    if (r < 0.8) return `/api/cars/${rnd(ids)}`;
    return covers.length ? rnd(covers) : '/';
  });
  process.exit(0);
})();
