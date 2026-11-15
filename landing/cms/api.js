// JSON API for the CMS (/cms/api/*) and the public site (/api/*). PostgreSQL via ./db
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { all, get, run, insert, P, J, tourFromBody, hashPassword, verifyPassword } = require('./db');
const SCHEMA = require('./schema');

const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const STARTED = Date.now();

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
};
const readBody = (req, limit = 12e6) => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(Object.assign(new Error('Bad JSON'), { code: 400 })); } });
  req.on('error', reject);
});
const cookie = (req, name) => (req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === name)?.[1];
const slugify = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const audit = (u, action, entity, detail) => run('INSERT INTO audit ("user",action,entity,detail) VALUES (?,?,?,?)', u?.email || 'system', action, entity, detail || '').catch(() => {});
const MONEY = k => `COALESCE(SUM((data->>'${k}')::numeric),0)`;

// ---------- auth ----------
const attempts = new Map();
async function currentUser(req) {
  const t = cookie(req, 'cms_session');
  if (t) {
    const s = await get('SELECT s.expires, u.email, u.name, u.role, u.active, u.id uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', t);
    if (s && s.expires > Date.now() && s.active) return { id: s.uid, email: s.email, name: s.name, role: s.role };
  }
  const key = req.headers['x-api-key'];
  if (key) {
    const k = await get('SELECT * FROM api_keys WHERE key_hash = ?', crypto.createHash('sha256').update(key).digest('hex'));
    if (k) { await run('UPDATE api_keys SET last_used = now() WHERE id = ?', k.id); return { id: 0, email: 'api:' + k.name, name: k.name, role: 'editor' }; }
  }
  return null;
}
const can = (u, need) => ({ super_admin: 4, admin: 3, editor: 2, viewer: 1 }[u.role] || 0) >= need;

// ---------- helpers ----------
const recordOut = r => ({ id: r.id, kind: r.kind, title: r.title, status: r.status, created_at: r.created_at, updated_at: r.updated_at, ...P(r.data, {}) });
async function nextRef(prefix) {
  const n = (await get('SELECT COUNT(*) c FROM records WHERE kind = ?', prefix === 'BK' ? 'bookings' : 'invoices')).c + 1001;
  return prefix + '-' + new Date().getFullYear() + '-' + n;
}
// every booking makes sure a customer record exists (matched by email)
async function upsertCustomer(b) {
  const ex = await get("SELECT id, data FROM records WHERE kind='customers' AND lower(data->>'email') = lower(?)", b.email);
  if (ex) { const d = P(ex.data, {}); d.trips = (Number(d.trips) || 0) + 0; await run('UPDATE records SET updated_at=now() WHERE id=?', ex.id); return; }
  await run('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', 'customers', b.customer, null, JSON.stringify({ name: b.customer, email: b.email, phone: b.phone || '', country: b.country || '', trips: 0 }));
}
// estimated price per person for a package and group size, from its price table
function estimatePerPerson(t, n) {
  const tiers = (t.price_tiers || []).slice().sort((a, b) => a.pax - b.pax);
  if (tiers.length) { const hit = tiers.filter(r => r.pax <= n).pop() || tiers[0]; return hit.usd; }
  return t.price_single || t.price_from || null;
}
async function saveRecord(kind, body, id, user) {
  const sch = SCHEMA[kind];
  const data = {};
  sch.fields.forEach(f => { if (body[f.k] !== undefined) data[f.k] = f.t === 'number' && body[f.k] !== '' ? Number(body[f.k]) : body[f.k]; });
  for (const f of sch.fields) if (f.auto && !id && !data[f.k]) data[f.k] = await nextRef(f.auto);
  const prev = id ? await get('SELECT data FROM records WHERE id = ? AND kind = ?', id, kind) : null;
  const merged = { ...(prev ? P(prev.data, {}) : {}), ...data };
  const missing = sch.fields.find(f => f.req && !String(merged[f.k] ?? '').trim());
  if (missing) throw Object.assign(new Error(missing.l + ' is required'), { code: 400 });
  if (['blog', 'pages', 'destinations', 'accommodations'].includes(kind) && !id && !data.slug) data.slug = slugify(data[sch.title]);
  if (kind === 'bookings' && data.email) await upsertCustomer(data);
  const title = String(merged[sch.title] ?? '').slice(0, 200);
  const status = merged.status || null;
  if (id) {
    const ex = await get('SELECT * FROM records WHERE id = ? AND kind = ?', id, kind);
    if (!ex) throw Object.assign(new Error('Not found'), { code: 404 });
    await run('UPDATE records SET title=?, status=?, data=?, updated_at=now() WHERE id=?', title, status, JSON.stringify({ ...P(ex.data, {}), ...data }), id);
    await audit(user, 'update', kind + '#' + id, title);
    return recordOut(await get('SELECT * FROM records WHERE id=?', id));
  }
  const nid = await insert('INSERT INTO records (kind,title,status,data) VALUES (?,?,?,?)', kind, title, status, JSON.stringify(data));
  await audit(user, 'create', kind + '#' + nid, title);
  return recordOut(await get('SELECT * FROM records WHERE id=?', nid));
}

