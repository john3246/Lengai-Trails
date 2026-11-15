/* Lengai CMS: single-page admin. All data comes from /cms/api. */
(() => {
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = n => n == null || n === '' ? '—' : 'USD ' + Number(n).toLocaleString('en-US');
const fmtDate = s => s ? String(s).slice(0, 10) : '';
let ME = null, SCHEMA = {}, BADGE = 0, TOURS = null;

async function api(path, opt = {}) {
  const r = await fetch('/cms/api/' + path, { method: opt.method || 'GET', headers: opt.body ? { 'Content-Type': 'application/json' } : {}, body: opt.body ? JSON.stringify(opt.body) : undefined, credentials: 'same-origin' });
  if (r.status === 401 && path !== 'login') { ME = null; render(); throw new Error('Signed out'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 2600); }
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'Signed out') toast(e.message, true); } };

// ---------- navigation ----------
const I = { dash: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4', bed: 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6', doc: 'M6 3h9l4 4v14H6zM14 3v5h5', img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', chat: 'M4 5h16v11H9l-5 4z', tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', q: 'M9 9a3 3 0 116 0c0 2-3 2-3 4M12 17h.01', users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 010 7M22 21c0-3-2-5-5-5.5', list: 'M4 6h16M4 12h16M4 18h10', check: 'M4 12l5 5L20 6', file: 'M6 3h9l4 4v14H6z', mail: 'M3 6h18v12H3zM3 7l9 7 9-7', bill: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1', key: 'M14 10a4 4 0 11-3 3L3 21v-3h3v-3h3l2-2', gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1-1-2H9L8 7 6 8 4 7 2 11l2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z', pulse: 'M3 12h4l3-8 4 16 3-8h4', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3-6 8-6s8 2 8 6' };
const icon = n => `<svg viewBox="0 0 24 24"><path d="${I[n]}"/></svg>`;
const NAV = [
  ['', [['dashboard', 'Dashboard', 'dash'], ['traffic', 'Website traffic', 'chart']]],
  ['CONTENT MANAGEMENT', [['tours', 'Tours', 'pin'], ['accommodations', 'Accommodations', 'bed'], ['destinations', 'Destinations', 'pin'], ['blog', 'Blog', 'doc'], ['pages', 'Pages', 'file'], ['media', 'Media', 'img'], ['reviews', 'Guest reviews', 'star'], ['testimonials', 'Testimonials', 'chat'], ['offers', 'Holiday offers', 'tag'], ['faqs', 'FAQs', 'q'], ['group', 'Group Safari', 'users'], ['menus', 'Menus', 'list']]],
  ['TEAM', [['tasks', 'Tasks & notes', 'check'], ['clients', 'Client records', 'file'], ['reports', 'Reports', 'chart']]],
  ['OPERATIONS', [['bookings', 'Bookings', 'bed', 'badge'], ['inquiries', 'Inquiries', 'mail'], ['customers', 'Customers', 'users'], ['invoices', 'Invoices', 'bill']]],
  ['SYSTEM', [['integrations', 'Integrations & webhooks', 'link'], ['keys', 'API keys', 'key'], ['users', 'Users & roles', 'users'], ['settings', 'Site settings', 'gear'], ['status', 'System status', 'pulse'], ['audit', 'Audit log', 'list'], ['profile', 'My profile', 'user']]]
];

