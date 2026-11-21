// Public API (/api/*) used by the website. Only published content is ever returned, and every write is validated, size-limited and rate-limited.
const crypto = require('crypto');
const { all, get, run } = require('./db');
const S = require('./schema');
const store = require('./store');
const tours = require('./tours');
const { readBody, send, fire } = require('./admin');
const { httpErr, routeOf } = require('./util');

const rate = new Map();
const limited = (ip, key, max) => { const k = key + ip, now = Date.now(), a = rate.get(k) || { n: 0, t: now }; if (now - a.t > 6e4) { a.n = 0; a.t = now; } a.n++; rate.set(k, a); if (rate.size > 5000) for (const [x, v] of rate) if (now - v.t > 6e4) rate.delete(x); return a.n > max; };
const CACHE = { 'Cache-Control': 'public, max-age=30' };
const KINDS = { faqs: 'faqs', reviews: 'reviews', testimonials: 'testimonials', offers: 'offers', departures: 'group', blog: 'blog', destinations: 'destinations', accommodations: 'accommodations' };

function estimatePerPerson(t, n) {
  const tiers = (t.price_tiers || []).slice().sort((a, b) => a.pax - b.pax);
  if (tiers.length) return (tiers.filter(r => r.pax <= n).pop() || tiers[0]).usd;
  return t.price_single || t.price_from || null;
}
async function upsertCustomer(b) {
  if (!b.email) return;
  const ex = await get('SELECT id FROM cms_customers WHERE lower(email) = lower(?)', b.email);
  if (!ex) await store.save('customers', { name: b.customer, email: b.email, phone: b.phone || '', country: b.country || '', trips: 0 }, null, { email: 'website' }).catch(() => {});
}
async function homeData() {
  const all_ = await tours.publicList({});
  const featured = all_.filter(t => t.featured && t.category === 'safari').slice(0, 8);
  const kili = all_.filter(t => t.featured && t.category === 'trekking').slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  const offers = (await store.publicList('offers', { order: 'id' })).filter(o => !o.valid_until || o.valid_until >= today).map(o => {
    const t = all_.find(x => x.title.toLowerCase() === String(o.tour || '').toLowerCase()); if (!t) return null;
    const now = Number(t.price_from) || 0, off = Number(o.discount) || 0, old = now + off;
    return { slug: t.slug, title: o.title || t.title, image: o.image || t.image, label: o.label, route: t.route, summary: t.summary, previous: old, saving: off, percent: old ? Math.round(off / old * 100) : 0, price: now, child_note: o.child_note };
  }).filter(Boolean).slice(0, 6);
  const guides = (await store.publicList('blog', { order: 'published_at DESC NULLS LAST, id DESC' })).slice(0, 6).map(p => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, image: p.image, published_at: p.published_at, author: p.author }));
  return { featured, kili, offers, guides };
}

