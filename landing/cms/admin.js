// Admin API (/cms/api/*) and draft preview (/cms/preview/*).
// Every request except login needs a valid session (or API key); every write needs the CSRF token and the right role.
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns').promises;
const crypto = require('crypto');
const { all, get, run, tx, pool, verifyPassword, hashPassword } = require('./db');
const S = require('./schema');
const store = require('./store');
const tours = require('./tours');
const auth = require('./auth');
const { httpErr, slugify } = require('./util');

const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const STARTED = Date.now();

const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const readBody = (req, limit = 1e6) => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > limit) { reject(httpErr(413, 'That upload is too large.')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { const b = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; resolve(b && typeof b === 'object' ? b : {}); } catch { reject(httpErr(400, 'Bad request.')); } });
  req.on('error', reject);
});
const audit = (u, action, entity, detail) => run('INSERT INTO audit ("user", action, entity, detail) VALUES (?,?,?,?)', u && u.email || 'system', action, entity, String(detail || '').slice(0, 300)).catch(() => {});
const repoOf = kind => {
  if (kind === 'tours') return { one: id => tours.one(id), list: q => tours.list(q), save: (b, id, u) => tours.save(b, id, u), remove: ids => tours.remove(ids), status: (ids, s) => tours.setStatus(ids, s), dup: (id, u) => tours.duplicate(id, u), title: r => r.title };
  const r = store.resource(kind);
  return { one: id => store.one(kind, id), list: q => store.list(kind, q), save: (b, id, u) => store.save(kind, b, id, u), remove: ids => store.remove(kind, ids), status: (ids, s, u) => store.setStatus(kind, ids, s, u), dup: (id, u) => store.duplicate(kind, id, u), title: row => row[r.title] };
};
const need = (user, level) => { if (!auth.can(user, level)) throw httpErr(403, level >= 4 ? 'Only a super admin can do that.' : 'Your role is read-only.'); };

// ---------- webhooks (outgoing), with protection against calling internal addresses ----------
const privateIp = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
async function publicUrl(u) {
  const x = new URL(u); if (x.protocol !== 'https:') throw httpErr(400, 'Webhook addresses must start with https://');
  const addrs = await dns.lookup(x.hostname, { all: true }); if (!addrs.length || addrs.some(a => privateIp(a.address))) throw httpErr(400, 'That address points to a private network.');
  return x.toString();
}
async function postHook(i, event, payload) {
  const url = await publicUrl(i.url);
  const r = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'User-Agent': 'LengaiTrails-CMS' }, body: JSON.stringify({ event, site: 'Lengai Trails', data: payload, sent: new Date().toISOString() }), signal: AbortSignal.timeout(6000) });
  return r.status;
}
async function fire(event, payload) {
  try {
    const hooks = await all("SELECT name, url FROM cms_integrations WHERE type = 'Webhook' AND active = 'active' AND (event = ? OR event = 'Any')", event);
    for (const h of hooks) postHook(h, event, payload).catch(e => console.error('[webhook]', h.name, e.message));
  } catch (e) { console.error('[webhook]', e.message); }
}