async function trafficSummary(days) {
  const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const rows = await all('SELECT day, COUNT(*) views, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY day ORDER BY day', since);
  const leadDays = new Set((await all("SELECT DISTINCT to_char(created_at,'YYYY-MM-DD') d FROM records WHERE kind IN ('inquiries','bookings') AND created_at >= ?::date", since)).map(r => r.d));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const r = rows.find(x => x.day === d);
    series.push({ day: d, views: r?.views || 0, visitors: r?.visitors || 0, lead: leadDays.has(d) });
  }
  const pages = await all('SELECT path, MAX(title) title, COUNT(DISTINCT vh) visitors, COUNT(*) views FROM pageviews WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 12', since);
  const countries = await all("SELECT COALESCE(NULLIF(country,''),'??') country, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY 1 ORDER BY 2 DESC LIMIT 20", since);
  const refs = await all("SELECT COALESCE(NULLIF(ref,''),'Direct') ref, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY 1 ORDER BY 2 DESC LIMIT 8", since);
  const devices = await all('SELECT device, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ? GROUP BY device', since);
  const totals = await get('SELECT COUNT(*) views, COUNT(DISTINCT vh) visitors FROM pageviews WHERE day >= ?', since);
  return { days, series, pages, countries, refs, devices, totals };
}