async function pub(req, res, url) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean), ip = req.socket.remoteAddress || '', m = req.method;
  try {
    if (p[0] === 'tours' && m === 'GET') {
      if (p[1]) { const t = await tours.one(decodeURIComponent(p[1]), { drafts: false }); return t ? send(res, 200, t, CACHE) : send(res, 404, { error: 'Not found' }); }
      const sp = url.searchParams; return send(res, 200, await tours.publicList({ category: sp.get('category'), tag: sp.get('tag'), sub: sp.get('sub'), mention: sp.get('mention') }), CACHE);
    }
    if (p[0] === 'home' && m === 'GET') return send(res, 200, await homeData(), CACHE);
    if (p[0] === 'content' && m === 'GET') {
      const kind = KINDS[p[1]]; if (!kind) return send(res, 404, { error: 'Unknown' });
      if (p[2]) { const r = await store.publicOne(kind, decodeURIComponent(p[2])); if (!r) return send(res, 404, { error: 'Not found' }); if (kind === 'destinations') Object.assign(r, await tours.destStats(r.keyword)); return send(res, 200, r, CACHE); }
      let rows = await store.publicList(kind, { order: kind === 'group' ? 'departure_date' : kind === 'blog' ? 'published_at DESC NULLS LAST, id DESC' : 'id DESC' });
      if (kind === 'destinations') rows = await Promise.all(rows.map(async r => ({ ...r, ...(await tours.destStats(r.keyword)) })));
      if (kind === 'group') { const today = new Date().toISOString().slice(0, 10); rows = rows.filter(r => !r.departure_date || r.departure_date >= today); }
      return send(res, 200, rows, { 'Cache-Control': 'public, max-age=30' });
    }
    if (m === 'POST' && ['review', 'booking', 'inquiry', 'track'].includes(p[0])) {
      if (limited(ip, p[0], { review: 4, booking: 5, inquiry: 6, track: 120 }[p[0]])) return send(res, 429, { error: 'Too many requests. Please try again later.' });
      const b = await readBody(req, p[0] === 'track' ? 4e3 : 2e4).catch(() => null); if (!b) return send(res, 400, { error: 'Bad request.' });
      if (p[0] === 'track') {
        const ua = req.headers['user-agent'] || ''; if (/bot|crawl|spider|preview|monitor/i.test(ua)) return send(res, 204, {});
        const day = new Date().toISOString().slice(0, 10), vh = crypto.createHash('sha256').update(ip + ua + day).digest('hex').slice(0, 16);
        const country = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || (/-([A-Za-z]{2})\b/.exec(req.headers['accept-language'] || '') || [])[1] || '').toUpperCase().slice(0, 2);
        let ref = ''; try { const h = new URL(b.ref).hostname; if (h && h !== String(req.headers.host).split(':')[0]) ref = h.replace(/^www\./, ''); } catch {}
        await run('INSERT INTO pageviews (ts, day, path, title, vh, country, ref, device) VALUES (?,?,?,?,?,?,?,?)', Date.now(), day, String(b.path || '/').slice(0, 200), String(b.title || '').slice(0, 200), vh, country, ref, /mobile|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop');
        return send(res, 204, {});
      }
      if (b.website) return send(res, 201, { ok: true }); // honeypot field: real visitors never fill it in
      const web = { email: 'website' };
      if (p[0] === 'review') {
        if (!String(b.name || '').trim() || String(b.text || '').trim().length < 20) return send(res, 400, { error: 'Please enter your name and a review of at least 20 characters.' });
        await store.save('reviews', { name: String(b.name).slice(0, 80), headline: String(b.headline || '').slice(0, 120), country: String(b.country || '').slice(0, 60), rating: Math.min(5, Math.max(1, Number(b.rating) || 5)), tour: String(b.tour || '').slice(0, 160), text: String(b.text).slice(0, 3000), date: new Date().toISOString().slice(0, 10), status: 'pending' }, null, web);
        return send(res, 201, { ok: true });
      }
      if (!String(b.name || '').trim() || !/^\S+@\S+\.\S+$/.test(b.email || '')) return send(res, 400, { error: 'Please enter your name and a valid email.' });
      if (p[0] === 'inquiry') {
        const rec = await store.save('inquiries', { name: String(b.name).slice(0, 120), email: String(b.email).slice(0, 160), phone: String(b.phone || '').slice(0, 60), interest: String(b.interest || b.package || '').slice(0, 200), dates: String(b.dates || '').slice(0, 80), travelers: String(b.pax || '').slice(0, 40), message: String(b.msg || '').slice(0, 4000), source: String(b.source || 'Website').slice(0, 200), status: 'New' }, null, web);
        fire('New inquiry', rec); return send(res, 201, { ok: true, id: rec.id });
      }
      const n = Math.min(40, Math.max(1, parseInt(b.travelers, 10) || 1)), start = /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') ? b.start_date : '';
      if (!start || start < new Date().toISOString().slice(0, 10)) return send(res, 400, { error: 'Please choose a start date in the future.' });
      const t = await tours.one(String(b.tour_slug || ''), { drafts: false }); if (!t) return send(res, 400, { error: 'Please choose a package.' });
      const pp = estimatePerPerson(t, n);
      const notes = [b.notes ? 'Guest notes: ' + String(b.notes).slice(0, 1500) : '', pp ? `Estimate: USD ${pp} x ${n} = USD ${pp * n} (from website price table, to be confirmed)` : 'Price to be quoted.'].filter(Boolean).join('\n');
      const rec = await store.save('bookings', { customer: String(b.name).slice(0, 120), email: String(b.email).slice(0, 160), phone: String(b.phone || '').slice(0, 60), country: String(b.country || '').slice(0, 60), tour: t.title, tour_slug: t.slug, start_date: start, travelers: n, total_usd: pp ? pp * n : null, status: 'New', notes }, null, web);
      await upsertCustomer({ customer: rec.customer, email: rec.email, phone: rec.phone, country: rec.country }); fire('New booking', rec);
      return send(res, 201, { ok: true, reference: rec.reference, estimate: pp ? pp * n : null, per_person: pp || null, title: t.title });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    if (e.code && Number.isInteger(e.code) && e.code >= 400 && e.code < 600) return send(res, e.code, { error: e.message });
    console.error('[public]', e); return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
module.exports = { pub, send };
