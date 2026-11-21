// Tours (safari, group and trekking packages) stored across relational tables:
// cms_tours + tags, text rows (overview / highlights / inclusions / exclusions / notes), itinerary days with their paragraphs and details, and price tiers.
const { all, get, run, tx } = require('./db');
const { slugify, httpErr, routeOf, clip } = require('./util');

const CATS = ['safari', 'group', 'trekking'];
const KIND = { overview: 'overview', highlights: 'highlight', inclusions: 'inclusion', exclusions: 'exclusion', notes: 'note' };
const strs = (v, max = 2000) => (Array.isArray(v) ? v : []).slice(0, 200).map(x => String(x == null ? '' : x).trim().slice(0, max)).filter(Boolean);
const int = (v, name) => { if (v === '' || v == null) return null; const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 0 || n > 1e8) throw httpErr(400, name + ' must be a positive number.'); return n; };

// ---------- read ----------
async function children(ids) {
  if (!ids.length) return { tags: {}, text: {}, days: {}, prices: {} };
  const [tg, tx_, dy, dt, dm, pr] = await Promise.all([
    all('SELECT tour_id, tag FROM cms_tour_tags WHERE tour_id = ANY(?::int[]) ORDER BY tag', ids),
    all('SELECT tour_id, kind, body FROM cms_tour_text WHERE tour_id = ANY(?::int[]) ORDER BY pos, id', ids),
    all('SELECT id, tour_id, day, title FROM cms_tour_days WHERE tour_id = ANY(?::int[]) ORDER BY day', ids),
    all('SELECT t.day_id, t.body FROM cms_tour_day_text t JOIN cms_tour_days d ON d.id = t.day_id WHERE d.tour_id = ANY(?::int[]) ORDER BY t.pos, t.id', ids),
    all('SELECT m.day_id, m.k, m.v FROM cms_tour_day_meta m JOIN cms_tour_days d ON d.id = m.day_id WHERE d.tour_id = ANY(?::int[]) ORDER BY m.pos, m.id', ids),
    all('SELECT tour_id, pax, usd FROM cms_tour_prices WHERE tour_id = ANY(?::int[]) ORDER BY pax', ids)]);
  const by = (rows, key) => rows.reduce((o, r) => ((o[r[key]] = o[r[key]] || []).push(r), o), {});
  const dtBy = by(dt, 'day_id'), dmBy = by(dm, 'day_id');
  const days = by(dy.map(d => ({ tour_id: d.tour_id, day: d.day, title: d.title, body: (dtBy[d.id] || []).map(x => x.body), meta: Object.fromEntries((dmBy[d.id] || []).map(x => [x.k, x.v])), metaList: (dmBy[d.id] || []).map(x => ({ k: x.k, v: x.v })) })), 'tour_id');
  return { tags: by(tg, 'tour_id'), text: by(tx_, 'tour_id'), days, prices: by(pr, 'tour_id') };
}
const shape = (t, c) => {
  const txt = k => ((c.text[t.id] || []).filter(x => x.kind === KIND[k]).map(x => x.body));
  return { ...t, featured: t.featured ? 1 : 0, tags: (c.tags[t.id] || []).map(x => x.tag), overview: txt('overview'), highlights: txt('highlights'), inclusions: txt('inclusions'), exclusions: txt('exclusions'), notes: txt('notes'),
    itinerary: (c.days[t.id] || []).map(d => ({ day: d.day, title: d.title, body: d.body, meta: d.meta, metaList: d.metaList })), price_tiers: (c.prices[t.id] || []).map(p => ({ pax: p.pax, usd: p.usd })) };
};
async function one(idOrSlug, { drafts = true } = {}) {
  const t = /^\d+$/.test(String(idOrSlug)) ? await get('SELECT * FROM cms_tours WHERE id = ?', idOrSlug) : await get('SELECT * FROM cms_tours WHERE slug = ?', idOrSlug);
  if (!t || (!drafts && t.status !== 'published')) return null;
  const full = shape(t, await children([t.id]));
  const attachments = await all('SELECT a.id, a.media_id, a.role, a.caption, a.pos, m.url, m.name, m.mime, m.size, m.alt FROM cms_attachments a JOIN media m ON m.id = a.media_id WHERE a.entity = ? AND a.entity_id = ? ORDER BY a.pos, a.id', 'tours', t.id);
  return { ...full, attachments };
}
async function list({ q, category, status, limit = 100, offset = 0 } = {}) {
  const where = [], args = [];
  if (q) { args.push('%' + String(q).slice(0, 80) + '%'); where.push(`(title ILIKE $${args.length} OR slug ILIKE $${args.length})`); }
  if (category && CATS.includes(category)) { args.push(category); where.push(`category = $${args.length}`); }
  if (status) { args.push(status); where.push(`status = $${args.length}`); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = (await get(`SELECT COUNT(*) c FROM cms_tours${w}`, ...args)).c;
  const rows = await all(`SELECT id, slug, title, category, subcategory, days, price_from, status, featured, image, updated_at FROM cms_tours${w} ORDER BY sort, id LIMIT ${Math.min(300, +limit || 100)} OFFSET ${Math.max(0, +offset || 0)}`, ...args);
  return { rows: rows.map(r => ({ ...r, featured: r.featured ? 1 : 0 })), total };
}
// Public list: only published, with the route and a short summary for the cards.
async function publicList({ category, tag, sub, mention } = {}) {
  const where = ["t.status = 'published'"], args = [];
  if (category && CATS.includes(category)) { args.push(category); where.push(`t.category = $${args.length}`); }
  if (sub) { args.push(sub); where.push(`t.subcategory = $${args.length}`); }
  if (tag) { args.push(tag); where.push(`EXISTS (SELECT 1 FROM cms_tour_tags g WHERE g.tour_id = t.id AND g.tag = $${args.length})`); }
  if (mention) {
    const titleOnly = /^title:/.test(mention), k = '%' + String(mention).replace(/^title:/, '').slice(0, 80) + '%'; args.push(k);
    const n = args.length;
    where.push(titleOnly ? `t.title ILIKE $${n}` : `(t.title ILIKE $${n} OR t.id IN (SELECT d.tour_id FROM cms_tour_days d WHERE d.title ILIKE $${n}) OR t.id IN (SELECT d.tour_id FROM cms_tour_days d JOIN cms_tour_day_text x ON x.day_id = d.id WHERE x.body ILIKE $${n}))`);
  }
  const rows = await all(`SELECT t.id, t.slug, t.title, t.category, t.subcategory, t.type, t.days, t.price_from, t.price_note, t.image, t.featured FROM cms_tours t WHERE ${where.join(' AND ')} ORDER BY t.sort, t.id`, ...args);
  const ids = rows.map(r => r.id); const c = await children(ids);
  return rows.map(r => { const t = shape(r, c); return { id: r.id, slug: r.slug, title: r.title, category: r.category, subcategory: r.subcategory, tags: t.tags, type: r.type, days: r.days, price_from: r.price_from, price_note: r.price_note, image: r.image, featured: t.featured,
    price_tiers: t.price_tiers, route: routeOf(t.itinerary.map(d => d.title)), summary: clip(t.overview[0] || '', 170) }; });
}
async function destStats(kw) {
  if (!kw) return { tour_count: 0, price_from: null };
  const rows = await publicList({ mention: kw });
  const prices = rows.map(r => r.price_from).filter(Boolean);
  return { tour_count: rows.length, price_from: prices.length ? Math.min(...prices) : null };
}

// ---------- write ----------
function clean(b, partial) {
  const o = {};
  const has = k => b[k] !== undefined;
  if (has('title')) { o.title = String(b.title || '').trim().slice(0, 200); if (!o.title) throw httpErr(400, 'Title is required.'); } else if (!partial) throw httpErr(400, 'Title is required.');
  if (has('slug')) o.slug = slugify(b.slug);
  if (has('category')) { if (!CATS.includes(b.category)) throw httpErr(400, 'Choose a package type.'); o.category = b.category; }
  if (has('subcategory')) o.subcategory = String(b.subcategory || '').trim().slice(0, 80) || null;
  if (has('type')) o.type = String(b.type || '').trim().slice(0, 80) || null;
  if (has('days')) { o.days = int(b.days, 'Days'); if (o.days === 0) throw httpErr(400, 'Days must be at least 1.'); }
  if (has('price_single')) o.price_single = int(b.price_single, 'Price');
  if (has('price_note')) o.price_note = String(b.price_note || '').trim().slice(0, 200) || null;
  if (has('image')) { const s = String(b.image || '').trim(); if (s && !/^(\/?assets\/|https:\/\/)/.test(s)) throw httpErr(400, 'Cover image must come from the media library.'); o.image = s.replace(/^\//, '') || null; }
  if (has('status')) { if (!['draft', 'published'].includes(b.status)) throw httpErr(400, 'Unknown status.'); o.status = b.status; }
  if (has('featured')) o.featured = b.featured === true || b.featured === 1 || b.featured === '1' || b.featured === 'true';
  if (has('sort')) o.sort = int(b.sort, 'Order') || 0;
  return o;
}
async function save(body, id, user) {
  body = body || {};
  const o = clean(body, !!id);
  const tags = body.tags !== undefined ? [...new Set(strs(Array.isArray(body.tags) ? body.tags : String(body.tags).split(','), 40).map(t => t.toLowerCase()))] : null;
  const text = {}; for (const [k, kind] of Object.entries(KIND)) if (body[k] !== undefined) text[kind] = strs(body[k]);
  const days = body.itinerary !== undefined ? (Array.isArray(body.itinerary) ? body.itinerary : []).slice(0, 60).map((d, i) => ({ day: i + 1, title: String(d.title || '').trim().slice(0, 200), body: strs(d.body, 4000),
    meta: (Array.isArray(d.metaList) ? d.metaList : Object.entries(d.meta || {}).map(([k, v]) => ({ k, v }))).slice(0, 20).map(m => ({ k: String(m.k || '').trim().slice(0, 60), v: String(m.v || '').trim().slice(0, 300) })).filter(m => m.k) })) : null;
  const tiers = body.price_tiers !== undefined ? (Array.isArray(body.price_tiers) ? body.price_tiers : []).map(p => ({ pax: int(p.pax, 'Group size'), usd: int(p.usd, 'Price') })).filter(p => p.pax > 0 && p.usd > 0) : null;
  const newId = await tx(async db => {
    let cur = null;
    if (id) { cur = await db.get('SELECT * FROM cms_tours WHERE id = ?', id); if (!cur) throw httpErr(404, 'Not found'); }
    const base = o.slug !== undefined ? o.slug : cur ? cur.slug : slugify(o.title);
    let slug = base || 'package', n = 1; while (await db.get('SELECT 1 x FROM cms_tours WHERE slug = ? AND id <> ?', slug, id || 0)) slug = base + '-' + (++n);
    o.slug = slug;
    const p = tiers || (cur ? (await db.all('SELECT pax, usd FROM cms_tour_prices WHERE tour_id = ?', id)) : []);
    const single = o.price_single !== undefined ? o.price_single : cur ? cur.price_single : null;
    const all_ = p.map(x => x.usd).concat(single ? [single] : []); o.price_from = all_.length ? Math.min(...all_) : null;
    const names = Object.keys(o);
    if (cur) await db.run(`UPDATE cms_tours SET ${names.map((k, i) => k + ' = $' + (i + 1)).join(', ')}, updated_at = now(), updated_by = $${names.length + 1} WHERE id = $${names.length + 2}`, ...names.map(k => o[k]), user.email, id);
    else { if (!o.category) o.category = 'safari'; const ns = Object.keys(o); id = (await db.get(`INSERT INTO cms_tours (${ns.join(',')}, created_by, updated_by) VALUES (${ns.map((_, i) => '$' + (i + 1)).join(',')}, $${ns.length + 1}, $${ns.length + 1}) RETURNING id`, ...ns.map(k => o[k]), user.email)).id; }
    if (tags) { await db.run('DELETE FROM cms_tour_tags WHERE tour_id = ?', id); for (const t of tags) await db.run('INSERT INTO cms_tour_tags (tour_id, tag) VALUES (?,?)', id, t); }
    for (const [kind, list] of Object.entries(text)) { await db.run('DELETE FROM cms_tour_text WHERE tour_id = ? AND kind = ?', id, kind); for (const [i, b] of list.entries()) await db.run('INSERT INTO cms_tour_text (tour_id, kind, pos, body) VALUES (?,?,?,?)', id, kind, i, b); }
    if (days) {
      await db.run('DELETE FROM cms_tour_days WHERE tour_id = ?', id);
      for (const d of days) { const dr = await db.get('INSERT INTO cms_tour_days (tour_id, day, title) VALUES (?,?,?) RETURNING id', id, d.day, d.title);
        for (const [i, b] of d.body.entries()) await db.run('INSERT INTO cms_tour_day_text (day_id, pos, body) VALUES (?,?,?)', dr.id, i, b);
        for (const [i, m] of d.meta.entries()) await db.run('INSERT INTO cms_tour_day_meta (day_id, pos, k, v) VALUES (?,?,?,?)', dr.id, i, m.k, m.v); }
      await db.run('UPDATE cms_tours SET days = COALESCE(days, ?) WHERE id = ?', days.length || null, id);
    }
    if (tiers) { await db.run('DELETE FROM cms_tour_prices WHERE tour_id = ?', id); for (const x of tiers) await db.run('INSERT INTO cms_tour_prices (tour_id, pax, usd) VALUES (?,?,?) ON CONFLICT (tour_id, pax) DO UPDATE SET usd = EXCLUDED.usd', id, x.pax, x.usd); }
    return id;
  }).catch(e => { if (e.code === '23505') throw httpErr(400, 'That slug is already used by another package.'); throw e; });
  return one(newId);
}
async function remove(ids) { ids = ids.map(Number).filter(Boolean); if (!ids.length) return 0; await run("DELETE FROM cms_attachments WHERE entity = 'tours' AND entity_id = ANY(?::int[])", ids); await run('DELETE FROM cms_tours WHERE id = ANY(?::int[])', ids); return ids.length; }
async function setStatus(ids, status) { if (!['draft', 'published'].includes(status)) throw httpErr(400, 'Unknown status.'); await run('UPDATE cms_tours SET status = ?, updated_at = now() WHERE id = ANY(?::int[])', status, ids.map(Number).filter(Boolean)); }
async function duplicate(id, user) {
  const t = await one(id); if (!t) throw httpErr(404, 'Not found');
  const body = { ...t, title: t.title + ' (copy)', status: 'draft', featured: false }; delete body.id; delete body.slug;
  return save(body, null, user);
}
module.exports = { one, list, publicList, destStats, save, remove, setStatus, duplicate, CATS };