// ---------- admin API ----------
async function admin(req, res, url) {
  const p = url.pathname.replace(/^\/cms\/api\//, '').split('/').filter(Boolean);
  const m = req.method;
  const q = url.searchParams;

  if (p[0] === 'login' && m === 'POST') {
    const ip = req.socket.remoteAddress; const a = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 6e4) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 8) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const b = await readBody(req);
    const u = await get('SELECT * FROM users WHERE email = ? AND active = 1', String(b.email || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(b.password || ''), u.pass_hash)) { a.n++; attempts.set(ip, a); return send(res, 401, { error: 'Wrong email or password.' }); }
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    await run('INSERT INTO sessions (token,user_id,expires) VALUES (?,?,?)', token, u.id, Date.now() + 7 * 864e5);
    await run('UPDATE users SET last_login = now() WHERE id = ?', u.id);
    await run('DELETE FROM sessions WHERE expires < ?', Date.now());
    await audit(u, 'login', 'session', '');
    return send(res, 200, { ok: true }, { 'Set-Cookie': `cms_session=${token}; Path=/cms; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}` + (process.env.NODE_ENV === 'production' ? '; Secure' : '') });
  }
  const user = await currentUser(req);
  if (p[0] === 'logout' && m === 'POST') {
    const t = cookie(req, 'cms_session'); if (t) await run('DELETE FROM sessions WHERE token = ?', t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'cms_session=; Path=/cms; Max-Age=0' });
  }
  if (!user) return send(res, 401, { error: 'Not signed in' });
  if (m !== 'GET' && !can(user, 2)) return send(res, 403, { error: 'Your role is read-only.' });

  if (p[0] === 'me') return send(res, 200, { user, schema: Object.fromEntries(Object.entries(SCHEMA).map(([k, v]) => [k, { label: v.label, single: v.single, title: v.title, fields: v.fields }])) });

  if (p[0] === 'profile' && m === 'PUT') {
    const b = await readBody(req);
    const u = await get('SELECT * FROM users WHERE id = ?', user.id);
    if (b.name) await run('UPDATE users SET name = ? WHERE id = ?', b.name, user.id);
    if (b.new_password) {
      if (!verifyPassword(String(b.current_password || ''), u.pass_hash)) return send(res, 400, { error: 'Current password is wrong.' });
      if (String(b.new_password).length < 10) return send(res, 400, { error: 'New password must be at least 10 characters.' });
      await run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(b.new_password), user.id);
      await audit(user, 'password', 'user#' + user.id, '');
    }
    return send(res, 200, { ok: true });
  }

  if (p[0] === 'dashboard') {
    const c = async k => (await get('SELECT COUNT(*) c FROM records WHERE kind = ?', k)).c;
    const open = async k => (await get("SELECT COUNT(*) c FROM records WHERE kind = ? AND status = 'New'", k)).c;
    const revenue = (await get(`SELECT ${MONEY('amount_usd')} s FROM records WHERE kind='invoices' AND status='Paid'`)).s;
    return send(res, 200, {
      counts: { tours: (await get('SELECT COUNT(*) c FROM tours')).c, published: (await get("SELECT COUNT(*) c FROM tours WHERE status='published'")).c, bookings: await c('bookings'), newBookings: await open('bookings'), inquiries: await c('inquiries'), newInquiries: await open('inquiries'), customers: await c('customers'), posts: await c('blog'), reviews: await c('reviews'), revenue },
      traffic: await trafficSummary(7),
      recentInquiries: (await all("SELECT * FROM records WHERE kind='inquiries' ORDER BY id DESC LIMIT 6")).map(recordOut),
      recentBookings: (await all("SELECT * FROM records WHERE kind='bookings' ORDER BY id DESC LIMIT 6")).map(recordOut),
      tasks: (await all("SELECT * FROM records WHERE kind='tasks' AND status != 'done' ORDER BY id DESC LIMIT 6")).map(recordOut)
    });
  }
  if (p[0] === 'traffic') return send(res, 200, await trafficSummary(Math.min(90, Math.max(2, Number(q.get('days')) || 8))));

  if (p[0] === 'search') {
    const term = q.get('q') || '';
    if (term.length < 2) return send(res, 200, []);
    const s = '%' + term + '%';
    const out = (await all('SELECT id, title FROM tours WHERE title ILIKE ? LIMIT 8', s)).map(t => ({ type: 'Tour', title: t.title, hash: '#/tours/' + t.id }));
    (await all('SELECT id, kind, title FROM records WHERE title ILIKE ? OR data::text ILIKE ? LIMIT 12', s, s)).forEach(r => out.push({ type: SCHEMA[r.kind]?.single || r.kind, title: r.title, hash: '#/' + r.kind + '/' + r.id }));
    return send(res, 200, out);
  }

  // ----- tours -----
  if (p[0] === 'tours') {
    if (m === 'GET' && !p[1]) {
      const where = []; const args = [];
      if (q.get('q')) { where.push('title ILIKE ?'); args.push('%' + q.get('q') + '%'); }
      if (q.get('category')) { where.push('category = ?'); args.push(q.get('category')); }
      if (q.get('status')) { where.push('status = ?'); args.push(q.get('status')); }
      return send(res, 200, await all('SELECT id, slug, title, category, subcategory, days, price_from, status, featured, image, updated_at FROM tours' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY sort, id', ...args));
    }
    if (m === 'GET') { const r = /^\d+$/.test(p[1]) ? await get('SELECT * FROM tours WHERE id = ?', p[1]) : null; return r ? send(res, 200, r) : send(res, 404, { error: 'Not found' }); }
    if (m === 'POST' || m === 'PUT') {
      const b = await readBody(req);
      if (!String(b.title || '').trim() && m === 'POST') return send(res, 400, { error: 'Title is required' });
      const o = tourFromBody(b);
      if (m === 'POST') {
        o.slug = slugify(o.slug || o.title); o.category = o.category || 'safari';
        if (await get('SELECT 1 x FROM tours WHERE slug = ?', o.slug)) o.slug += '-' + Date.now().toString(36).slice(-4);
        const cols = Object.keys(o);
        const id = await insert(`INSERT INTO tours (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map(c => o[c]));
        await audit(user, 'create', 'tour#' + id, o.title);
        return send(res, 201, await get('SELECT * FROM tours WHERE id = ?', id));
      }
      if (o.slug !== undefined) o.slug = slugify(o.slug);
      const cols = Object.keys(o);
      if (cols.length) {
        try { await run(`UPDATE tours SET ${cols.map(c => c + '=?').join(',')}, updated_at=now() WHERE id=?`, ...cols.map(c => o[c]), p[1]); }
        catch (e) { return send(res, 400, { error: e.code === '23505' ? 'That slug is already used by another package.' : e.message }); }
      }
      await audit(user, 'update', 'tour#' + p[1], o.title || '');
      return send(res, 200, await get('SELECT * FROM tours WHERE id = ?', p[1]));
    }
    if (m === 'DELETE') { const t = await get('SELECT title FROM tours WHERE id = ?', p[1]); await run('DELETE FROM tours WHERE id = ?', p[1]); await audit(user, 'delete', 'tour#' + p[1], t?.title); return send(res, 200, { ok: true }); }
  }

  // ----- generic records -----
  if (p[0] === 'r' && SCHEMA[p[1]]) {
    const kind = p[1];
    if (m === 'GET' && !p[2]) {
      const where = ['kind = ?']; const args = [kind];
      if (q.get('q')) { where.push('(title ILIKE ? OR data::text ILIKE ?)'); args.push('%' + q.get('q') + '%', '%' + q.get('q') + '%'); }
      if (q.get('status')) { where.push('status = ?'); args.push(q.get('status')); }
      return send(res, 200, (await all('SELECT * FROM records WHERE ' + where.join(' AND ') + ' ORDER BY id DESC LIMIT 500', ...args)).map(recordOut));
    }
    if (m === 'GET') { const r = /^\d+$/.test(p[2]) ? await get('SELECT * FROM records WHERE id = ? AND kind = ?', p[2], kind) : null; return r ? send(res, 200, recordOut(r)) : send(res, 404, { error: 'Not found' }); }
    if (m === 'POST') return send(res, 201, await saveRecord(kind, await readBody(req), null, user));
    if (m === 'PUT') return send(res, 200, await saveRecord(kind, await readBody(req), p[2], user));
    if (m === 'DELETE') { await run('DELETE FROM records WHERE id = ? AND kind = ?', p[2], kind); await audit(user, 'delete', kind + '#' + p[2], ''); return send(res, 200, { ok: true }); }
  }

  // ----- media -----
  if (p[0] === 'media') {
    if (m === 'GET') {
      const built = fs.readdirSync(path.join(ROOT, 'assets', 'img')).filter(f => /\.(webp|jpg|png)$/.test(f)).map(f => ({ id: 'b-' + f, name: f, url: 'assets/img/' + f, builtin: true }));
      return send(res, 200, (await all('SELECT * FROM media ORDER BY id DESC')).concat(built));
    }
    if (m === 'POST') {
      const b = await readBody(req, 14e6);
      const mm = /^data:(image\/(png|jpeg|webp|gif|svg\+xml));base64,(.+)$/.exec(b.data || '');
      if (!mm) return send(res, 400, { error: 'Only png, jpg, webp, gif or svg images are accepted.' });
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[mm[1]];
      const buf = Buffer.from(mm[3], 'base64');
      if (buf.length > 8e6) return send(res, 400, { error: 'Image is larger than 8 MB.' });
      const name = slugify(path.parse(b.name || 'image').name) + '-' + Date.now().toString(36) + '.' + ext;
      fs.writeFileSync(path.join(UPLOADS, name), buf);
      const id = await insert('INSERT INTO media (name,url,size,mime) VALUES (?,?,?,?)', name, 'assets/uploads/' + name, buf.length, mm[1]);
      await audit(user, 'upload', 'media#' + id, name);
      return send(res, 201, { id, name, url: 'assets/uploads/' + name, size: buf.length });
    }
    if (m === 'DELETE') {
      const r = /^\d+$/.test(p[1]) ? await get('SELECT * FROM media WHERE id = ?', p[1]) : null;
      if (r) { try { fs.unlinkSync(path.join(UPLOADS, path.basename(r.url))); } catch {} await run('DELETE FROM media WHERE id = ?', p[1]); await audit(user, 'delete', 'media#' + p[1], r.name); }
      return send(res, 200, { ok: true });
    }
  }

  // ----- reports / status / audit -----
  if (p[0] === 'reports') {
    return send(res, 200, {
      byStatus: await all(`SELECT status, COUNT(*) n, ${MONEY('total_usd')} usd FROM records WHERE kind='bookings' GROUP BY status`),
      topTours: await all(`SELECT data->>'tour' tour, COUNT(*) n, ${MONEY('total_usd')} usd FROM records WHERE kind='bookings' AND status != 'Cancelled' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      invoices: await all(`SELECT status, COUNT(*) n, ${MONEY('amount_usd')} usd FROM records WHERE kind='invoices' GROUP BY status`),
      inquiries: await all("SELECT status, COUNT(*) n FROM records WHERE kind='inquiries' GROUP BY status"),
      catalog: await all('SELECT category, COUNT(*) n, MIN(price_from) min_price, MAX(price_from) max_price FROM tours GROUP BY category')
    });
  }
  if (p[0] === 'status') {
    const size = (await get('SELECT pg_database_size(current_database()) s, current_database() n, version() v')) || {};
    const tables = [];
    for (const t of ['tours', 'records', 'users', 'media', 'pageviews', 'audit']) tables.push({ table: t, rows: (await get(`SELECT COUNT(*) c FROM ${t}`)).c });
    return send(res, 200, { node: process.version, platform: os.platform() + ' ' + os.release(), uptime_s: Math.round((Date.now() - STARTED) / 1000), memory_mb: Math.round(process.memoryUsage().rss / 1048576), db_file: size.n + ' (' + String(size.v || '').split(' ').slice(0, 2).join(' ') + ')', db_kb: Math.round(size.s / 1024), tables, time: new Date().toISOString() });
  }

  // ----- admin-only -----
  if (!can(user, 4)) return send(res, 403, { error: 'Super admin only.' });
  if (p[0] === 'audit') return send(res, 200, await all('SELECT id, ts, "user", action, entity, detail FROM audit ORDER BY id DESC LIMIT 300'));
  if (p[0] === 'settings') {
    if (m === 'GET') return send(res, 200, Object.fromEntries((await all('SELECT * FROM settings')).map(r => [r.key, r.value])));
    const b = await readBody(req);
    for (const [k, v] of Object.entries(b)) await run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', String(k).slice(0, 60), String(v).slice(0, 2000));
    await audit(user, 'update', 'settings', Object.keys(b).join(','));
    return send(res, 200, { ok: true });
  }
  if (p[0] === 'users') {
    if (m === 'GET') return send(res, 200, await all('SELECT id,email,name,role,active,last_login,created_at FROM users ORDER BY id'));
    const b = await readBody(req);
    if (m === 'POST') {
      if (!/^\S+@\S+\.\S+$/.test(b.email || '') || String(b.password || '').length < 10) return send(res, 400, { error: 'Valid email and a password of at least 10 characters are required.' });
      try { await run('INSERT INTO users (email,name,role,pass_hash) VALUES (?,?,?,?)', b.email.trim().toLowerCase(), b.name || '', ['super_admin', 'editor', 'viewer'].includes(b.role) ? b.role : 'editor', hashPassword(b.password)); }
      catch { return send(res, 400, { error: 'That email is already a user.' }); }
      await audit(user, 'create', 'user', b.email); return send(res, 201, { ok: true });
    }
    if (m === 'PUT') {
      if (Number(p[1]) === user.id && (b.active === 0 || (b.role && b.role !== 'super_admin'))) return send(res, 400, { error: 'You cannot demote or disable yourself.' });
      if (b.role) await run('UPDATE users SET role = ? WHERE id = ?', b.role, p[1]);
      if (b.active !== undefined) await run('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, p[1]);
      if (b.password) { if (String(b.password).length < 10) return send(res, 400, { error: 'Password must be at least 10 characters.' }); await run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(b.password), p[1]); }
      await audit(user, 'update', 'user#' + p[1], ''); return send(res, 200, { ok: true });
    }
    if (m === 'DELETE') { if (Number(p[1]) === user.id) return send(res, 400, { error: 'You cannot delete yourself.' }); await run('DELETE FROM users WHERE id = ?', p[1]); await audit(user, 'delete', 'user#' + p[1], ''); return send(res, 200, { ok: true }); }
  }
  if (p[0] === 'keys') {
    if (m === 'GET') return send(res, 200, await all('SELECT id,name,prefix,created_at,last_used FROM api_keys ORDER BY id DESC'));
    if (m === 'POST') {
      const b = await readBody(req); const key = 'lt_' + crypto.randomBytes(24).toString('base64url');
      await run('INSERT INTO api_keys (name,key_hash,prefix) VALUES (?,?,?)', String(b.name || 'Key').slice(0, 60), crypto.createHash('sha256').update(key).digest('hex'), key.slice(0, 7));
      await audit(user, 'create', 'api_key', b.name); return send(res, 201, { key });
    }
    if (m === 'DELETE') { await run('DELETE FROM api_keys WHERE id = ?', p[1]); await audit(user, 'delete', 'api_key#' + p[1], ''); return send(res, 200, { ok: true }); }
  }
  return send(res, 404, { error: 'Unknown endpoint' });
}

// ---------- public API ----------
const pubRate = new Map();
const limited = (ip, key, max) => { const k = key + ip; const a = pubRate.get(k) || { n: 0, t: Date.now() }; if (Date.now() - a.t > 6e4) { a.n = 0; a.t = Date.now(); } a.n++; pubRate.set(k, a); return a.n > max; };
// Route shown on cards: the places named in the day titles, in order (e.g. Arusha, Tarangire, Serengeti).
const PLACES = [['Arusha', /arusha/i], ['Tarangire', /tarangire/i], ['Lake Manyara', /manyara|karatu/i], ['Serengeti', /serengeti|seronera|ndutu/i], ['Ngorongoro', /ngorongoro/i], ['Lake Eyasi', /eyasi/i], ['Lake Natron', /natron|lengai/i],
  ['Mikumi', /mikumi/i], ['Nyerere', /nyerere|selous/i], ['Ruaha', /ruaha/i], ['Zanzibar', /zanzibar|stone town/i], ['Kilimanjaro', /kilimanjaro|marangu|machame|lemosho|rongai|umbwe|kibo|horombo|mandara/i], ['Mount Meru', /meru|momella/i], ['Usambara', /usambara|lushoto/i]];
function routeOf(itin) {
  const seen = [];
  for (const d of Array.isArray(itin) ? itin : []) for (const [n, re] of PLACES) if (re.test(String(d.title || '').replace(/kilimanjaro\s+(international\s+)?airport|jro/gi, '')) && !seen.includes(n)) seen.push(n);
  return seen.join(' · ');
}
const PUBLIC_TOUR_COLS = 'id, slug, title, category, subcategory, tags, type, days, price_from, price_note, image, featured';

async function pub(req, res, url) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const ip = req.socket.remoteAddress || '';
  if (p[0] === 'tours' && req.method === 'GET') {
    if (p[1]) {
      const r = await get("SELECT * FROM tours WHERE slug = ? AND status = 'published'", p[1]);
      return r ? send(res, 200, r, { 'Cache-Control': 'public, max-age=60' }) : send(res, 404, { error: 'Not found' });
    }
    const where = ["status = 'published'"]; const args = [];
    if (url.searchParams.get('category')) { where.push('category = ?'); args.push(url.searchParams.get('category')); }
    if (url.searchParams.get('tag')) { where.push('tags @> ?::jsonb'); args.push(JSON.stringify([url.searchParams.get('tag')])); }
    if (url.searchParams.get('sub')) { where.push('subcategory = ?'); args.push(url.searchParams.get('sub')); }
    if (url.searchParams.get('mention')) { where.push('(title ILIKE ? OR itinerary::text ILIKE ?)'); args.push('%' + url.searchParams.get('mention') + '%', '%' + url.searchParams.get('mention') + '%'); }
    const rows = await all(`SELECT ${PUBLIC_TOUR_COLS}, itinerary FROM tours WHERE ${where.join(' AND ')} ORDER BY sort, id`, ...args);
    return send(res, 200, rows.map(r => { const route = routeOf(r.itinerary); delete r.itinerary; return { ...r, route }; }), { 'Cache-Control': 'public, max-age=60' });
  }
  if (p[0] === 'content' && req.method === 'GET') {
    const kinds = { faqs: 'faqs', reviews: 'reviews', testimonials: 'testimonials', offers: 'offers', departures: 'group', blog: 'blog', destinations: 'destinations', accommodations: 'accommodations', pages: 'pages' };
    const k = kinds[p[1]]; if (!k) return send(res, 404, { error: 'Unknown' });
    const okStatus = k === 'group' ? 'open' : 'published';
    if (p[2]) {
      const r = await get('SELECT * FROM records WHERE kind = ? AND status = ? AND data->>\'slug\' = ?', k, okStatus, p[2]);
      return r ? send(res, 200, recordOut(r), { 'Cache-Control': 'public, max-age=60' }) : send(res, 404, { error: 'Not found' });
    }
    let rows = (await all('SELECT * FROM records WHERE kind = ? AND status = ? ORDER BY id DESC LIMIT 200', k, okStatus)).map(recordOut);
    if (k === 'group') { const today = new Date().toISOString().slice(0, 10); rows = rows.filter(r => !r.departure_date || r.departure_date >= today).sort((a, b) => String(a.departure_date).localeCompare(String(b.departure_date))); }
    return send(res, 200, rows, { 'Cache-Control': 'public, max-age=30' });
  }
  if (p[0] === 'review' && req.method === 'POST') {
    if (limited(ip, 'r', 4)) return send(res, 429, { error: 'Too many requests. Please try again later.' });
    const b = await readBody(req, 2e4).catch(() => null);
    if (!b || !String(b.name || '').trim() || String(b.text || '').trim().length < 20) return send(res, 400, { error: 'Please enter your name and a review of at least 20 characters.' });
    const rating = Math.min(5, Math.max(1, Number(b.rating) || 5));
    await saveRecord('reviews', { name: String(b.name).slice(0, 80), headline: String(b.headline || '').slice(0, 120), country: String(b.country || '').slice(0, 60), rating, tour: String(b.tour || '').slice(0, 160), text: String(b.text).slice(0, 3000), date: new Date().toISOString().slice(0, 10), status: 'pending' }, null, { email: 'website' });
    return send(res, 201, { ok: true });
  }
  if (p[0] === 'booking' && req.method === 'POST') {
    if (limited(ip, 'b', 5)) return send(res, 429, { error: 'Too many requests. Please try again later.' });
    const b = await readBody(req, 2e4).catch(() => null);
    if (!b || !String(b.name || '').trim() || !/^\S+@\S+\.\S+$/.test(b.email || '')) return send(res, 400, { error: 'Please enter your name and a valid email.' });
    const n = Math.min(40, Math.max(1, parseInt(b.travelers, 10) || 1));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') ? b.start_date : '';
    if (!start || start < new Date().toISOString().slice(0, 10)) return send(res, 400, { error: 'Please choose a start date in the future.' });
    const t = await get("SELECT * FROM tours WHERE slug = ? AND status = 'published'", String(b.tour_slug || ''));
    if (!t) return send(res, 400, { error: 'Please choose a package.' });
    const pp = estimatePerPerson(t, n);
    const notes = [b.notes ? 'Guest notes: ' + String(b.notes).slice(0, 1500) : '', pp ? `Estimate: USD ${pp} x ${n} = USD ${pp * n} (from website price table, to be confirmed)` : 'Price to be quoted.'].filter(Boolean).join('\n');
    const rec = await saveRecord('bookings', { customer: String(b.name).slice(0, 120), email: String(b.email).slice(0, 160), phone: String(b.phone || '').slice(0, 60), country: String(b.country || '').slice(0, 60), tour: t.title, tour_slug: t.slug, start_date: start, travelers: n, total_usd: pp ? pp * n : '', status: 'New', notes }, null, { email: 'website' });
    return send(res, 201, { ok: true, reference: rec.reference, estimate: pp ? pp * n : null, per_person: pp || null, title: t.title });
  }
  if (p[0] === 'track' && req.method === 'POST') {
    if (limited(ip, 't', 120)) return send(res, 429, {});
    const b = await readBody(req, 4e3).catch(() => ({}));
    const ua = req.headers['user-agent'] || '';
    if (/bot|crawl|spider|preview|monitor/i.test(ua)) return send(res, 204, {});
    const day = new Date().toISOString().slice(0, 10);
    const vh = crypto.createHash('sha256').update(ip + ua + day).digest('hex').slice(0, 16);
    const country = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || (/-([A-Za-z]{2})\b/.exec(req.headers['accept-language'] || '')?.[1] || '')).toUpperCase().slice(0, 2);
    let ref = ''; try { const h = new URL(b.ref).hostname; if (h && h !== req.headers.host?.split(':')[0]) ref = h.replace(/^www\./, ''); } catch {}
    await run('INSERT INTO pageviews (ts,day,path,title,vh,country,ref,device) VALUES (?,?,?,?,?,?,?,?)', Date.now(), day, String(b.path || '/').slice(0, 200), String(b.title || '').slice(0, 200), vh, country, ref, /mobile|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop');
    return send(res, 204, {});
  }
  if (p[0] === 'inquiry' && req.method === 'POST') {
    if (limited(ip, 'i', 6)) return send(res, 429, { error: 'Too many requests. Please try again later.' });
    const b = await readBody(req, 2e4).catch(() => null);
    if (!b || !String(b.name || '').trim() || !/^\S+@\S+\.\S+$/.test(b.email || '')) return send(res, 400, { error: 'Please enter your name and a valid email.' });
    const rec = await saveRecord('inquiries', { name: String(b.name).slice(0, 120), email: String(b.email).slice(0, 160), phone: String(b.phone || '').slice(0, 60), interest: String(b.interest || b.package || '').slice(0, 200), dates: String(b.dates || '').slice(0, 80), travelers: String(b.pax || '').slice(0, 40), message: String(b.msg || '').slice(0, 4000), source: String(b.source || 'Website').slice(0, 200), status: 'New' }, null, { email: 'website' });
    return send(res, 201, { ok: true, id: rec.id });
  }
  return send(res, 404, { error: 'Not found' });
}

module.exports = { admin, pub, send };