// ---------- uploads ----------
const SIGS = [['image/png', 'png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47], ['image/jpeg', 'jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff], ['image/gif', 'gif', b => b.slice(0, 4).toString() === 'GIF8'],
  ['image/webp', 'webp', b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'], ['application/pdf', 'pdf', b => b.slice(0, 4).toString() === '%PDF']];
async function upload(body, user) {
  const m = /^data:([a-z\/+.-]+);base64,([A-Za-z0-9+\/=]+)$/.exec(body.data || ''); if (!m) throw httpErr(400, 'Upload a PNG, JPG, WebP, GIF or PDF file.');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 8e6) throw httpErr(400, 'Files must be smaller than 8 MB.');
  const sig = SIGS.find(([mime, , ok]) => mime === m[1] && ok(buf)); if (!sig) throw httpErr(400, 'That file is not a valid PNG, JPG, WebP, GIF or PDF.'); // SVG is refused on purpose: it can carry scripts
  const base = slugify(path.parse(String(body.name || 'file')).name) || 'file', name = base + '-' + crypto.randomBytes(4).toString('hex') + '.' + sig[1];
  fs.writeFileSync(path.join(UPLOADS, name), buf, { flag: 'wx' });
  const row = await get('INSERT INTO media (name, url, size, mime, uploaded_by) VALUES (?,?,?,?,?) RETURNING *', name, 'assets/uploads/' + name, buf.length, sig[0], user.email);
  await audit(user, 'upload', 'media#' + row.id, name); return row;
}

// ---------- reports ----------
const MONEY = k => `COALESCE(SUM(${k}), 0)`;
async function trafficSummary(days) {
  const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const rows = await all('SELECT day, COUNT(*) views, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY day ORDER BY day', since);
  const leadDays = new Set((await all("SELECT DISTINCT to_char(d,'YYYY-MM-DD') d FROM (SELECT created_at d FROM cms_inquiries UNION ALL SELECT created_at FROM cms_bookings) x WHERE d >= ?::date", since)).map(r => r.d));
  const series = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), r = rows.find(x => x.day === d); series.push({ day: d, views: r ? r.views : 0, visitors: r ? r.visitors : 0, lead: leadDays.has(d) }); }
  return { days, series,
    pages: await all('SELECT path, MAX(title) title, COUNT(DISTINCT vh) visitors, COUNT(*) views FROM pageviews WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 12', since),
    countries: await all("SELECT COALESCE(NULLIF(country,''),'??') country, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY 1 ORDER BY 2 DESC LIMIT 20", since),
    refs: await all("SELECT COALESCE(NULLIF(ref,''),'Direct') ref, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY 1 ORDER BY 2 DESC LIMIT 8", since),
    devices: await all('SELECT device, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY device', since),
    totals: await get('SELECT COUNT(*) views, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ?', since) };
}
async function dashboard() {
  const n = async (sql, ...a) => (await get(sql, ...a)).c;
  const today = new Date().toISOString().slice(0, 10);
  const content = ['destinations', 'accommodations', 'blog', 'faqs', 'reviews', 'offers', 'testimonials', 'group'];
  const overview = [{ kind: 'tours', label: 'Tours', total: await n('SELECT COUNT(*) c FROM cms_tours'), published: await n("SELECT COUNT(*) c FROM cms_tours WHERE status = 'published'") }];
  for (const k of content) { const r = S[k]; overview.push({ kind: k, label: r.label, total: await n(`SELECT COUNT(*) c FROM ${r.table}`), published: await n(`SELECT COUNT(*) c FROM ${r.table} WHERE "status" = '${r.publicStatus}'`) }); }
  const drafts = (await all("SELECT id, title, status, updated_at, 'tours' kind FROM cms_tours WHERE status <> 'published' ORDER BY updated_at DESC LIMIT 6"))
    .concat(await all("SELECT id, title, status, updated_at, 'blog' kind FROM cms_blog WHERE status <> 'published' ORDER BY updated_at DESC LIMIT 4"))
    .concat(await all("SELECT id, name title, status, updated_at, 'destinations' kind FROM cms_destinations WHERE status <> 'published' ORDER BY updated_at DESC LIMIT 4"))
    .concat(await all("SELECT id, name title, status, updated_at, 'accommodations' kind FROM cms_accommodations WHERE status <> 'published' ORDER BY updated_at DESC LIMIT 4"))
    .concat(await all("SELECT id, name title, status, updated_at, 'reviews' kind FROM cms_reviews WHERE status = 'pending' ORDER BY updated_at DESC LIMIT 4"))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8).map(r => ({ ...r, type: r.kind === 'tours' ? 'Tour' : S[r.kind].single }));
  return {
    counts: { tours: overview[0].total, published: overview[0].published, bookings: await n('SELECT COUNT(*) c FROM cms_bookings'), newBookings: await n("SELECT COUNT(*) c FROM cms_bookings WHERE status = 'New'"), inquiries: await n('SELECT COUNT(*) c FROM cms_inquiries'), newInquiries: await n("SELECT COUNT(*) c FROM cms_inquiries WHERE status = 'New'"),
      customers: await n('SELECT COUNT(*) c FROM cms_customers'), media: await n('SELECT COUNT(*) c FROM media'), apiKeys: await n('SELECT COUNT(*) c FROM api_keys'), pendingReviews: await n("SELECT COUNT(*) c FROM cms_reviews WHERE status = 'pending'"),
      revenue: (await get(`SELECT ${MONEY('amount_usd')} s FROM cms_invoices WHERE status = 'Paid'`)).s, drafts: overview.reduce((a, o) => a + (o.total - o.published), 0) },
    traffic: await trafficSummary(7), overview, drafts,
    recentInquiries: await all('SELECT id, name, interest, email, status, created_at FROM cms_inquiries ORDER BY id DESC LIMIT 6'),
    recentBookings: await all('SELECT id, reference, customer, tour, start_date, total_usd, status, created_at FROM cms_bookings ORDER BY id DESC LIMIT 6'),
    upcoming: await all("SELECT id, reference, customer, tour, start_date, status FROM cms_bookings WHERE status <> 'Cancelled' AND start_date >= ? ORDER BY start_date LIMIT 6", today),
    tasks: await all("SELECT id, title, assignee, status FROM cms_tasks WHERE status <> 'done' ORDER BY id DESC LIMIT 6"),
    latestMedia: await all("SELECT id, name, url FROM media WHERE mime LIKE 'image/%' ORDER BY id DESC LIMIT 4") };
}

