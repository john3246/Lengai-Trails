// PostgreSQL access (node-postgres). Connection comes from DATABASE_URL.
//   e.g. DATABASE_URL=postgres://user:password@localhost:5432/lengai
require('./loadEnv');
const { Pool: PgPool, types } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// bigint (COUNT, BIGINT columns) and numeric (SUM) come back as strings by default
types.setTypeParser(20, v => parseInt(v, 10));
types.setTypeParser(1700, v => parseFloat(v));
types.setTypeParser(1082, v => v); // DATE columns stay plain YYYY-MM-DD strings


const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
// Without DATABASE_URL the site runs on a built-in in-memory database filled from the files in /data on every start.
// That is enough to show the site: nothing is stored between restarts, and CMS edits last only until the server stops.
let pool;
const DEMO = !process.env.DATABASE_URL;
if (DEMO) {
  const { newDb, DataType } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: 'to_regclass', args: [DataType.text], returns: DataType.text, implementation: n => { try { mem.public.getTable(n); return n; } catch { return null; } } });
  pool = new (mem.adapters.createPg().Pool)();
  console.log('[cms] DATABASE_URL not set: running on built-in in-memory data (demo mode)');
} else {
  const ssl = process.env.PGSSL === 'require' || /sslmode=require/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined;
  pool = new PgPool({ connectionString: process.env.DATABASE_URL, ssl, max: 10 });
}
pool.on('error', e => console.error('[cms] pg pool error', e.message));

