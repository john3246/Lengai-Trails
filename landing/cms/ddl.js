// Builds the relational tables from schema.js. Safe to run on every start (CREATE ... IF NOT EXISTS).
const S = require('./schema');

const colType = f => ({ number: 'NUMERIC(14,2)', date: 'DATE' }[f.t] || 'TEXT');
const q = id => '"' + String(id).replace(/"/g, '') + '"';

function resourceSql(r) {
  const cols = r.fields.map(f => {
    let c = q(f.k) + ' ' + colType(f);
    if (f.k === 'status' && f.o) c += ' NOT NULL DEFAULT ' + "'" + f.o[0] + "' CHECK (" + q('status') + ' IN (' + f.o.map(o => "'" + o + "'").join(',') + '))';
    return c;
  });
  const out = [`CREATE TABLE IF NOT EXISTS ${r.table} (id SERIAL PRIMARY KEY, ${cols.join(', ')}, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by TEXT, updated_by TEXT)`];
  if (r.fields.some(f => f.k === 'slug')) out.push(`CREATE UNIQUE INDEX IF NOT EXISTS ${r.table}_slug ON ${r.table} (slug) WHERE slug IS NOT NULL`);
  if (r.fields.some(f => f.k === 'status')) out.push(`CREATE INDEX IF NOT EXISTS ${r.table}_status ON ${r.table} (status)`);
  return out;
}

const TOURS = `
CREATE TABLE IF NOT EXISTS cms_tours (
  id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safari','group','trekking')), subcategory TEXT, type TEXT, days INTEGER CHECK (days IS NULL OR days > 0),
  price_single INTEGER, price_from INTEGER, price_note TEXT, image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')), featured BOOLEAN NOT NULL DEFAULT FALSE, source TEXT, sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by TEXT, updated_by TEXT);
CREATE INDEX IF NOT EXISTS cms_tours_cat ON cms_tours (category, status);
CREATE TABLE IF NOT EXISTS cms_tour_tags (tour_id INTEGER NOT NULL REFERENCES cms_tours(id) ON DELETE CASCADE, tag TEXT NOT NULL, PRIMARY KEY (tour_id, tag));
CREATE TABLE IF NOT EXISTS cms_tour_text (id SERIAL PRIMARY KEY, tour_id INTEGER NOT NULL REFERENCES cms_tours(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('overview','highlight','inclusion','exclusion','note')), pos INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS cms_tour_text_t ON cms_tour_text (tour_id, kind, pos);
CREATE TABLE IF NOT EXISTS cms_tour_days (id SERIAL PRIMARY KEY, tour_id INTEGER NOT NULL REFERENCES cms_tours(id) ON DELETE CASCADE, day INTEGER NOT NULL, title TEXT NOT NULL DEFAULT '', UNIQUE (tour_id, day));
CREATE TABLE IF NOT EXISTS cms_tour_day_text (id SERIAL PRIMARY KEY, day_id INTEGER NOT NULL REFERENCES cms_tour_days(id) ON DELETE CASCADE, pos INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cms_tour_day_meta (id SERIAL PRIMARY KEY, day_id INTEGER NOT NULL REFERENCES cms_tour_days(id) ON DELETE CASCADE, pos INTEGER NOT NULL DEFAULT 0, k TEXT NOT NULL, v TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS cms_tour_prices (id SERIAL PRIMARY KEY, tour_id INTEGER NOT NULL REFERENCES cms_tours(id) ON DELETE CASCADE, pax INTEGER NOT NULL CHECK (pax > 0), usd INTEGER NOT NULL CHECK (usd > 0), UNIQUE (tour_id, pax));
`;

const COMMON = `
CREATE TABLE IF NOT EXISTS cms_list_items (id SERIAL PRIMARY KEY, entity TEXT NOT NULL, entity_id INTEGER NOT NULL, field TEXT NOT NULL, pos INTEGER NOT NULL DEFAULT 0, a TEXT NOT NULL DEFAULT '', b TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS cms_list_items_e ON cms_list_items (entity, entity_id, field, pos);
CREATE TABLE IF NOT EXISTS cms_attachments (id SERIAL PRIMARY KEY, entity TEXT NOT NULL, entity_id INTEGER NOT NULL, media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'file' CHECK (role IN ('cover','gallery','file')), caption TEXT NOT NULL DEFAULT '', pos INTEGER NOT NULL DEFAULT 0, UNIQUE (entity, entity_id, media_id));
CREATE INDEX IF NOT EXISTS cms_attachments_e ON cms_attachments (entity, entity_id, pos);
ALTER TABLE media ADD COLUMN IF NOT EXISTS alt TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS csrf TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen BIGINT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'read';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS login_attempts (id SERIAL PRIMARY KEY, ts BIGINT NOT NULL, ip TEXT NOT NULL, email TEXT NOT NULL, ok BOOLEAN NOT NULL);
CREATE INDEX IF NOT EXISTS login_attempts_ts ON login_attempts (ts);
`;

async function ensure(pool) {
  await pool.query(COMMON);
  await pool.query(TOURS);
  for (const r of Object.values(S)) if (!r.special) for (const sql of resourceSql(r)) await pool.query(sql);
}
module.exports = { ensure, resourceSql };