function shell(active, inner) {
  const nav = NAV.map(([h, items]) => (h ? `<div class="side__h">${h}</div>` : '') + items.map(([k, l, ic, b]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}" title="${esc(l)}">${icon(ic)}<span class="t">${esc(l)}</span>${b && BADGE ? `<span class="badge">${BADGE}</span>` : ''}</a>`).join('')).join('');
  const ini = (ME.name || ME.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="shell${localStorage.getItem('mini') === '1' ? ' mini' : ''}" id="shell">
  <aside class="side"><div class="side__brand"><img src="/assets/logo-light.png" alt="Lengai Trails"></div><nav class="side__nav">${nav}</nav>
    <button class="side__shrink" id="shrink">‹ <span class="t">Shrink menu</span></button>
    <div class="side__user"><div class="av">${esc(ini)}</div><div><b>${esc(ME.name || ME.email)}</b><span>${esc(ME.role.replace('_', ' '))}</span></div></div></aside>
  <div class="main"><div class="top"><button class="ham" id="ham" aria-label="Menu">☰</button>
    <div class="search"><input id="gsearch" placeholder="Search anything... (tours, destinations, blog, bookings, etc.)" autocomplete="off"><div class="sresults" id="sres" hidden></div></div>
    <div class="me"><div><b>${esc(ME.name || ME.email)}</b><br><small>${esc(ME.role.replace('_', ' '))}</small></div><button class="btn" id="signout">Sign out</button></div></div>
  <div class="content" id="content">${inner}</div></div></div>`;
}

// ---------- router ----------
const routes = {};
function route() { const h = location.hash.replace(/^#\/?/, '').split('/'); return { page: h[0] || 'dashboard', id: h[1] }; }
async function render() {
  if (!ME) {
    try { const r = await api('me'); ME = r.user; SCHEMA = r.schema; } catch { return loginView(); }
  }
  const { page, id } = route();
  try { const d = await api('dashboard').catch(() => null); BADGE = d ? d.counts.newBookings : 0; } catch {}
  app.innerHTML = shell(page, '<div class="empty">Loading…</div>');
  wire();
  const content = $('#content');
  try {
    let fn = routes[page];
    if (SCHEMA[page] && !fn) fn = (c, i) => resourceView(c, page, i);
    if (!fn) fn = c => { c.innerHTML = '<div class="empty">Page not found</div>'; };
    await fn(content, id);
  } catch (e) { if (e.message !== 'Signed out') content.innerHTML = `<div class="card">${esc(e.message)}</div>`; }
}
function wire() {
  $('#signout').onclick = async () => { await api('logout', { method: 'POST' }).catch(() => {}); ME = null; location.hash = ''; render(); };
  $('#shrink').onclick = () => { $('#shell').classList.toggle('mini'); localStorage.setItem('mini', $('#shell').classList.contains('mini') ? '1' : '0'); };
  $('#ham').onclick = () => $('#shell').classList.toggle('open');
  const gs = $('#gsearch'), res = $('#sres'); let t;
  gs.oninput = () => { clearTimeout(t); t = setTimeout(async () => { if (gs.value.length < 2) { res.hidden = true; return; } const r = await api('search?q=' + encodeURIComponent(gs.value)).catch(() => []); res.innerHTML = r.length ? r.map(x => `<a href="${esc(x.hash)}"><span>${esc(x.title)}</span><small>${esc(x.type)}</small></a>`).join('') : '<div class="empty">No matches</div>'; res.hidden = false; }, 220); };
  document.onclick = e => { if (!e.target.closest('.search')) res.hidden = true; if (e.target.closest('#sres a')) { res.hidden = true; gs.value = ''; } };
}
window.addEventListener('hashchange', render);

function loginView() {
  app.innerHTML = `<div class="login"><form id="lf"><img src="/assets/logo-light.png" alt="Lengai Trails"><h1>Lengai CMS sign in</h1><div class="err" id="le"></div>
  <label class="f">Email<input name="email" type="email" required autocomplete="username" autofocus></label>
  <label class="f">Password<input name="password" type="password" required autocomplete="current-password"></label>
  <button class="btn btn--gold" style="width:100%;justify-content:center;padding:10px">Sign in</button></form></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await api('login', { method: 'POST', body: d }); ME = null; render(); } catch (er) { $('#le').textContent = er.message; } };
}

// ---------- charts ----------
const dayLbl = d => { const x = new Date(d + 'T00:00:00'); return x.getDate() + ' ' + x.toLocaleString('en', { month: 'short' }); };
function chart(series) {
  const max = Math.max(1, ...series.map(s => s.views));
  return `<div class="chart">${series.map(s => `<div class="col"><div class="bars"><div class="pv" style="height:${s.views / max * 100}%"></div><div class="vs" style="height:${s.visitors / max * 100}%"></div>${s.lead ? `<span class="dot" style="bottom:${s.views / max * 100}%"></span>` : ''}<span class="tip">${s.visitors} visitors · ${s.views} views</span></div><div class="lbl">${series.length > 14 ? (s.day.slice(8) === '01' || series.indexOf(s) % 5 === 0 ? dayLbl(s.day) : '&nbsp;') : dayLbl(s.day)}</div></div>`).join('')}</div>
  <div class="legend"><span><i style="background:var(--bar)"></i>Visitors</span><span><i style="background:var(--tan)"></i>Page views</span><span><i class="c" style="background:var(--gold);border:2px solid var(--teal)"></i>Period with lead actions</span></div>`;
}
const cbars = (rows, label, max) => rows.length ? rows.map(r => `<div class="cbar"><i style="width:${(r.visitors / max) * 100}%"></i>${label(r)}<b>${r.visitors}</b></div>`).join('') : '<div class="empty">No visits recorded yet. Open the website to generate traffic.</div>';

// ---------- dashboard & traffic ----------
routes.dashboard = async c => {
  const d = await api('dashboard'), k = d.counts;
  const st = (l, v, s) => `<div class="card stat"><small>${l}</small><b>${v}</b><span>${s}</span></div>`;
  c.innerHTML = `<div class="page-h"><div><h1>Dashboard</h1><p>Welcome back, ${esc(ME.name || ME.email)}.</p></div><a class="btn btn--gold" href="#/tours/new">+ New package</a></div>
  <div class="grid g4">${st('Packages', k.tours, k.published + ' published')}${st('Bookings', k.bookings, k.newBookings + ' new')}${st('Inquiries', k.inquiries, k.newInquiries + ' new')}${st('Paid invoices', usd(k.revenue), k.customers + ' customers')}</div>
  <div class="card" style="margin-top:16px"><h2>Visitors over the last 7 days</h2>${chart(d.traffic.series)}</div>
  <div class="grid g2b"><div class="card"><h2>Latest inquiries</h2>${d.recentInquiries.length ? `<table>${d.recentInquiries.map(r => `<tr><td><a class="tt" href="#/inquiries/${r.id}">${esc(r.name)}</a><small>${esc(r.interest || r.email)}</small></td><td><span class="tag ${r.status === 'New' ? 'on' : ''}">${esc(r.status)}</span></td><td class="r">${fmtDate(r.created_at)}</td></tr>`).join('')}</table>` : '<div class="empty">No inquiries yet</div>'}</div>
  <div class="card"><h2>Open tasks</h2>${d.tasks.length ? `<table>${d.tasks.map(r => `<tr><td><a class="tt" href="#/tasks/${r.id}">${esc(r.title)}</a><small>${esc(r.assignee || '')}</small></td><td><span class="tag">${esc(r.status)}</span></td></tr>`).join('')}</table>` : '<div class="empty">Nothing to do</div>'}</div></div>
  <div class="card"><h2>Latest bookings</h2>${d.recentBookings.length ? `<table><tr><th>Reference</th><th>Customer</th><th>Package</th><th>Status</th><th class="r">Total</th></tr>${d.recentBookings.map(r => `<tr><td><a class="tt" href="#/bookings/${r.id}">${esc(r.reference)}</a></td><td>${esc(r.customer)}</td><td>${esc(r.tour)}</td><td><span class="tag">${esc(r.status)}</span></td><td class="r">${usd(r.total_usd)}</td></tr>`).join('')}</table>` : '<div class="empty">No bookings yet</div>'}</div>`;
};
routes.traffic = async (c, id) => {
  const days = Number(localStorage.getItem('tdays')) || 8;
  const t = await api('traffic?days=' + days);
  const maxC = Math.max(1, ...t.countries.map(x => x.visitors));
  c.innerHTML = `<div class="page-h"><div><h1>Website traffic</h1><p>${t.totals.visitors} visitors · ${t.totals.views} page views in the last ${days} days</p></div><select id="tdays" class="btn">${[8, 30, 90].map(n => `<option value="${n}" ${n === days ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select></div>
  <div class="card"><h2>Visitors over time</h2>${chart(t.series)}</div>
  <div class="grid g2b"><div class="card"><h2>Most visited pages</h2><table><tr><th>Page</th><th class="r">Visitors</th><th class="r">Views</th></tr>${t.pages.map(p => `<tr><td>${esc(p.title || p.path)}<small>${esc(p.path)}</small></td><td class="r">${p.visitors}</td><td class="r">${p.views}</td></tr>`).join('') || '<tr><td colspan=3 class="empty">No data yet</td></tr>'}</table></div>
  <div class="card"><h2>Where visitors come from</h2>${cbars(t.countries, r => `<span class="cc">${esc(r.country)}</span><span>${esc(r.country === '??' ? 'Unknown' : (new Intl.DisplayNames(['en'], { type: 'region' }).of(r.country) || r.country))}</span>`, maxC)}
  <h2 style="margin-top:18px">Traffic sources</h2>${cbars(t.refs, r => `<span>${esc(r.ref)}</span>`, Math.max(1, ...t.refs.map(x => x.visitors)))}
  <h2 style="margin-top:18px">Devices</h2>${cbars(t.devices, r => `<span>${esc(r.device)}</span>`, Math.max(1, ...t.devices.map(x => x.visitors)))}</div></div>`;
  $('#tdays').onchange = e => { localStorage.setItem('tdays', e.target.value); render(); };
};

// ---------- tours ----------
const CATS = { safari: 'Private safari', group: 'Group / joining', trekking: 'Trekking' };
routes.tours = async (c, id) => {
  if (id) return tourEditor(c, id);
  const q = sessionStorage.getItem('tq') || '', cat = sessionStorage.getItem('tcat') || '', stt = sessionStorage.getItem('tst') || '';
  const rows = await api(`tours?q=${encodeURIComponent(q)}&category=${cat}&status=${stt}`);
  c.innerHTML = `<div class="page-h"><div><h1>Tours</h1><p>${rows.length} packages. Everything here appears on the website.</p></div><a class="btn btn--gold" href="#/tours/new">+ New package</a></div>
  <div class="card"><div class="toolbar"><input id="tq" placeholder="Search packages…" value="${esc(q)}"><select id="tcat"><option value="">All types</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}</select><select id="tst"><option value="">Any status</option><option ${stt === 'published' ? 'selected' : ''}>published</option><option ${stt === 'draft' ? 'selected' : ''}>draft</option></select></div>
  <table><tr><th></th><th>Package</th><th>Type</th><th>Days</th><th class="r">From price</th><th>Status</th><th></th></tr>${rows.map(r => `<tr><td style="width:56px"><img src="/${esc(r.image)}" alt="" style="width:48px;height:34px;object-fit:cover;border-radius:5px"></td><td><a class="tt" href="#/tours/${r.id}">${esc(r.title)}</a><small>/${esc(r.slug)}</small></td><td>${esc(r.subcategory || CATS[r.category] || r.category)}</td><td>${r.days ?? '—'}</td><td class="r">${r.price_from ? usd(r.price_from) : '<span class="hint">On request</span>'}</td><td><span class="tag ${r.status === 'published' ? 'on' : 'off'}">${esc(r.status)}</span></td><td class="r"><a class="btn btn--sm" href="#/tours/${r.id}">Edit</a> <button class="btn btn--sm btn--danger" data-del="${r.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan=7 class="empty">No packages match.</td></tr>'}</table></div>`;
  let t; $('#tq').oninput = e => { clearTimeout(t); t = setTimeout(() => { sessionStorage.setItem('tq', e.target.value); routes.tours(c); }, 300); };
  $('#tcat').onchange = e => { sessionStorage.setItem('tcat', e.target.value); routes.tours(c); };
  $('#tst').onchange = e => { sessionStorage.setItem('tst', e.target.value); routes.tours(c); };
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = guard(async () => { if (confirm('Delete this package permanently?')) { await api('tours/' + b.dataset.del, { method: 'DELETE' }); toast('Package deleted'); routes.tours(c); } }));
};

const lines = a => (a || []).join('\n');
const unlines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
async function tourEditor(c, id) {
  const isNew = id === 'new';
  const t = isNew ? { title: '', category: 'safari', status: 'draft', image: 'assets/img/serengeti-04-card.webp', overview: [], highlights: [], itinerary: [], inclusions: [], exclusions: [], notes: [], price_tiers: [], tags: [] } : await api('tours/' + id);
  let itin = JSON.parse(JSON.stringify(t.itinerary || [])), tiers = JSON.parse(JSON.stringify(t.price_tiers || []));
  const itinHtml = () => itin.map((d, i) => `<div class="itin" data-i="${i}"><div class="itin__h"><b>Day ${esc(d.day)}</b><input data-f="title" value="${esc(d.title)}" placeholder="Day title"><button class="btn btn--sm" data-act="up" type="button">↑</button><button class="btn btn--sm" data-act="down" type="button">↓</button><button class="btn btn--sm btn--danger" data-act="rm" type="button">Remove</button></div>
    <label class="f">Description (one paragraph per line)<textarea data-f="body">${esc((d.body || []).join('\n'))}</textarea></label>
    <label class="f">Details: Accommodation, Meals, Elevation… (one “Key: value” per line)<textarea data-f="meta" style="min-height:54px">${esc(Object.entries(d.meta || {}).map(([k, v]) => k + ': ' + v).join('\n'))}</textarea></label></div>`).join('') || '<div class="empty">No itinerary yet</div>';
  const tierHtml = () => tiers.map((r, i) => `<div class="row" style="grid-template-columns:1fr 1fr auto;align-items:end" data-t="${i}"><label class="f">Group size (pax)<input type="number" data-tf="pax" value="${esc(r.pax)}"></label><label class="f">Price per person (USD)<input type="number" data-tf="usd" value="${esc(r.usd)}"></label><button type="button" class="btn btn--sm btn--danger" data-trm="${i}" style="margin-bottom:12px">✕</button></div>`).join('');
  c.innerHTML = `<div class="page-h"><div><h1>${isNew ? 'New package' : 'Edit package'}</h1><p>${isNew ? '' : '<a href="/package.html?slug=' + esc(t.slug) + '" target="_blank" style="text-decoration:underline">View on website ↗</a>'}</p></div><a class="btn" href="#/tours">← All packages</a></div>
  ${(t.warnings || []).length ? '' : ''}
  <form id="tf"><div class="card"><h2>Basics</h2><label class="f">Title<input name="title" required value="${esc(t.title)}"></label>
    <div class="row"><label class="f">Type<select name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${t.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="f">Sub-category (e.g. Kilimanjaro)<input name="subcategory" value="${esc(t.subcategory || '')}"></label><label class="f">Days<input name="days" type="number" min="1" value="${esc(t.days ?? '')}"></label><label class="f">URL slug<input name="slug" value="${esc(t.slug || '')}" placeholder="auto from title"></label></div>
    <div class="row"><label class="f">Safari style<input name="type" value="${esc(t.type || '')}" placeholder="e.g. Private, Joining / group"></label><label class="f">Tags (comma separated)<input name="tags" value="${esc((t.tags || []).join(', '))}"></label><label class="f">Status<select name="status"><option ${t.status === 'published' ? 'selected' : ''}>published</option><option ${t.status === 'draft' ? 'selected' : ''}>draft</option></select></label><label class="f">Featured<select name="featured"><option value="0">No</option><option value="1" ${t.featured ? 'selected' : ''}>Yes</option></select></label></div>
    <label class="f">Cover image<div class="imgpick"><img id="timg" src="/${esc(t.image)}" alt=""><input name="image" value="${esc(t.image || '')}" id="timgv"><button type="button" class="btn" id="tpick">Choose…</button></div></label></div>
  <div class="card"><h2>Pricing (USD per person)</h2><p class="hint" style="margin-bottom:10px">Use group prices when the price depends on group size. Leave empty for “price on request”.</p>
    <div class="row"><label class="f">Single price (if not group-based)<input name="price_single" type="number" value="${esc(t.price_single ?? '')}"></label><label class="f">Price note<input name="price_note" value="${esc(t.price_note || '')}"></label></div><div id="tiers">${tierHtml()}</div><button type="button" class="btn btn--sm" id="addtier">+ Add group price</button></div>
  <div class="card"><h2>Overview &amp; highlights</h2><label class="f">Overview (one paragraph per line)<textarea name="overview" class="big" style="min-height:160px">${esc(lines(t.overview))}</textarea></label><label class="f">Highlights (one per line)<textarea name="highlights">${esc(lines(t.highlights))}</textarea></label></div>
  <div class="card"><h2>Itinerary</h2><div id="itin">${itinHtml()}</div><button type="button" class="btn btn--sm" id="addday">+ Add day</button></div>
  <div class="card"><h2>What's included / excluded</h2><div class="row"><label class="f">Included (one per line)<textarea name="inclusions" style="min-height:160px">${esc(lines(t.inclusions))}</textarea></label><label class="f">Excluded (one per line)<textarea name="exclusions" style="min-height:160px">${esc(lines(t.exclusions))}</textarea></label></div><label class="f">Extra notes (one paragraph per line)<textarea name="notes">${esc(lines(t.notes))}</textarea></label></div>
  <div class="sticky"><a class="btn" href="#/tours">Cancel</a><button class="btn btn--gold" type="submit">${isNew ? 'Create package' : 'Save changes'}</button></div></form>`;
  const syncItin = () => c.querySelectorAll('.itin').forEach(el => { const d = itin[+el.dataset.i]; d.title = $('[data-f=title]', el).value; d.body = unlines($('[data-f=body]', el).value); d.meta = Object.fromEntries(unlines($('[data-f=meta]', el).value).map(l => { const x = l.indexOf(':'); return x > 0 ? [l.slice(0, x).trim(), l.slice(x + 1).trim()] : [l, '']; })); });
  const syncTiers = () => c.querySelectorAll('[data-t]').forEach(el => { const r = tiers[+el.dataset.t]; r.pax = +$('[data-tf=pax]', el).value; r.usd = +$('[data-tf=usd]', el).value; });
  const redo = () => { $('#itin').innerHTML = itinHtml(); itin.forEach((d, i) => d.day = i + 1); $('#itin').querySelectorAll('.itin__h b').forEach((b, i) => b.textContent = 'Day ' + (i + 1)); };
  $('#itin').onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return; syncItin(); const i = +b.closest('.itin').dataset.i; if (b.dataset.act === 'rm') itin.splice(i, 1); if (b.dataset.act === 'up' && i > 0) [itin[i - 1], itin[i]] = [itin[i], itin[i - 1]]; if (b.dataset.act === 'down' && i < itin.length - 1) [itin[i + 1], itin[i]] = [itin[i], itin[i + 1]]; redo(); };
  $('#addday').onclick = () => { syncItin(); itin.push({ day: itin.length + 1, title: '', body: [], meta: {} }); redo(); };
  $('#addtier').onclick = () => { syncTiers(); tiers.push({ pax: tiers.length + 1, usd: 0 }); $('#tiers').innerHTML = tierHtml(); };
  $('#tiers').onclick = e => { const b = e.target.closest('[data-trm]'); if (!b) return; syncTiers(); tiers.splice(+b.dataset.trm, 1); $('#tiers').innerHTML = tierHtml(); };
  $('#tpick').onclick = () => pickImage(u => { $('#timgv').value = u; $('#timg').src = '/' + u; });
  $('#timgv').onchange = e => $('#timg').src = '/' + e.target.value;
  $('#tf').onsubmit = guard(async e => {
    e.preventDefault(); syncItin(); syncTiers();
    const f = Object.fromEntries(new FormData(e.target));
    const body = { ...f, days: f.days, featured: f.featured, price_single: f.price_single, tags: f.tags.split(',').map(x => x.trim()).filter(Boolean), overview: unlines(f.overview), highlights: unlines(f.highlights), inclusions: unlines(f.inclusions), exclusions: unlines(f.exclusions), notes: unlines(f.notes), itinerary: itin, price_tiers: tiers.filter(r => r.usd > 0) };
    if (!body.slug) delete body.slug;
    const r = await api(isNew ? 'tours' : 'tours/' + id, { method: isNew ? 'POST' : 'PUT', body });
    toast(isNew ? 'Package created' : 'Saved'); if (isNew) location.hash = '#/tours/' + r.id; else render();
  });
}

// ---------- image picker / media ----------
async function pickImage(done) {
  const items = await api('media');
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="modal__box" style="width:min(820px,100%)"><h2>Choose an image</h2><div class="mgrid">${items.map(i => `<div class="mitem" data-u="${esc(i.url)}"><img src="/${esc(i.url)}" loading="lazy" alt=""><div>${esc(i.name)}</div></div>`).join('')}</div><div class="modal__actions"><button class="btn" id="mc">Close</button></div></div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m || e.target.id === 'mc') m.remove(); const it = e.target.closest('.mitem'); if (it) { done(it.dataset.u); m.remove(); } };
}
routes.media = async c => {
  const items = await api('media');
  c.innerHTML = `<div class="page-h"><div><h1>Media</h1><p>${items.length} images. Uploaded files can be used for packages, posts and destinations.</p></div></div>
  <div class="drop" id="drop">Drag images here or <label style="text-decoration:underline;cursor:pointer">choose files<input id="mf" type="file" accept="image/*" multiple hidden></label> (png, jpg, webp, gif, svg · max 8 MB)</div>
  <div class="mgrid">${items.map(i => `<div class="card mitem" style="padding:0;margin:0;cursor:default"><img src="/${esc(i.url)}" loading="lazy" alt=""><div>${esc(i.name)}</div><div style="display:flex;gap:6px;justify-content:space-between"><code style="font-size:10px">/${esc(i.url)}</code>${i.builtin ? '' : `<button class="btn btn--sm btn--danger" data-del="${i.id}">✕</button>`}</div></div>`).join('')}</div>`;
  const up = guard(async files => { for (const f of files) { const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); await api('media', { method: 'POST', body: { name: f.name, data } }); } toast('Uploaded'); render(); });
  $('#mf').onchange = e => up([...e.target.files]);
  const d = $('#drop'); d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over'); d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); up([...e.dataTransfer.files]); };
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = guard(async () => { if (confirm('Delete this image?')) { await api('media/' + b.dataset.del, { method: 'DELETE' }); render(); } }));
};

