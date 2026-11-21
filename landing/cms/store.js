// Data access for every content type: typed columns, validated input, ordered child rows and attachments.
// All SQL here uses bound parameters; table and column names only ever come from schema.js, never from a request.
const S = require('./schema');
const { all, get, run, tx } = require('./db');
const { slugify, httpErr } = require('./util');

const kinds = () => Object.keys(S).filter(k => !S[k].special);
const resource = kind => { const r = S[kind]; if (!r || r.special) throw httpErr(404, 'Unknown content type'); return r; };
const Q = n => '"' + n + '"';
const fieldOf = (r, k) => r.fields.find(f => f.k === k);

// ---------- validation ----------
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function cleanValue(f, v) {
  if (v == null || v === '') return null;
  switch (f.t) {
    case 'number': { const n = Number(v); if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw httpErr(400, f.l + ' must be a number.'); return n; }
    case 'date': { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw httpErr(400, f.l + ' must be a valid date.'); return s; }
    case 'select': { const s = String(v); if (!f.o.includes(s)) throw httpErr(400, f.l + ' has an unknown value.'); return s; }
    case 'email': { const s = String(v).trim().toLowerCase().slice(0, 200); if (!isEmail(s)) throw httpErr(400, f.l + ' must be a valid email address.'); return s; }
    case 'image': { const s = String(v).trim().slice(0, 300); if (!/^(\/?assets\/|https:\/\/)/.test(s)) throw httpErr(400, f.l + ' must be a picture from the media library.'); return s.replace(/^\//, ''); }
    case 'md': case 'textarea': return String(v).replace(/\r\n/g, '\n').slice(0, f.max || 60000);
    default: {
      const s = String(v).trim().slice(0, f.max || 300);
      if (f.k === 'url' && s && !/^https:\/\/[^\s]+$/.test(s)) throw httpErr(400, f.l + ' must start with https://');
      return s;
    }
  }
}
function cleanBody(r, body, partial) {
  const out = {};
  for (const f of r.fields) {
    if (body[f.k] === undefined) { if (!partial && f.req) throw httpErr(400, f.l + ' is required.'); continue; }
    const v = cleanValue(f, body[f.k]);
    if (f.req && (v == null || v === '')) throw httpErr(400, f.l + ' is required.');
    out[f.k] = f.k === 'slug' && v ? slugify(v) : v;
  }
  return out;
}
function cleanLists(r, lists) {
  const out = {};
  for (const L of r.lists) {
    if (!lists || lists[L.k] === undefined) continue;
    if (!Array.isArray(lists[L.k])) throw httpErr(400, L.l + ' must be a list.');
    out[L.k] = lists[L.k].slice(0, 60).map(x => ({ a: String(x.a == null ? '' : x.a).trim().slice(0, 300), b: String(x.b == null ? '' : x.b).trim().slice(0, 600) })).filter(x => x.a || x.b);
  }
  return out;
}

// ---------- reads ----------
const listCols = r => ['id', ...r.fields.filter(f => f.t !== 'md').map(f => f.k), 'created_at', 'updated_at'];
async function list(kind, { q, status, limit = 50, offset = 0, sort } = {}) {
  const r = resource(kind), where = [], args = [];
  if (status && fieldOf(r, 'status')) { args.push(status); where.push(`"status" = $${args.length}`); }
  if (q) { args.push('%' + String(q).slice(0, 80) + '%'); where.push('(' + r.fields.filter(f => ['text', 'textarea', 'email', 'select'].includes(f.t)).map(f => `${Q(f.k)} ILIKE $${args.length}`).join(' OR ') + ')'); }
  const sorts = { newest: 'id DESC', oldest: 'id ASC', updated: 'updated_at DESC', title: Q(r.title) + ' ASC' };
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = (await get(`SELECT COUNT(*) c FROM ${r.table}${w}`, ...args)).c;
  const rows = await all(`SELECT ${listCols(r).map(Q).join(',')} FROM ${r.table}${w} ORDER BY ${sorts[sort] || sorts.newest} LIMIT ${Math.min(200, Math.max(1, +limit || 50))} OFFSET ${Math.max(0, +offset || 0)}`, ...args);
  return { rows, total };
}
async function listsOf(kind, id) {
  const r = S[kind]; if (!r || !r.lists.length) return {};
  const rows = await all('SELECT field, a, b FROM cms_list_items WHERE entity = ? AND entity_id = ? ORDER BY field, pos, id', kind, id);
  const out = {}; for (const L of r.lists) out[L.k] = rows.filter(x => x.field === L.k).map(x => ({ a: x.a, b: x.b }));
  return out;
}
async function attachments(kind, id) {
  return all(`SELECT a.id, a.media_id, a.role, a.caption, a.pos, m.url, m.name, m.mime, m.size, m.alt FROM cms_attachments a JOIN media m ON m.id = a.media_id WHERE a.entity = ? AND a.entity_id = ? ORDER BY a.pos, a.id`, kind, id);
}
async function one(kind, id) {
  const r = resource(kind);
  const row = /^\d+$/.test(String(id)) ? await get(`SELECT * FROM ${r.table} WHERE id = ?`, id) : null;
  if (!row) return null;
  return { ...row, lists: await listsOf(kind, row.id), attachments: r.attach ? await attachments(kind, row.id) : [] };
}
async function bySlug(kind, slug, { drafts } = {}) {
  const r = resource(kind); const row = await get(`SELECT * FROM ${r.table} WHERE slug = ?${drafts || !r.publicStatus ? '' : ' AND ' + publicWhere(r)}`, slug);
  return row ? { ...row, lists: await listsOf(kind, row.id) } : null;
}
// what visitors may see: the public status, and for blog posts a publish date that has arrived
const publicWhere = r => `"status" = '${r.publicStatus}'` + (fieldOf(r, 'published_at') ? ' AND (published_at IS NULL OR published_at <= CURRENT_DATE)' : '');
// public shape: flat object; list fields are also given as the plain text the pages already read
function toPublic(r, row) {
  const out = { id: row.id }; for (const f of r.fields) if (row[f.k] !== undefined) out[f.k] = row[f.k] === null ? '' : f.t === 'number' ? Number(row[f.k]) : row[f.k];
  out.created_at = row.created_at; out.updated_at = row.updated_at;
  for (const L of r.lists) { const items = (row.lists && row.lists[L.k]) || []; out[L.k] = items.map(x => (L.b && x.b ? x.a + ': ' + x.b : x.a)).join('\n'); out[L.k + '_items'] = items; }
  return out;
}
async function publicList(kind, { limit = 200, order } = {}) {
  const r = resource(kind);
  const rows = await all(`SELECT * FROM ${r.table} WHERE ${r.publicStatus ? publicWhere(r) : 'TRUE'} ORDER BY ${order || 'id DESC'} LIMIT ${Math.min(500, limit)}`);
  if (r.lists.length && rows.length) {
    const li = await all('SELECT entity_id, field, a, b FROM cms_list_items WHERE entity = ? AND entity_id = ANY(?::int[]) ORDER BY pos, id', kind, rows.map(x => x.id));
    for (const row of rows) { row.lists = {}; for (const L of r.lists) row.lists[L.k] = li.filter(x => x.entity_id === row.id && x.field === L.k).map(x => ({ a: x.a, b: x.b })); }
  }
  return rows.map(row => toPublic(r, row));
}
async function publicOne(kind, slug) { const r = resource(kind); const row = await bySlug(kind, slug); return row ? toPublic(r, row) : null; }

// ---------- writes ----------
async function nextRef(db, prefix, r, field) {
  const n = (await db.get(`SELECT COALESCE(MAX(NULLIF(regexp_replace(${Q(field)}, '^.*-', ''), '')::int), 1000) + 1 n FROM ${r.table} WHERE ${Q(field)} ~ '^[A-Z]+-[0-9]{4}-[0-9]+$'`)).n;
  return prefix + '-' + new Date().getFullYear() + '-' + n;
}
async function uniqueSlug(db, r, slug, id) {
  let s = slug || 'item', n = 1;
  while (await db.get(`SELECT 1 x FROM ${r.table} WHERE slug = ? AND id <> ?`, s, id || 0)) s = slug + '-' + (++n);
  return s;
}
async function save(kind, body, id, user) {
  const r = resource(kind);
  const clean = cleanBody(r, body || {}, !!id), lists = cleanLists(r, body && body.lists);
  const savedId = await tx(async db => {
    let cur = null;
    if (id) { cur = await db.get(`SELECT * FROM ${r.table} WHERE id = ?`, id); if (!cur) throw httpErr(404, 'Not found'); }
    const merged = { ...(cur || {}), ...clean };
    for (const f of r.fields) if (f.req && (merged[f.k] == null || merged[f.k] === '')) throw httpErr(400, f.l + ' is required.');
    if (r.slug && fieldOf(r, 'slug')) { const base = clean.slug !== undefined ? clean.slug : cur ? cur.slug : null; merged.slug = await uniqueSlug(db, r, base || slugify(merged[r.slug]), id); clean.slug = merged.slug; }
    for (const f of r.fields) if (f.auto && !(cur && cur[f.k]) && !clean[f.k]) clean[f.k] = await nextRef(db, f.auto, r, f.k);
    const names = Object.keys(clean);
    if (cur) {
      if (names.length) await db.run(`UPDATE ${r.table} SET ${names.map((n, i) => Q(n) + ' = $' + (i + 1)).join(', ')}, updated_at = now(), updated_by = $${names.length + 1} WHERE id = $${names.length + 2}`, ...names.map(n => clean[n]), user.email, id);
      else await db.run(`UPDATE ${r.table} SET updated_at = now(), updated_by = ? WHERE id = ?`, user.email, id);
    } else {
      const ins = await db.get(`INSERT INTO ${r.table} (${names.map(Q).concat(['created_by', 'updated_by']).join(',')}) VALUES (${names.map((_, i) => '$' + (i + 1)).concat(['$' + (names.length + 1), '$' + (names.length + 1)]).join(',')}) RETURNING id`, ...names.map(n => clean[n]), user.email);
      id = ins.id;
    }
    for (const [field, items] of Object.entries(lists)) {
      await db.run('DELETE FROM cms_list_items WHERE entity = ? AND entity_id = ? AND field = ?', kind, id, field);
      for (const [i, it] of items.entries()) await db.run('INSERT INTO cms_list_items (entity, entity_id, field, pos, a, b) VALUES (?,?,?,?,?,?)', kind, id, field, i, it.a, it.b);
    }
    return id;
  }).catch(e => { if (e.code === '23505') throw httpErr(400, 'That value is already used by another record.'); throw e; });
  return one(kind, savedId);
}
async function remove(kind, ids) {
  const r = resource(kind); ids = ids.map(Number).filter(Boolean); if (!ids.length) return 0;
  await run('DELETE FROM cms_list_items WHERE entity = ? AND entity_id = ANY(?::int[])', kind, ids);
  await run('DELETE FROM cms_attachments WHERE entity = ? AND entity_id = ANY(?::int[])', kind, ids);
  await run(`DELETE FROM ${r.table} WHERE id = ANY(?::int[])`, ids); return ids.length;
}
async function setStatus(kind, ids, status, user) {
  const r = resource(kind), f = fieldOf(r, 'status'); if (!f || !f.o.includes(status)) throw httpErr(400, 'Unknown status.');
  await run(`UPDATE ${r.table} SET "status" = ?, updated_at = now(), updated_by = ? WHERE id = ANY(?::int[])`, status, user.email, ids.map(Number).filter(Boolean));
}
async function duplicate(kind, id, user) {
  const src = await one(kind, id); if (!src) throw httpErr(404, 'Not found');
  const r = resource(kind), body = { lists: src.lists };
  for (const f of r.fields) if (src[f.k] != null && !f.auto) body[f.k] = src[f.k];
  body[r.title] = String(src[r.title] || '') + ' (copy)'; delete body.slug; if (fieldOf(r, 'status')) body.status = r.statuses ? r.statuses[0] : body.status;
  const copy = await save(kind, body, null, user);
  for (const a of src.attachments || []) await attach(kind, copy.id, a.media_id, a.role, a.caption);
  return copy;
}

// ---------- attachments ----------
async function attach(kind, id, mediaId, role, caption) {
  const r = resource(kind); if (!r.attach) throw httpErr(400, 'This content type does not take attachments.');
  if (!(await get(`SELECT 1 x FROM ${r.table} WHERE id = ?`, id))) throw httpErr(404, 'Not found');
  if (!(await get('SELECT 1 x FROM media WHERE id = ?', mediaId))) throw httpErr(404, 'File not found');
  const rl = ['cover', 'gallery', 'file'].includes(role) ? role : 'file';
  const pos = (await get('SELECT COALESCE(MAX(pos), 0) + 1 p FROM cms_attachments WHERE entity = ? AND entity_id = ?', kind, id)).p;
  await run('INSERT INTO cms_attachments (entity, entity_id, media_id, role, caption, pos) VALUES (?,?,?,?,?,?) ON CONFLICT (entity, entity_id, media_id) DO UPDATE SET role = EXCLUDED.role, caption = EXCLUDED.caption', kind, id, mediaId, rl, String(caption || '').slice(0, 300), pos);
  return attachments(kind, id);
}
async function detach(kind, id, attId) { await run('DELETE FROM cms_attachments WHERE id = ? AND entity = ? AND entity_id = ?', attId, kind, id); return attachments(kind, id); }
async function editAttachment(kind, id, attId, { role, caption }) {
  if (role && ['cover', 'gallery', 'file'].includes(role)) await run('UPDATE cms_attachments SET role = ? WHERE id = ? AND entity = ? AND entity_id = ?', role, attId, kind, id);
  if (caption !== undefined) await run('UPDATE cms_attachments SET caption = ? WHERE id = ? AND entity = ? AND entity_id = ?', String(caption).slice(0, 300), attId, kind, id);
  return attachments(kind, id);
}

module.exports = { S, kinds, resource, list, one, bySlug, save, remove, setStatus, duplicate, attach, detach, editAttachment, attachments, publicList, publicOne, publicWhere, toPublic, cleanValue };
