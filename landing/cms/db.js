// PostgreSQL access (node-postgres). Connection comes from DATABASE_URL.
//   e.g. DATABASE_URL=postgres://user:password@localhost:5432/lengai
require('./loadEnv');
const { Pool, types } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// bigint (COUNT, BIGINT columns) and numeric (SUM) come back as strings by default
types.setTypeParser(20, v => parseInt(v, 10));
types.setTypeParser(1700, v => parseFloat(v));


const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!process.env.DATABASE_URL) {
  console.error('\n[cms] DATABASE_URL is not set. Example:\n  DATABASE_URL=postgres://user:password@localhost:5432/lengai\n');
  process.exit(1);
}
const ssl = process.env.PGSSL === 'require' || /sslmode=require/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 10 });
pool.on('error', e => console.error('[cms] pg pool error', e.message));

// "?" placeholders -> $1, $2 ...
const conv = sql => { let i = 0; return sql.replace(/'(?:[^']|'')*'|\?/g, m => m === '?' ? '$' + (++i) : m); };
const all = async (sql, ...p) => (await pool.query(conv(sql), p)).rows;
const get = async (sql, ...p) => (await pool.query(conv(sql), p)).rows[0];
const run = async (sql, ...p) => pool.query(conv(sql), p);
const insert = async (sql, ...p) => (await pool.query(conv(sql) + ' RETURNING id', p)).rows[0].id;

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
const ready = seed();

module.exports = { pool, all, get, run, insert, ready, J, P, tourOut, tourFromBody, hashPassword, verifyPassword, TOUR_JSON };