// ---------- generic resources ----------
const COLS = { bookings: ['reference', 'customer', 'tour', 'start_date', 'total_usd', 'status'], inquiries: ['name', 'email', 'interest', 'created_at', 'status'], invoices: ['number', 'customer', 'amount_usd', 'due', 'status'], customers: ['name', 'email', 'country', 'trips'], clients: ['name', 'email', 'country', 'status'], blog: ['title', 'author', 'published_at', 'status'], pages: ['title', 'slug', 'status'], reviews: ['name', 'country', 'rating', 'status'], group: ['tour', 'departure_date', 'seats_left', 'price_usd', 'status'], tasks: ['title', 'assignee', 'due', 'status'], destinations: ['name', 'region', 'status'], accommodations: ['name', 'location', 'category', 'status'], testimonials: ['name', 'role', 'status'], offers: ['title', 'tour', 'valid_until', 'status'], faqs: ['question', 'category', 'status'], menus: ['label', 'url', 'location', 'position'], integrations: ['name', 'type', 'event', 'active'] };
const QUICK = ['bookings', 'inquiries', 'reviews', 'invoices', 'tasks', 'group', 'clients'];
const cell = (k, v, kind, id) => k === 'status' && QUICK.includes(kind) && SCHEMA[kind] ? `<select data-st="${id}" class="btn btn--sm">${SCHEMA[kind].fields.find(f => f.k === 'status').o.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : k === 'status' || k === 'active' ?`<span class="tag ${['published', 'open', 'Paid', 'active', 'Confirmed', 'New'].includes(v) ? 'on' : ''}">${esc(v)}</span>` : /usd$/.test(k) ? usd(v) : k === 'created_at' ? fmtDate(v) : esc(v);
async function getTours() { if (!TOURS) TOURS = await api('tours'); return TOURS; }
async function resourceView(c, kind, id) {
  const sch = SCHEMA[kind];
  if (id && id !== 'new') { const r = await api(`r/${kind}/${id}`); return openForm(c, kind, r); }
  if (id === 'new') { openForm(c, kind, null, true); }
  const q = sessionStorage.getItem('q_' + kind) || '';
  const rows = await api(`r/${kind}?q=${encodeURIComponent(q)}`);
  const cols = COLS[kind] || sch.fields.slice(0, 4).map(f => f.k);
  const label = k => (sch.fields.find(f => f.k === k)?.l || k.replace('_', ' ')).replace(/^./, x => x.toUpperCase());
  c.innerHTML = `<div class="page-h"><div><h1>${esc(sch.label)}</h1><p>${rows.length} record${rows.length === 1 ? '' : 's'}</p></div><button class="btn btn--gold" id="new">+ New ${esc(sch.single.toLowerCase())}</button></div>
  <div class="card"><div class="toolbar"><input id="rq" placeholder="Search…" value="${esc(q)}"></div><table><tr>${cols.map(k => `<th>${esc(label(k))}</th>`).join('')}<th></th></tr>${rows.map(r => `<tr>${cols.map((k, i) => `<td>${i === 0 ? `<a class="tt" href="#/${kind}/${r.id}">${esc(r[k] || '(untitled)')}</a>` : cell(k, r[k], kind, r.id)}</td>`).join('')}<td class="r">${kind === 'bookings' ? `<button class="btn btn--sm" data-inv="${r.id}">Invoice</button> ` : ''}${kind === 'inquiries' ? `<button class="btn btn--sm" data-mkb="${r.id}">→ Booking</button> ` : ''}<button class="btn btn--sm" data-e="${r.id}">Edit</button><button class="btn btn--sm btn--danger" data-d="${r.id}">Delete</button></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">Nothing here yet.</td></tr>`}</table></div>`;
  $('#new').onclick = () => openForm(c, kind, null);
  let t; $('#rq').oninput = e => { clearTimeout(t); t = setTimeout(() => { sessionStorage.setItem('q_' + kind, e.target.value); resourceView(c, kind); }, 300); };
  c.querySelectorAll('[data-e]').forEach(b => b.onclick = () => openForm(c, kind, rows.find(r => r.id == b.dataset.e)));
  c.querySelectorAll('[data-st]').forEach(s => s.onchange = guard(async () => { await api(`r/${kind}/${s.dataset.st}`, { method: 'PUT', body: { status: s.value } }); toast('Status updated'); }));
  c.querySelectorAll('[data-inv]').forEach(b => b.onclick = guard(async () => {
    const r = rows.find(x => x.id == b.dataset.inv); const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const inv = await api('r/invoices', { method: 'POST', body: { customer: r.customer, booking: r.reference, amount_usd: r.total_usd || 0, issued: new Date().toISOString().slice(0, 10), due, status: 'Draft', notes: r.tour || '' } });
    toast('Invoice ' + inv.number + ' created'); location.hash = '#/invoices';
  }));
  c.querySelectorAll('[data-mkb]').forEach(b => b.onclick = guard(async () => {
    const r = rows.find(x => x.id == b.dataset.mkb);
    const bk = await api('r/bookings', { method: 'POST', body: { customer: r.name, email: r.email, phone: r.phone, country: r.country, tour: r.interest, travelers: parseInt(r.travelers, 10) || '', status: 'New', notes: r.message } });
    await api('r/inquiries/' + r.id, { method: 'PUT', body: { status: 'Quoted' } });
    toast('Booking ' + bk.reference + ' created'); location.hash = '#/bookings';
  }));
  c.querySelectorAll('[data-d]').forEach(b => b.onclick = guard(async () => { if (confirm('Delete this record?')) { await api(`r/${kind}/${b.dataset.d}`, { method: 'DELETE' }); toast('Deleted'); resourceView(c, kind); } }));
}
async function openForm(c, kind, rec, fromRoute) {
  const sch = SCHEMA[kind]; const tours = sch.fields.some(f => f.t === 'tour') ? await getTours() : [];
  const field = f => {
    const v = rec ? rec[f.k] : undefined, val = v ?? '';
    const base = `name="${f.k}"` + (f.req ? ' required' : '');
    if (f.t === 'textarea') return `<label class="f">${esc(f.l)}<textarea ${base} class="${f.big ? 'big' : ''}">${esc(val)}</textarea></label>`;
    if (f.t === 'select') return `<label class="f">${esc(f.l)}<select ${base}>${f.o.map(o => `<option ${String(val || f.o[0]) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (f.t === 'tour') return `<label class="f">${esc(f.l)}<input ${base} list="tl" value="${esc(val)}" placeholder="Start typing a package name"><datalist id="tl">${tours.map(t => `<option value="${esc(t.title)}">`).join('')}</datalist></label>`;
    if (f.t === 'image') return `<label class="f">${esc(f.l)}<div class="imgpick">${val ? `<img src="/${esc(val)}" alt="">` : ''}<input ${base} value="${esc(val)}" data-img><button type="button" class="btn" data-pick>Choose…</button></div></label>`;
    return `<label class="f">${esc(f.l)}<input ${base} type="${{ number: 'number', date: 'date', email: 'email' }[f.t] || 'text'}" value="${esc(val)}" ${f.auto && !rec ? 'placeholder="auto-generated"' : ''}></label>`;
  };
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<form class="modal__box"><h2>${rec ? 'Edit' : 'New'} ${esc(sch.single.toLowerCase())}</h2><div class="row">${sch.fields.map(field).join('')}</div><div class="modal__actions"><button type="button" class="btn" id="cx">Cancel</button><button class="btn btn--gold">Save</button></div></form>`;
  document.body.appendChild(m);
  const close = () => { m.remove(); if (fromRoute || location.hash.split('/').length > 2) location.hash = '#/' + kind; };
  $('#cx', m).onclick = close;
  m.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => pickImage(u => { const i = b.parentElement.querySelector('[data-img]'); i.value = u; }));
  m.querySelector('form').onsubmit = guard(async e => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(e.target));
    await api(rec ? `r/${kind}/${rec.id}` : `r/${kind}`, { method: rec ? 'PUT' : 'POST', body });
    toast('Saved'); m.remove(); if (location.hash.split('/').length > 2) location.hash = '#/' + kind; else render();
  });
}