// ---------- preview of a draft on the real public page template ----------
const jsonScript = o => JSON.stringify(o).replace(/</g, '\\u003c').split(String.fromCharCode(8232)).join('\\u2028').split(String.fromCharCode(8233)).join('\\u2029');
async function preview(req, res, url) {
  const user = await auth.current(req);
  if (!user || user.via !== 'session') { res.writeHead(302, { Location: '/cms/' }); return res.end(); }
  const m = /^\/cms\/preview\/([a-z]+)\/(\d+)$/.exec(url.pathname); const r = m && S[m[1]];
  if (!r || !r.preview) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('No preview for this content type.'); }
  const rec = await repoOf(m[1]).one(m[2]); if (!rec) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const data = m[1] === 'tours' ? rec : store.toPublic(r, rec);
  data.preview_status = rec.status;
  let html = fs.readFileSync(path.join(ROOT, r.preview + '.html'), 'utf8');
  const bar = `<div id="previewbar" style="position:fixed;z-index:9999;left:0;right:0;top:0;background:#1e3333;color:#fff;font:700 13px Arial,sans-serif;padding:9px 16px;display:flex;gap:14px;align-items:center;justify-content:center"><span style="background:#d3ae4c;color:#152b2b;border-radius:99px;padding:3px 11px">PREVIEW</span><span>${rec.status === 'published' ? 'This is the published version.' : 'Draft: visitors cannot see this yet.'}</span><a href="/cms/#/${m[1]}/${m[2]}" style="color:#d3ae4c">Back to the editor</a></div><style>body{padding-top:40px}</style>`;
  html = html.replace('</head>', () => `<meta name="robots" content="noindex,nofollow"><script>window.__PREVIEW=${jsonScript(data)};</script></head>`).replace(/<body[^>]*>/, mm => mm + bar);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }); res.end(html);
}