// "?" placeholders -> $1, $2 ...
const conv = sql => { let i = 0; return sql.replace(/'(?:[^']|'')*'|\?/g, m => m === '?' ? '$' + (++i) : m); };
// The in-memory database has no "= ANY(array)", so there each array becomes an IN (...) list.
const prep = (sql, p) => {
  if (!DEMO) return [conv(sql), p];
  let idx = 0; const np = [];
  const out = sql.replace(/= ANY\(\?::\w+\[\]\)|'(?:[^']|'')*'|\?/g, m => {
    if (m.startsWith('= ANY')) { const a = p[idx++] || []; if (!a.length) return 'IN (NULL)'; np.push(...a); return 'IN (' + a.map(() => '?').join(',') + ')'; }
    if (m === '?') { np.push(p[idx++]); return '?'; }
    return m;
  });
  return idx ? [conv(out), np] : [sql, p];
};
const q = (c, sql, p, suffix = '') => { const [s, a] = prep(sql, p); return c.query(s + suffix, a); };
const all = async (sql, ...p) => (await q(pool, sql, p)).rows;
const get = async (sql, ...p) => (await q(pool, sql, p)).rows[0];
const run = async (sql, ...p) => q(pool, sql, p);
const insert = async (sql, ...p) => (await q(pool, sql, p, ' RETURNING id')).rows[0].id;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tours (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  category TEXT NOT NULL, subcategory TEXT, tags JSONB DEFAULT '[]', type TEXT, days INTEGER,
  overview JSONB DEFAULT '[]', highlights JSONB DEFAULT '[]', itinerary JSONB DEFAULT '[]',
  inclusions JSONB DEFAULT '[]', exclusions JSONB DEFAULT '[]', notes JSONB DEFAULT '[]',
  price_tiers JSONB DEFAULT '[]', price_single INTEGER, price_from INTEGER, price_note TEXT,
  image TEXT, status TEXT DEFAULT 'published', featured INTEGER DEFAULT 0, source TEXT, sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tours_cat ON tours(category, status);
CREATE TABLE IF NOT EXISTS records (
  id SERIAL PRIMARY KEY, kind TEXT NOT NULL, title TEXT, status TEXT, data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_records_kind ON records(kind);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, role TEXT DEFAULT 'editor',
  pass_hash TEXT NOT NULL, active INTEGER DEFAULT 1, last_login TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit (id SERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT now(), "user" TEXT, action TEXT, entity TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS pageviews (id SERIAL PRIMARY KEY, ts BIGINT, day TEXT, path TEXT, title TEXT, vh TEXT, country TEXT, ref TEXT, device TEXT);
CREATE INDEX IF NOT EXISTS idx_pv_day ON pageviews(day);
CREATE TABLE IF NOT EXISTS media (id SERIAL PRIMARY KEY, name TEXT, url TEXT, size INTEGER, mime TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS api_keys (id SERIAL PRIMARY KEY, name TEXT, key_hash TEXT, prefix TEXT, created_at TIMESTAMPTZ DEFAULT now(), last_used TIMESTAMPTZ);
`;

const J = v => JSON.stringify(v == null ? [] : v);
const P = (v, d) => { if (v == null) return d; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return d; } };

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 64);
  const b = Buffer.from(hash, 'hex');
  return b.length === h.length && crypto.timingSafeEqual(h, b);
}

const TOUR_JSON = ['tags', 'overview', 'highlights', 'itinerary', 'inclusions', 'exclusions', 'notes', 'price_tiers'];
const tourOut = r => r; // JSONB columns already come back parsed
function tourFromBody(b) {
  const o = {};
  ['title', 'slug', 'category', 'subcategory', 'type', 'price_note', 'image', 'status', 'source'].forEach(k => { if (b[k] !== undefined) o[k] = b[k]; });
  ['days', 'price_single', 'featured', 'sort'].forEach(k => { if (b[k] !== undefined) o[k] = b[k] === '' || b[k] === null ? null : Number(b[k]); });
  TOUR_JSON.forEach(k => { if (b[k] !== undefined) o[k] = J(b[k]); });
  if (b.price_tiers !== undefined || b.price_single !== undefined) {
    const tiers = Array.isArray(b.price_tiers) ? b.price_tiers : [];
    const prices = tiers.map(t => Number(t.usd)).filter(Boolean).concat(b.price_single ? [Number(b.price_single)] : []);
    o.price_from = prices.length ? Math.min(...prices) : null;
  }
  return o;
}

async function seed() {
  await pool.query(SCHEMA_SQL);

  if (!(await get('SELECT COUNT(*) c FROM tours')).c) {
    const f = path.join(DATA, 'packages.json');
    if (fs.existsSync(f)) {
      const list = JSON.parse(fs.readFileSync(f, 'utf8'));
      const cols = ['slug', 'title', 'category', 'subcategory', 'tags', 'type', 'days', 'overview', 'highlights', 'itinerary', 'inclusions', 'exclusions', 'notes', 'price_tiers', 'price_single', 'price_from', 'price_note', 'image', 'source', 'sort'];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of list) {
          await client.query(`INSERT INTO tours (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (slug) DO NOTHING`,
            cols.map(c => TOUR_JSON.includes(c) ? J(p[c]) : (p[c] === undefined ? null : p[c])));
        }
        await client.query('COMMIT');
        console.log('[cms] seeded ' + list.length + ' packages from packages.json');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
  }

  // Extra trips from the original static safaris page (luxury, family, honeymoon...), added once.
  if (!(await get("SELECT value FROM settings WHERE key = 'extras_v2'"))) {
    const f = path.join(DATA, 'extra-packages.json');
    if (fs.existsSync(f)) {
      const list = JSON.parse(fs.readFileSync(f, 'utf8'));
      const cols = ['slug', 'title', 'category', 'subcategory', 'tags', 'type', 'days', 'overview', 'highlights', 'itinerary', 'inclusions', 'exclusions', 'notes', 'price_tiers', 'price_single', 'price_from', 'price_note', 'image', 'source', 'sort'];
      for (const p of list) {
        await pool.query(`INSERT INTO tours (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (slug) DO NOTHING`,
          cols.map(c => TOUR_JSON.includes(c) ? J(p[c]) : (p[c] === undefined ? null : p[c])));
      }
      console.log('[cms] added ' + list.length + ' extra safari packages');
    }
    await run("INSERT INTO settings (key,value) VALUES ('extras_v2','1') ON CONFLICT (key) DO NOTHING");
  }

  // 11 more trips (luxury, balloon, migration, Kilimanjaro), added once from data/new-packages.json.
  if (!(await get("SELECT value FROM settings WHERE key = 'new_packages_v1'"))) {
    const f = path.join(DATA, 'new-packages.json');
    if (fs.existsSync(f)) {
      const list = JSON.parse(fs.readFileSync(f, 'utf8'));
      const cols = ['slug', 'title', 'category', 'subcategory', 'tags', 'type', 'days', 'overview', 'highlights', 'itinerary', 'inclusions', 'exclusions', 'notes', 'price_tiers', 'price_single', 'price_from', 'price_note', 'image', 'source', 'sort'];
      for (const p of list) {
        await pool.query(`INSERT INTO tours (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (slug) DO NOTHING`,
          cols.map(c => TOUR_JSON.includes(c) ? J(p[c]) : (p[c] === undefined ? null : p[c])));
      }
      console.log('[cms] added ' + list.length + ' new packages');
    }
    await run("INSERT INTO settings (key,value) VALUES ('new_packages_v1','1') ON CONFLICT (key) DO NOTHING");
  }

  // Package text originally named another operator; use our own brand, once.
  if (!(await get("SELECT value FROM settings WHERE key = 'rebrand_v1'"))) {
    for (const t of await all('SELECT id, overview, itinerary, inclusions, exclusions, notes, highlights FROM tours')) {
      const fix = v => JSON.stringify(v).replace(/Golden Memories Safaris/g, 'Lengai Trails').replace(/Golden Memories/g, 'Lengai Trails');
      const cur = JSON.stringify({ o: t.overview, i: t.itinerary, n: t.inclusions, e: t.exclusions, t: t.notes, h: t.highlights });
      if (cur !== fix({ o: t.overview, i: t.itinerary, n: t.inclusions, e: t.exclusions, t: t.notes, h: t.highlights })) {
        const x = JSON.parse(fix({ o: t.overview, i: t.itinerary, n: t.inclusions, e: t.exclusions, t: t.notes, h: t.highlights }));
        await run('UPDATE tours SET overview=?, itinerary=?, inclusions=?, exclusions=?, notes=?, highlights=? WHERE id=?', J(x.o), J(x.i), J(x.n), J(x.e), J(x.t), J(x.h), t.id);
      }
    }
    await run("INSERT INTO settings (key,value) VALUES ('rebrand_v1','1') ON CONFLICT (key) DO NOTHING");
  }

  // Original wording for package titles, overviews and highlights (data/rewrite-v1.json), applied once.
  if (!(await get("SELECT value FROM settings WHERE key = 'rewrite_v1'"))) {
    const f = path.join(DATA, 'rewrite-v1.json');
    if (fs.existsSync(f)) {
      const rw = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const [slug, r] of Object.entries(rw))
        await run('UPDATE tours SET title = ?, overview = ?, highlights = ?, updated_at = now() WHERE slug = ?', r.t, J([r.o]), J(r.h), slug);
      console.log('[cms] rewrote text for ' + Object.keys(rw).length + ' packages');
    }
    await run("INSERT INTO settings (key,value) VALUES ('rewrite_v1','1') ON CONFLICT (key) DO NOTHING");
  }

  // Original written content for destinations, guides and FAQs (data/content-text.json), loaded once.
  if (!(await get("SELECT value FROM settings WHERE key = 'content_text_v1'"))) {
    const f = path.join(DATA, 'content-text.json');
    if (fs.existsSync(f)) {
      const txt = JSON.parse(fs.readFileSync(f, 'utf8'));
      const slugify = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      for (const [slug, v] of Object.entries(txt.destinations || {})) {
        const row = await get("SELECT id, data FROM records WHERE kind = 'destinations' AND data->>'slug' = ?", slug);
        if (row) await run('UPDATE records SET data = ?, updated_at = now() WHERE id = ?', JSON.stringify({ ...P(row.data), ...v }), row.id);
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const p of txt.blog || []) {
        const row = await get("SELECT id, data FROM records WHERE kind = 'blog' AND (data->>'slug' = ? OR title = ?)", p.slug, p.title);
        const d = { image: 'assets/img/serengeti-04.webp', author: 'Lengai Trails', published_at: today, ...(row ? P(row.data) : {}), ...p, status: 'published' };
        if (row) await run('UPDATE records SET title = ?, status = ?, data = ?, updated_at = now() WHERE id = ?', d.title, 'published', JSON.stringify(d), row.id);
        else await run('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', 'blog', d.title, 'published', JSON.stringify(d));
      }
      for (const q of txt.faqs || []) {
        if (await get("SELECT id FROM records WHERE kind = 'faqs' AND title = ?", q.question)) continue;
        await run('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', 'faqs', q.question, 'published', JSON.stringify({ ...q, status: 'published' }));
      }
      console.log('[cms] loaded destination, guide and FAQ text');
    }
    await run("INSERT INTO settings (key,value) VALUES ('content_text_v1','1') ON CONFLICT (key) DO NOTHING");
  }

  // Lodge descriptions and itineraries for the added packages, loaded once.
  if (!(await get("SELECT value FROM settings WHERE key = 'lodge_itin_v2'"))) {
    const lf = path.join(DATA, 'content-lodges.json'), itf = path.join(DATA, 'content-itineraries.json');
    if (fs.existsSync(lf)) {
      for (const [slug, description] of Object.entries(JSON.parse(fs.readFileSync(lf, 'utf8')))) {
        const row = await get("SELECT id, data FROM records WHERE kind = 'accommodations' AND data->>'slug' = ?", slug);
        if (row) await run('UPDATE records SET data = ?, updated_at = now() WHERE id = ?', JSON.stringify({ ...P(row.data), description }), row.id);
      }
    }
    if (fs.existsSync(itf)) {
      for (const [slug, c] of Object.entries(JSON.parse(fs.readFileSync(itf, 'utf8')))) {
        await pool.query('UPDATE tours SET itinerary = $1, inclusions = $2, exclusions = $3, notes = $4 WHERE slug = $5',
          [J(c.itinerary), J(c.inclusions), J(c.exclusions), J(c.notes), slug]);
      }
    }
    const ff = path.join(DATA, 'content-destfacts.json');
    if (fs.existsSync(ff)) {
      for (const [slug, v] of Object.entries(JSON.parse(fs.readFileSync(ff, 'utf8')))) {
        const row = await get("SELECT id, data FROM records WHERE kind = 'destinations' AND data->>'slug' = ?", slug);
        if (row) await run('UPDATE records SET data = ?, updated_at = now() WHERE id = ?', JSON.stringify({ ...P(row.data), ...v }), row.id);
      }
    }
    console.log('[cms] loaded lodge descriptions, destination facts and itineraries');
    await run("INSERT INTO settings (key,value) VALUES ('lodge_itin_v2','1') ON CONFLICT (key) DO NOTHING");
  }

  // Arusha and Arusha National Park, the other two northern gateway destinations (original text, added once).
  if (!(await get("SELECT value FROM settings WHERE key = 'dest_arusha_v1'"))) {
    const add = [
      { name: 'Arusha', slug: 'arusha', region: 'Northern Tanzania', keyword: 'title:Arusha', image: 'assets/img/kilimanjaro-06-card.webp', status: 'published',
        summary: 'The lively gateway city of the northern circuit, beneath Mount Meru and about an hour from Kilimanjaro Airport.',
        description: 'Arusha sits at the foot of Mount Meru and is where most northern Tanzania safaris begin and end. Kilimanjaro International Airport is roughly an hour away by road, so many guests arrive, rest for a night and set off the next morning.\nIt is worth giving the city a little time. The Cultural Heritage Centre and the craft markets are good for gifts, the coffee farms and waterfalls on Meru\'s lower slopes make easy half-day outings, and Arusha National Park is only a short drive away.\nThe city lies at about 1,400 metres, so days are warm and evenings can be cool. Hotels range from simple guesthouses to comfortable lodges set in gardens, and we can arrange your airport transfers and first and last nights as part of any package.',
        best_time: 'All year; June to October is the driest', high_season: 'July to October and December to January', best_weather: 'Warm days and cool evenings, with rain mostly from March to May', wildlife: 'Colobus monkey: Nearby, in Arusha National Park\nBirdlife: Common in the gardens' },
      { name: 'Arusha National Park', slug: 'arusha-national-park', region: 'Northern Tanzania', keyword: 'Arusha National Park', image: 'assets/img/giraffe-sunset-silhouette-28-card.webp', status: 'published',
        summary: 'A small, varied park beside Arusha with Mount Meru, the Momella lakes, giraffes and colobus monkeys, ideal for a day trip.',
        description: 'Arusha National Park lies about 25 kilometres from Arusha and packs a surprising amount into a small area: the forested slopes of Mount Meru, the Ngurdoto Crater, and the Momella lakes, where flamingos and other water birds gather.\nIt is one of the few northern parks where you can get out of the vehicle on a guided walking safari with an armed ranger, and it is a quiet place for photography. Giraffes, buffalo, warthogs, zebras and black-and-white colobus monkeys are the main sights. You will not find the big predators of the Serengeti here, which is part of its relaxed charm.\nBecause it is so close to the city, it works well as a day trip on arrival or departure day, or as a gentle start before Tarangire, the Serengeti and Ngorongoro.',
        best_time: 'June to October and December to February, for the clearest views of Mount Meru', high_season: 'July to October', best_weather: 'Cooler than the lowlands, especially in the mornings', wildlife: 'Giraffe: Common\nBuffalo: Common\nColobus monkey: Common\nFlamingo: Seasonal\nWarthog: Common' }
    ];
    for (const d of add) if (!(await get("SELECT id FROM records WHERE kind = 'destinations' AND data->>'slug' = ?", d.slug))) await run('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', 'destinations', d.name, 'published', JSON.stringify(d));
    await run("INSERT INTO settings (key,value) VALUES ('dest_arusha_v1','1') ON CONFLICT (key) DO NOTHING");
  }
  // Fuller destination pages: highlights, things to do, getting there and tips (original text in data/content-destdepth.json), once.
  if (!(await get("SELECT value FROM settings WHERE key = 'dest_depth_v1'"))) {
    const f = path.join(DATA, 'content-destdepth.json');
    if (fs.existsSync(f)) {
      for (const [slug, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) {
        const row = await get("SELECT id, data FROM records WHERE kind = 'destinations' AND data->>'slug' = ?", slug);
        if (row) await run('UPDATE records SET data = ?, updated_at = now() WHERE id = ?', JSON.stringify({ ...P(row.data), highlights: (v.highlights || []).join('\n'), activities: (v.activities || []).join('\n'), getting_there: v.getting_there || '', tips: (v.tips || []).join('\n') }), row.id);
      }
      console.log('[cms] added destination highlights, activities and tips');
    }
    await run("INSERT INTO settings (key,value) VALUES ('dest_depth_v1','1') ON CONFLICT (key) DO NOTHING");
  }
  const setIf = (k, v) => run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO NOTHING', k, v);
  await setIf('site_name', 'Lengai Trails Expeditions'); await setIf('tagline', 'Your path to golden memories begins here');
  await setIf('contact_email', 'info@lengaitrails.com'); await setIf('contact_phone', '+255 000 000 000');
  await setIf('address', 'Arusha, Tanzania'); await setIf('currency', 'USD'); await setIf('notify_email', 'info@lengaitrails.com');
  await setIf('seo_title', 'Lengai Trails Expeditions | Tanzania Safaris & Kilimanjaro'); await setIf('seo_description', 'Private safaris, Kilimanjaro climbs and Zanzibar holidays, planned by a locally owned team in Arusha.');

  if (!(await get('SELECT COUNT(*) c FROM users')).c) {
    const email = process.env.ADMIN_EMAIL || 'admin@lengaitrails.com';
    const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
    await run('INSERT INTO users (email,name,role,pass_hash) VALUES (?,?,?,?)', email, 'Site Administrator', 'super_admin', hashPassword(pw));
    if (!process.env.ADMIN_PASSWORD) {
      fs.mkdirSync(DATA, { recursive: true });
      fs.writeFileSync(path.join(DATA, '.admin-initial.txt'), `email: ${email}\npassword: ${pw}\n(change it under My profile, then delete this file)\n`);
    }
    console.log(`[cms] created admin ${email}` + (process.env.ADMIN_PASSWORD ? '' : ' — initial password in landing/data/.admin-initial.txt'));
  }
  // Seed site content (only while a section is still empty). Edit it afterwards in the CMS.
  const cf = path.join(DATA, 'content-seed.json');
  if (fs.existsSync(cf)) {
    const seedData = JSON.parse(fs.readFileSync(cf, 'utf8'));
    const slug = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const titleKey = { destinations: 'name', accommodations: 'name', reviews: 'name', blog: 'title' };
    for (const kind of Object.keys(seedData)) {
      if ((await get('SELECT COUNT(*) c FROM records WHERE kind = ?', kind)).c) continue;
      for (const item of seedData[kind]) {
        const d = { ...item };
        if (kind === 'accommodations') { d.slug = d.slug || slug(d.name); d.status = d.status || 'published'; }
        if (kind === 'blog') { d.slug = d.slug || slug(d.title); d.status = 'draft'; d.author = d.author || 'Lengai Trails'; }
        if (kind === 'reviews') d.status = 'published';
        await run('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', kind, d[titleKey[kind]], d.status || null, JSON.stringify(d));
      }
      console.log('[cms] seeded ' + seedData[kind].length + ' ' + kind);
    }
  }
}
const ready = seed().then(() => require('./migrate').run(pool));
async function tx(fn) { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn({ all: async (sql, ...p) => (await q(c, sql, p)).rows, get: async (sql, ...p) => (await q(c, sql, p)).rows[0], run: (sql, ...p) => q(c, sql, p) }); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }

module.exports = { tx, pool, all, get, run, insert, ready, J, P, tourOut, tourFromBody, hashPassword, verifyPassword, TOUR_JSON };