// ---------- reports / status / audit ----------
routes.reports = async c => {
  const r = await api('reports');
  const tbl = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(x => `<tr>${x.map((v, i) => `<td class="${i ? 'r' : ''}">${v}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="empty">No data yet</td></tr>`}</table>`;
  c.innerHTML = `<div class="page-h"><div><h1>Reports</h1></div></div><div class="grid g2b"><div class="card"><h2>Bookings by status</h2>${tbl(['Status', 'Bookings', 'Value'], r.byStatus.map(x => [esc(x.status), x.n, usd(x.usd)]))}</div><div class="card"><h2>Invoices</h2>${tbl(['Status', 'Count', 'Amount'], r.invoices.map(x => [esc(x.status), x.n, usd(x.usd)]))}</div></div>
  <div class="grid g2b"><div class="card"><h2>Top booked packages</h2>${tbl(['Package', 'Bookings', 'Value'], r.topTours.map(x => [esc(x.tour || '—'), x.n, usd(x.usd)]))}</div><div class="card"><h2>Inquiries by status</h2>${tbl(['Status', 'Count'], r.inquiries.map(x => [esc(x.status), x.n]))}</div></div>
  <div class="card"><h2>Package catalogue</h2>${tbl(['Type', 'Packages', 'Lowest price', 'Highest price'], r.catalog.map(x => [esc(CATS[x.category] || x.category), x.n, usd(x.min_price), usd(x.max_price)]))}</div>`;
};
routes.status = async c => {
  const s = await api('status'); const up = s.uptime_s;
  c.innerHTML = `<div class="page-h"><div><h1>System status</h1><p>Server healthy as of ${esc(s.time)}</p></div></div><div class="grid g2b"><div class="card"><h2>Server</h2><div class="kv"><b>Node.js</b><span>${esc(s.node)}</span><b>Platform</b><span>${esc(s.platform)}</span><b>Uptime</b><span>${Math.floor(up / 3600)}h ${Math.floor(up % 3600 / 60)}m</span><b>Memory</b><span>${s.memory_mb} MB</span><b>Database file</b><span>${esc(s.db_file)} (${s.db_kb} KB)</span></div></div>
  <div class="card"><h2>Database tables</h2><table><tr><th>Table</th><th class="r">Rows</th></tr>${s.tables.map(t => `<tr><td>${esc(t.table)}</td><td class="r">${t.rows}</td></tr>`).join('')}</table></div></div>`;
};
routes.audit = async c => {
  const rows = await api('audit');
  c.innerHTML = `<div class="page-h"><div><h1>Audit log</h1><p>The last ${rows.length} changes</p></div></div><div class="card"><table><tr><th>When (UTC)</th><th>User</th><th>Action</th><th>Item</th><th>Detail</th></tr>${rows.map(r => `<tr><td>${esc(r.ts)}</td><td>${esc(r.user)}</td><td><span class="tag">${esc(r.action)}</span></td><td>${esc(r.entity)}</td><td>${esc(r.detail)}</td></tr>`).join('')}</table></div>`;
};

// ---------- settings / users / keys / profile ----------
routes.settings = async c => {
  const s = await api('settings');
  const F = [['site_name', 'Site name'], ['tagline', 'Tagline'], ['contact_email', 'Public contact email'], ['contact_phone', 'Public phone / WhatsApp'], ['address', 'Address'], ['notify_email', 'Send new-inquiry alerts to'], ['currency', 'Currency'], ['seo_title', 'Default SEO title'], ['seo_description', 'Default SEO description']];
  c.innerHTML = `<div class="page-h"><div><h1>Site settings</h1></div></div><form class="card" id="sf">${F.map(([k, l]) => `<label class="f">${l}<input name="${k}" value="${esc(s[k] || '')}"></label>`).join('')}<button class="btn btn--gold">Save settings</button></form>`;
  $('#sf').onsubmit = guard(async e => { e.preventDefault(); await api('settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Settings saved'); });
};
routes.users = async c => {
  const rows = await api('users');
  c.innerHTML = `<div class="page-h"><div><h1>Users &amp; roles</h1><p>Super admin: everything · Editor: content &amp; operations · Viewer: read-only</p></div><button class="btn btn--gold" id="nu">+ Add user</button></div>
  <div class="card"><table><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr>${rows.map(u => `<tr><td>${esc(u.name || '')}<small>${esc(u.email)}</small></td><td><select data-role="${u.id}">${['super_admin', 'editor', 'viewer'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><span class="tag ${u.active ? 'on' : 'off'}">${u.active ? 'active' : 'disabled'}</span></td><td>${esc(fmtDate(u.last_login) || 'never')}</td><td class="r"><button class="btn btn--sm" data-tog="${u.id}" data-a="${u.active}">${u.active ? 'Disable' : 'Enable'}</button> <button class="btn btn--sm" data-pw="${u.id}">Reset password</button> <button class="btn btn--sm btn--danger" data-del="${u.id}">Delete</button></td></tr>`).join('')}</table></div>`;
  $('#nu').onclick = guard(async () => { const email = prompt('Email address'); if (!email) return; const name = prompt('Full name') || ''; const password = prompt('Temporary password (at least 10 characters)'); if (!password) return; const role = prompt('Role: super_admin, editor or viewer', 'editor') || 'editor'; await api('users', { method: 'POST', body: { email, name, password, role } }); toast('User added'); render(); });
  c.querySelectorAll('[data-role]').forEach(s => s.onchange = guard(async () => { await api('users/' + s.dataset.role, { method: 'PUT', body: { role: s.value } }); toast('Role updated'); }));
  c.querySelectorAll('[data-tog]').forEach(b => b.onclick = guard(async () => { await api('users/' + b.dataset.tog, { method: 'PUT', body: { active: b.dataset.a === '1' ? 0 : 1 } }); render(); }));
  c.querySelectorAll('[data-pw]').forEach(b => b.onclick = guard(async () => { const p = prompt('New password (at least 10 characters)'); if (p) { await api('users/' + b.dataset.pw, { method: 'PUT', body: { password: p } }); toast('Password reset'); } }));
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = guard(async () => { if (confirm('Delete this user?')) { await api('users/' + b.dataset.del, { method: 'DELETE' }); render(); } }));
};
routes.keys = async c => {
  const rows = await api('keys');
  c.innerHTML = `<div class="page-h"><div><h1>API keys</h1><p>Send a key in the <code>X-API-Key</code> header to call the CMS API from other systems.</p></div><button class="btn btn--gold" id="nk">+ New key</button></div><div class="card"><table><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th></th></tr>${rows.map(k => `<tr><td>${esc(k.name)}</td><td><code>${esc(k.prefix)}…</code></td><td>${fmtDate(k.created_at)}</td><td>${esc(fmtDate(k.last_used) || 'never')}</td><td class="r"><button class="btn btn--sm btn--danger" data-del="${k.id}">Revoke</button></td></tr>`).join('') || '<tr><td colspan=5 class="empty">No keys yet</td></tr>'}</table></div>`;
  $('#nk').onclick = guard(async () => { const name = prompt('What is this key for?'); if (!name) return; const r = await api('keys', { method: 'POST', body: { name } }); prompt('Copy this key now. It will not be shown again:', r.key); render(); });
  c.querySelectorAll('[data-del]').forEach(b => b.onclick = guard(async () => { if (confirm('Revoke this key?')) { await api('keys/' + b.dataset.del, { method: 'DELETE' }); render(); } }));
};
routes.profile = async c => {
  c.innerHTML = `<div class="page-h"><div><h1>My profile</h1></div></div><form class="card" id="pf" style="max-width:520px"><label class="f">Email<input value="${esc(ME.email)}" disabled></label><label class="f">Display name<input name="name" value="${esc(ME.name || '')}"></label><h2 style="margin-top:8px">Change password</h2><label class="f">Current password<input type="password" name="current_password" autocomplete="current-password"></label><label class="f">New password (at least 10 characters)<input type="password" name="new_password" autocomplete="new-password"></label><button class="btn btn--gold">Save</button></form>`;
  $('#pf').onsubmit = guard(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (!d.new_password) { delete d.new_password; delete d.current_password; } await api('profile', { method: 'PUT', body: d }); toast('Profile saved'); ME = null; render(); });
};

render();
})();