// ---------- the API ----------
async function admin(req, res, url) {
  const p = url.pathname.replace(/^\/cms\/api\//, '').split('/').filter(Boolean), m = req.method, q = url.searchParams;
  try {
    if (p[0] === 'login' && m === 'POST') { const r = await auth.login(req, await readBody(req, 1e4)); await audit(r.user, 'login', 'session', ''); return send(res, 200, { ok: true }, { 'Set-Cookie': r.cookie }); }
    const user = await auth.current(req);
    if (p[0] === 'logout' && m === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': await auth.logout(req) });
    if (!user) return send(res, 401, { error: 'Not signed in' });
    if (m !== 'GET') { if (!auth.csrfOk(req, user)) return send(res, 403, { error: 'Your session check failed. Reload the page and try again.' }); need(user, 2); if (user.via === 'key' && user.role !== 'editor') throw httpErr(403, 'This API key is read-only.'); }

    if (p[0] === 'me') return send(res, 200, { user: { id: user.id, email: user.email, name: user.name, role: user.role }, csrf: user.csrf, schema: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, { label: v.label, single: v.single, title: v.title, fields: v.fields, lists: v.lists, attach: !!v.attach, preview: !!v.preview, statuses: v.statuses, publicStatus: v.publicStatus || null, admin: !!v.admin, ops: !!v.ops, special: v.special || null }])) });
    if (p[0] === 'profile' && m === 'PUT') {
      const b = await readBody(req, 1e4), u = await get('SELECT * FROM users WHERE id = ?', user.id);
      if (b.name !== undefined) await run('UPDATE users SET name = ? WHERE id = ?', String(b.name).trim().slice(0, 80), user.id);
      if (b.new_password) {
        if (!verifyPassword(String(b.current_password || ''), u.pass_hash)) throw httpErr(400, 'Your current password is wrong.');
        if (String(b.new_password).length < 10 || /^(password|12345|qwerty)/i.test(b.new_password)) throw httpErr(400, 'Choose a password of at least 10 characters that is not easy to guess.');
        await run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(String(b.new_password)), user.id);
        await run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', user.id, auth.sha(auth.cookieOf(req, auth.COOKIE) || '')); await audit(user, 'password', 'user#' + user.id, '');
      }
      return send(res, 200, { ok: true });
    }
    if (p[0] === 'dashboard') return send(res, 200, await dashboard());
    if (p[0] === 'traffic') return send(res, 200, await trafficSummary(Math.min(90, Math.max(2, Number(q.get('days')) || 8))));
    if (p[0] === 'search') {
      const term = String(q.get('q') || '').slice(0, 60); if (term.length < 2) return send(res, 200, []);
      const s = '%' + term + '%', out = (await all('SELECT id, title FROM cms_tours WHERE title ILIKE ? LIMIT 8', s)).map(t => ({ type: 'Tour', title: t.title, hash: '#/tours/' + t.id }));
      for (const k of ['destinations', 'accommodations', 'blog', 'faqs', 'bookings', 'inquiries', 'customers']) { const r = S[k]; for (const row of await all(`SELECT id, ${'"' + r.title + '"'} t FROM ${r.table} WHERE ${'"' + r.title + '"'} ILIKE ? LIMIT 4`, s)) out.push({ type: r.single, title: row.t, hash: '#/' + k + '/' + row.id }); }
      return send(res, 200, out);
    }

    // ----- content: one set of routes for every type, including tours -----
    if (p[0] === 'r' && S[p[1]]) {
      const kind = p[1], R = S[kind], repo = repoOf(kind);
      if (R.admin) need(user, 4);
      if (!p[2]) {
        if (m === 'GET') return send(res, 200, await repo.list({ q: q.get('q'), status: q.get('status'), category: q.get('category'), limit: q.get('limit'), offset: q.get('offset'), sort: q.get('sort') }));
        if (m === 'POST') { const rec = await repo.save(await readBody(req, 4e5), null, user); await audit(user, 'create', kind + '#' + rec.id, repo.title(rec)); return send(res, 201, rec); }
      } else if (/^\d+$/.test(p[2]) && !p[3]) {
        if (m === 'GET') { const rec = await repo.one(p[2]); return rec ? send(res, 200, rec) : send(res, 404, { error: 'Not found' }); }
        if (m === 'PUT') { const rec = await repo.save(await readBody(req, 4e5), p[2], user); await audit(user, 'update', kind + '#' + p[2], repo.title(rec)); if (kind === 'bookings' && rec.status === 'Paid') fire('Booking paid', rec); return send(res, 200, rec); }
        if (m === 'DELETE') { await repo.remove([p[2]]); await audit(user, 'delete', kind + '#' + p[2], ''); return send(res, 200, { ok: true }); }
      } else if (/^\d+$/.test(p[2]) && p[3] === 'attachments' && R.attach) {
        if (m === 'GET') return send(res, 200, await store.attachments(kind, p[2]));
        if (m === 'POST') { const b = await readBody(req, 1e4); return send(res, 201, await store.attach(kind, p[2], Number(b.media_id), b.role, b.caption)); }
        if (m === 'PUT' && p[4]) return send(res, 200, await store.editAttachment(kind, p[2], p[4], await readBody(req, 1e4)));
        if (m === 'DELETE' && p[4]) return send(res, 200, await store.detach(kind, p[2], p[4]));
      }
    }
    if (p[0] === 'bulk' && m === 'POST' && S[p[1]]) {
      const b = await readBody(req, 1e5), ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 500), repo = repoOf(p[1]);
      if (!ids.length) throw httpErr(400, 'Nothing selected.'); if (S[p[1]].admin) need(user, 4);
      if (b.action === 'delete') await repo.remove(ids); else if (['publish', 'draft'].includes(b.action)) { const R = S[p[1]]; await repo.status(ids, b.action === 'publish' ? R.publicStatus : (R.statuses.includes('draft') ? 'draft' : R.statuses.find(s => s !== R.publicStatus)), user); } else throw httpErr(400, 'Unknown action.');
      await audit(user, 'bulk ' + b.action, p[1], ids.length + ' items'); return send(res, 200, { ok: true, n: ids.length });
    }
    if (p[0] === 'duplicate' && m === 'POST' && S[p[1]] && /^\d+$/.test(p[2] || '')) { const rec = await repoOf(p[1]).dup(p[2], user); await audit(user, 'duplicate', p[1] + '#' + rec.id, ''); return send(res, 201, { id: rec.id }); }
    if (p[0] === 'export' && m === 'GET' && S[p[1]]) {
      const kind = p[1], csv = v => { v = v == null ? '' : v instanceof Date ? v.toISOString() : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; // leading =,+,-,@ is neutralised so spreadsheets never run it as a formula
      const head = kind === 'tours' ? ['id', 'title', 'slug', 'category', 'subcategory', 'days', 'price_from', 'status', 'updated_at'] : ['id'].concat(S[kind].fields.map(f => f.k)).concat(['created_at']);
      if (S[kind].admin) need(user, 4);
      const rows = (await repoOf(kind).list({ limit: 200 })).rows;
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
      return res.end('﻿' + [head.join(',')].concat(rows.map(r => head.map(h => csv(r[h])).join(','))).join('\r\n'));
    }
    if (p[0] === 'webhook-test' && m === 'POST') { need(user, 4); const i = await get('SELECT * FROM cms_integrations WHERE id = ?', p[1]); if (!i) throw httpErr(404, 'Not found'); try { const code = await postHook(i, 'Test', { message: 'Test from the Lengai CMS' }); return send(res, 200, { ok: code < 400, status: code }); } catch (e) { return send(res, 200, { ok: false, error: e.message }); } }

    // ----- media -----
    if (p[0] === 'media') {
      if (m === 'GET') {
        const dbRows = await all('SELECT id, name, url, size, mime, alt, created_at FROM media ORDER BY id DESC');
        const known = new Set(dbRows.map(r => r.url));
        const built = fs.readdirSync(path.join(ROOT, 'assets', 'img')).filter(f => /\.(webp|jpg|png)$/.test(f)).map(f => ({ id: null, name: f, url: 'assets/img/' + f, builtin: true, mime: 'image/' + f.split('.').pop() })).filter(f => !known.has(f.url));
        return send(res, 200, dbRows.concat(built));
      }
      if (m === 'POST' && p[1] === 'import') { const b = await readBody(req, 1e4); const u = String(b.url || ''); if (!/^assets\/img\/[\w.-]+$/.test(u) || !fs.existsSync(path.join(ROOT, u))) throw httpErr(400, 'Unknown file.'); const ex = await get('SELECT * FROM media WHERE url = ?', u); return send(res, 200, ex || await get('INSERT INTO media (name, url, size, mime, uploaded_by) VALUES (?,?,?,?,?) RETURNING *', path.basename(u), u, fs.statSync(path.join(ROOT, u)).size, 'image/' + u.split('.').pop().replace('jpg', 'jpeg'), 'site')); }
      if (m === 'POST') return send(res, 201, await upload(await readBody(req, 12e6), user));
      if (m === 'PUT' && /^\d+$/.test(p[1] || '')) { const b = await readBody(req, 1e4); await run('UPDATE media SET alt = ? WHERE id = ?', String(b.alt || '').slice(0, 200), p[1]); return send(res, 200, { ok: true }); }
      if (m === 'DELETE' && /^\d+$/.test(p[1] || '')) { const r = await get('SELECT * FROM media WHERE id = ?', p[1]); if (r) { if (r.url.startsWith('assets/uploads/')) { try { fs.unlinkSync(path.join(UPLOADS, path.basename(r.url))); } catch {} } await run('DELETE FROM media WHERE id = ?', p[1]); await audit(user, 'delete', 'media#' + p[1], r.name); } return send(res, 200, { ok: true }); }
    }

    // ----- reports / status / audit -----
    if (p[0] === 'reports') return send(res, 200, {
      byStatus: await all(`SELECT status, COUNT(*) n, ${MONEY('total_usd')} usd FROM cms_bookings GROUP BY status`),
      topTours: await all(`SELECT tour, COUNT(*) n, ${MONEY('total_usd')} usd FROM cms_bookings WHERE status <> 'Cancelled' GROUP BY tour ORDER BY 2 DESC LIMIT 10`),
      invoices: await all(`SELECT status, COUNT(*) n, ${MONEY('amount_usd')} usd FROM cms_invoices GROUP BY status`),
      inquiries: await all('SELECT status, COUNT(*) n FROM cms_inquiries GROUP BY status'),
      catalog: await all('SELECT category, COUNT(*) n, MIN(price_from) min_price, MAX(price_from) max_price FROM cms_tours GROUP BY category') });
    if (p[0] === 'status') {
      const size = await get('SELECT pg_database_size(current_database()) s, current_database() n, version() v'), tables = [];
      for (const t of ['cms_tours', 'cms_tour_days', 'cms_destinations', 'cms_accommodations', 'cms_blog', 'cms_bookings', 'cms_inquiries', 'media', 'users', 'pageviews', 'audit']) tables.push({ table: t, rows: (await get(`SELECT COUNT(*) c FROM ${t}`)).c });
      return send(res, 200, { node: process.version, platform: os.platform() + ' ' + os.release(), uptime_s: Math.round((Date.now() - STARTED) / 1000), memory_mb: Math.round(process.memoryUsage().rss / 1048576), db: size.n + ' (' + String(size.v || '').split(' ').slice(0, 2).join(' ') + ')', db_kb: Math.round(size.s / 1024), tables, time: new Date().toISOString() });
    }

    // ----- super admin only -----
    need(user, 4);
    if (p[0] === 'audit') return send(res, 200, await all('SELECT id, ts, "user", action, entity, detail FROM audit ORDER BY id DESC LIMIT 300'));
    if (p[0] === 'settings') {
      const KEYS = ['site_name', 'tagline', 'contact_email', 'contact_phone', 'address', 'currency', 'notify_email', 'seo_title', 'seo_description'];
      if (m === 'GET') return send(res, 200, Object.fromEntries((await all('SELECT key, value FROM settings WHERE key = ANY(?::text[])', KEYS)).map(r => [r.key, r.value])));
      const b = await readBody(req, 2e4); for (const k of KEYS) if (b[k] !== undefined) await run('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', k, String(b[k]).slice(0, 500));
      await audit(user, 'update', 'settings', ''); return send(res, 200, { ok: true });
    }
    if (p[0] === 'users') {
      if (m === 'GET') return send(res, 200, await all('SELECT id, email, name, role, active, last_login, created_at FROM users ORDER BY id'));
      const b = await readBody(req, 1e4);
      if (m === 'POST') {
        if (!/^\S+@\S+\.\S+$/.test(b.email || '') || String(b.password || '').length < 10) throw httpErr(400, 'A valid email and a password of at least 10 characters are required.');
        if (!['super_admin', 'editor', 'viewer'].includes(b.role)) b.role = 'editor';
        try { await run('INSERT INTO users (email, name, role, pass_hash) VALUES (?,?,?,?)', String(b.email).trim().toLowerCase(), String(b.name || '').slice(0, 80), b.role, hashPassword(String(b.password))); } catch { throw httpErr(400, 'That email is already a user.'); }
        await audit(user, 'create', 'user', b.email); return send(res, 201, { ok: true });
      }
      if (m === 'PUT') {
        if (Number(p[1]) === user.id && (b.active === 0 || (b.role && b.role !== 'super_admin'))) throw httpErr(400, 'You cannot demote or disable yourself.');
        if (b.role && ['super_admin', 'editor', 'viewer'].includes(b.role)) await run('UPDATE users SET role = ? WHERE id = ?', b.role, p[1]);
        if (b.active !== undefined) { await run('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, p[1]); if (!b.active) await run('DELETE FROM sessions WHERE user_id = ?', p[1]); }
        if (b.password) { if (String(b.password).length < 10) throw httpErr(400, 'Password must be at least 10 characters.'); await run('UPDATE users SET pass_hash = ?, failed = 0, locked_until = 0 WHERE id = ?', hashPassword(String(b.password)), p[1]); await run('DELETE FROM sessions WHERE user_id = ?', p[1]); }
        await audit(user, 'update', 'user#' + p[1], ''); return send(res, 200, { ok: true });
      }
      if (m === 'DELETE') { if (Number(p[1]) === user.id) throw httpErr(400, 'You cannot delete yourself.'); await run('DELETE FROM users WHERE id = ?', p[1]); await audit(user, 'delete', 'user#' + p[1], ''); return send(res, 200, { ok: true }); }
    }
    if (p[0] === 'keys') {
      if (m === 'GET') return send(res, 200, await all('SELECT id, name, prefix, scope, created_at, last_used FROM api_keys ORDER BY id DESC'));
      if (m === 'POST') { const b = await readBody(req, 5e3), key = auth.newKey(); await run('INSERT INTO api_keys (name, key_hash, prefix, scope) VALUES (?,?,?,?)', String(b.name || 'Key').slice(0, 60), auth.hashKey(key), key.slice(0, 7), b.scope === 'write' ? 'write' : 'read'); await audit(user, 'create', 'api_key', b.name); return send(res, 201, { key }); }
      if (m === 'DELETE') { await run('DELETE FROM api_keys WHERE id = ?', p[1]); await audit(user, 'delete', 'api_key#' + p[1], ''); return send(res, 200, { ok: true }); }
    }
    return send(res, 404, { error: 'Unknown endpoint' });
  } catch (e) {
    if (e.code && Number.isInteger(e.code) && e.code >= 400 && e.code < 600) return send(res, e.code, { error: e.message });
    console.error('[admin]', e); return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
module.exports = { admin, preview, send, readBody, fire, audit };
