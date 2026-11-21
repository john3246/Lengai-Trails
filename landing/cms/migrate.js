// One-time move from the old "records / tours with JSON columns" layout to real relational tables.
// The old tables are left untouched as a backup (records, tours); nothing is deleted.
const S = require('./schema');
const ddl = require('./ddl');

const num = v => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const dat = v => { const s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const val = (f, v) => (f.t === 'number' ? num(v) : f.t === 'date' ? dat(v) : v == null || v === '' ? null : String(v));
const arr = v => (Array.isArray(v) ? v : typeof v === 'string' ? (() => { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } })() : []);
const slugify = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function run(pool) {
  await ddl.ensure(pool);
  const done = (await pool.query("SELECT value FROM settings WHERE key = 'relational_v1'")).rows[0];
  if (done) { await rewriteTours(pool); await rewriteItineraries(pool); return; }
  const hasLegacy = async t => (await pool.query('SELECT to_regclass($1) r', [t])).rows[0].r;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // ---- tours ----
    if (await hasLegacy('tours')) {
      const rows = (await c.query('SELECT * FROM tours ORDER BY id')).rows;
      for (const t of rows) {
        await c.query(`INSERT INTO cms_tours (id, slug, title, category, subcategory, type, days, price_single, price_from, price_note, image, status, featured, source, sort, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING`,
          [t.id, t.slug, t.title, ['safari', 'group', 'trekking'].includes(t.category) ? t.category : 'safari', t.subcategory || null, t.type || null, t.days > 0 ? t.days : null, t.price_single, t.price_from, t.price_note || null, t.image || null,
            t.status === 'published' ? 'published' : 'draft', !!t.featured, t.source || null, t.sort || 0, t.created_at, t.updated_at]);
        for (const tag of new Set(arr(t.tags).map(String))) await c.query('INSERT INTO cms_tour_tags (tour_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING', [t.id, tag]);
        for (const [kind, list] of [['overview', t.overview], ['highlight', t.highlights], ['inclusion', t.inclusions], ['exclusion', t.exclusions], ['note', t.notes]])
          for (const [i, body] of arr(list).entries()) if (String(body).trim()) await c.query('INSERT INTO cms_tour_text (tour_id, kind, pos, body) VALUES ($1,$2,$3,$4)', [t.id, kind, i, String(body)]);
        for (const [i, d] of arr(t.itinerary).entries()) {
          const day = Number(d.day) || i + 1;
          const dr = await c.query('INSERT INTO cms_tour_days (tour_id, day, title) VALUES ($1,$2,$3) ON CONFLICT (tour_id, day) DO UPDATE SET title = EXCLUDED.title RETURNING id', [t.id, day, String(d.title || '')]);
          for (const [j, body] of arr(d.body).entries()) if (String(body).trim()) await c.query('INSERT INTO cms_tour_day_text (day_id, pos, body) VALUES ($1,$2,$3)', [dr.rows[0].id, j, String(body)]);
          for (const [j, [k, v]] of Object.entries(d.meta && typeof d.meta === 'object' ? d.meta : {}).entries()) await c.query('INSERT INTO cms_tour_day_meta (day_id, pos, k, v) VALUES ($1,$2,$3,$4)', [dr.rows[0].id, j, String(k), String(v == null ? '' : v)]);
        }
        for (const p of arr(t.price_tiers)) if (Number(p.pax) > 0 && Number(p.usd) > 0) await c.query('INSERT INTO cms_tour_prices (tour_id, pax, usd) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [t.id, Number(p.pax), Math.round(Number(p.usd))]);
      }
      console.log('[cms] moved ' + rows.length + ' tours into relational tables');
    }
    // ---- every other content type ----
    if (await hasLegacy('records')) {
      for (const r of Object.values(S)) {
        if (r.special) continue;
        const rows = (await c.query('SELECT * FROM records WHERE kind = $1 ORDER BY id', [r.key])).rows;
        const used = new Set();
        for (const row of rows) {
          const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
          const vals = {};
          for (const f of r.fields) {
            let v = d[f.k];
            if (f.k === 'slug') { let s = slugify(v || d[r.title] || ''); if (!s || used.has(s)) s = (s || r.key) + '-' + row.id; used.add(s); v = s; }
            if (f.k === 'status') v = f.o.includes(d.status || row.status) ? (d.status || row.status) : f.o[0];
            vals[f.k] = val(f, v);
          }
          const names = ['id', ...r.fields.map(f => f.k), 'created_at', 'updated_at'];
          const params = [row.id, ...r.fields.map(f => vals[f.k]), row.created_at, row.updated_at];
          await c.query(`INSERT INTO ${r.table} (${names.map(n => '"' + n + '"').join(',')}) VALUES (${names.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (id) DO NOTHING`, params);
          for (const L of r.lists) {
            const lines = String(d[L.k] || '').split('\n').map(x => x.trim()).filter(Boolean);
            for (const [i, line] of lines.entries()) {
              let a = line, b = '';
              if (L.b) { const k = line.indexOf(':'); if (k > 0 && k < 60) { a = line.slice(0, k).trim(); b = line.slice(k + 1).trim(); } }
              await c.query('INSERT INTO cms_list_items (entity, entity_id, field, pos, a, b) VALUES ($1,$2,$3,$4,$5,$6)', [r.key, row.id, L.k, i, a, b]);
            }
          }
        }
        if (rows.length) console.log('[cms] moved ' + rows.length + ' ' + r.key + ' into ' + r.table);
      }
    }
    // keep id sequences ahead of the copied ids
    const tables = ['cms_tours', ...Object.values(S).filter(r => !r.special).map(r => r.table)];
    for (const t of tables) await c.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t}), 1), (SELECT COUNT(*) > 0 FROM ${t}))`);
    await c.query("INSERT INTO settings (key, value) VALUES ('relational_v1', '1') ON CONFLICT (key) DO NOTHING");
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  await seedDestinations(pool);
  await rewriteTours(pool);
  await rewriteItineraries(pool);
}
// A fresh install gets the full destination guides from data/content-destinations.json (original text), once.
async function seedDestinations(pool) {
  const f = require('path').join(process.env.DATA_DIR || require('path').join(__dirname, '..', 'data'), 'content-destinations.json');
  const fs = require('fs'); if (!fs.existsSync(f)) return;
  if ((await pool.query("SELECT value FROM settings WHERE key = 'dest_seed_v1'")).rows[0]) return;
  const store = require('./store'), have = new Set((await pool.query('SELECT slug FROM cms_destinations')).rows.map(r => r.slug));
  for (const d of JSON.parse(fs.readFileSync(f, 'utf8'))) if (!have.has(d.slug)) await store.save('destinations', d, null, { email: 'seed' });
  await pool.query("INSERT INTO settings (key, value) VALUES ('dest_seed_v1', '1') ON CONFLICT (key) DO NOTHING");
}
// Original wording for package titles, overviews and highlights (data/rewrite-v1.json), applied once to the live tables.
async function rewriteTours(pool) {
  const f = require('path').join(process.env.DATA_DIR || require('path').join(__dirname, '..', 'data'), 'rewrite-v1.json');
  const fs = require('fs'); if (!fs.existsSync(f)) return;
  if ((await pool.query("SELECT value FROM settings WHERE key = 'rewrite_cms_v1'")).rows[0]) return;
  const rw = JSON.parse(fs.readFileSync(f, 'utf8')), c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const [slug, r] of Object.entries(rw)) {
      const t = (await c.query('SELECT id FROM cms_tours WHERE slug = $1', [slug])).rows[0]; if (!t) continue;
      await c.query('UPDATE cms_tours SET title = $1, updated_at = now() WHERE id = $2', [r.t, t.id]);
      await c.query("DELETE FROM cms_tour_text WHERE tour_id = $1 AND kind IN ('overview','highlight')", [t.id]);
      await c.query("INSERT INTO cms_tour_text (tour_id, kind, pos, body) VALUES ($1, 'overview', 0, $2)", [t.id, r.o]);
      for (let i = 0; i < r.h.length; i++) await c.query("INSERT INTO cms_tour_text (tour_id, kind, pos, body) VALUES ($1, 'highlight', $2, $3)", [t.id, i, r.h[i]]);
    }
    await c.query("INSERT INTO settings (key, value) VALUES ('rewrite_cms_v1', '1') ON CONFLICT (key) DO NOTHING");
    await c.query('COMMIT'); console.log('[cms] rewrote text for ' + Object.keys(rw).length + ' packages');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
// Original day-by-day text (data/rewrite-itineraries-v1.json), applied once. Meals, lodging and other day details stay as they are.
async function rewriteItineraries(pool) {
  const f = require('path').join(process.env.DATA_DIR || require('path').join(__dirname, '..', 'data'), 'rewrite-itineraries-v1.json');
  const fs = require('fs'); if (!fs.existsSync(f)) return;
  if ((await pool.query("SELECT value FROM settings WHERE key = 'rewrite_itin_v1'")).rows[0]) return;
  const rw = JSON.parse(fs.readFileSync(f, 'utf8')), c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const [slug, days] of Object.entries(rw)) {
      const t = (await c.query('SELECT id FROM cms_tours WHERE slug = $1', [slug])).rows[0]; if (!t) continue;
      for (const d of days) {
        const row = (await c.query('SELECT id FROM cms_tour_days WHERE tour_id = $1 AND day = $2', [t.id, d.day])).rows[0]; if (!row) continue;
        await c.query('UPDATE cms_tour_days SET title = $1 WHERE id = $2', [d.title, row.id]);
        await c.query('DELETE FROM cms_tour_day_text WHERE day_id = $1', [row.id]);
        for (let i = 0; i < d.body.length; i++) await c.query('INSERT INTO cms_tour_day_text (day_id, pos, body) VALUES ($1, $2, $3)', [row.id, i, d.body[i]]);
      }
    }
    await c.query("INSERT INTO settings (key, value) VALUES ('rewrite_itin_v1', '1') ON CONFLICT (key) DO NOTHING");
    await c.query('COMMIT'); console.log('[cms] rewrote itineraries for ' + Object.keys(rw).length + ' packages');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
module.exports = { run };
