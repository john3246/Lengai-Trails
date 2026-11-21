/* Lengai CMS core: api client (CSRF), shell, router, sign-in. Views live in admin-views.js, admin-editor.js and admin-system.js. */
(() => {
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = n => n == null || n === '' ? '—' : 'USD ' + Number(n).toLocaleString('en-US');
const fmtDate = s => s ? String(s).slice(0, 10) : '';
const enc = encodeURIComponent;
const CMS = window.CMS = { $, $$, esc, usd, fmtDate, enc, routes: {}, ME: null, SCHEMA: {}, CSRF: '', BADGE: 0, dirty: () => false, lastHash: '#/dashboard' };

async function api(path, opt = {}) {
  const headers = {}; if (opt.body) headers['Content-Type'] = 'application/json'; if (opt.method && opt.method !== 'GET') headers['X-CSRF-Token'] = CMS.CSRF;
  const r = await fetch('/cms/api/' + path, { method: opt.method || 'GET', headers, body: opt.body ? JSON.stringify(opt.body) : undefined, credentials: 'same-origin' });
  if (r.status === 401 && path !== 'login' && path !== 'me') { if (CMS.ME) { CMS.ME = null; loginView('Your session has ended. Please sign in again.'); } throw new Error('Signed out'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status });
  return j;
}
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', err ? 4200 : 2200); }
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'Signed out') toast(e.message, true); } };
Object.assign(CMS, { api, toast, guard });

// ---------- icons + navigation ----------
const I = { dash: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4', bed: 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6', doc: 'M6 3h9l4 4v14H6zM14 3v5h5', img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', chat: 'M4 5h16v11H9l-5 4z', tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', q: 'M9 9a3 3 0 116 0c0 2-3 2-3 4M12 17h.01', users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 010 7M22 21c0-3-2-5-5-5.5', check: 'M4 12l5 5L20 6', mail: 'M3 6h18v12H3zM3 7l9 7 9-7', bill: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1', key: 'M14 10a4 4 0 11-3 3L3 21v-3h3v-3h3l2-2', gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1-1-2H9L8 7 6 8 4 7 2 11l2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z', pulse: 'M3 12h4l3-8 4 16 3-8h4', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3-6 8-6s8 2 8 6', plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', print: 'M7 9V3h10v6M6 17H4v-6h16v6h-2M7 14h10v7H7z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', out: 'M10 4H5v16h5M15 8l4 4-4 4M9 12h10', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', copy: 'M9 9h11v11H9zM5 15V4h11', trip: 'M4 20l5-9 4 6 3-4 4 7z' };
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${I[n]}"/></svg>`;
const NAV = [
  [['dashboard', 'Dashboard', 'dash'], ['traffic', 'Website traffic', 'chart']],
  [['tours', 'Tours', 'trip'], ['destinations', 'Destinations', 'pin'], ['accommodations', 'Accommodations', 'bed'], ['blog', 'Blog', 'doc'], ['faqs', 'FAQs', 'q'], ['reviews', 'Guest reviews', 'star'], ['testimonials', 'Testimonials', 'chat'], ['offers', 'Holiday offers', 'tag'], ['group', 'Group safari', 'users'], ['media', 'Media library', 'img']],
  [['bookings', 'Bookings', 'bed', 1], ['inquiries', 'Inquiries', 'mail'], ['customers', 'Customers', 'users'], ['invoices', 'Invoices', 'bill'], ['clients', 'Client records', 'doc'], ['tasks', 'Tasks', 'check'], ['reports', 'Reports', 'chart']],
  [['integrations', 'Integrations', 'link'], ['keys', 'API keys', 'key'], ['users', 'Users & roles', 'users'], ['settings', 'Site settings', 'gear'], ['status', 'System status', 'pulse'], ['audit', 'Audit log', 'doc']]
];
Object.assign(CMS, { icon, I });
const ADD = ['tours', 'blog', 'destinations', 'accommodations', 'faqs', 'offers'];

function shell(active, inner) {
  const ME = CMS.ME, ini = (ME.name || ME.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const rail = NAV.map(g => g.filter(([k]) => ME.role === 'super_admin' || !['integrations', 'keys', 'users', 'settings', 'audit'].includes(k)).map(([k, l, ic, b]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}" aria-label="${esc(l)}">${icon(ic)}${b && CMS.BADGE ? `<span class="b">${CMS.BADGE}</span>` : ''}<span class="tip">${esc(l)}</span></a>`).join('')).filter(Boolean).join('<i class="rail__sep"></i>');
  return `<div class="shell"><aside class="rail"><a class="rail__logo" href="#/dashboard" aria-label="Dashboard"><img src="/assets/logo-t.png" alt=""></a>${rail}<div class="rail__grow"></div><a href="#/profile" class="${active === 'profile' ? 'on' : ''}" aria-label="My profile">${icon('user')}<span class="tip">My profile</span></a></aside>
  <div class="main"><div class="top"><div class="search">${icon('search')}<input id="gsearch" placeholder="Search tours, destinations, bookings…" autocomplete="off"><button class="x" id="gclear" aria-label="Clear" hidden>&times;</button><div class="sresults" id="sres" hidden></div></div>
    <select class="btn" id="addnew" aria-label="Add new"><option value="">+ Add</option>${ADD.map(k => `<option value="${k}">${esc(CMS.SCHEMA[k].single)}</option>`).join('')}</select>
    <button class="btn" id="print">${icon('print')} Print</button><a class="btn" href="/" target="_blank" rel="noopener">${icon('eye')} View site</a><span class="top__sp"></span>
    <div class="userbox"><div><b>${esc(ME.name || ME.email)}</b><small>${esc(ME.role.replace('_', ' '))}</small></div><button class="btn btn--sm" id="signout">${icon('out')} Sign out</button></div></div>
  <div class="content" id="content">${inner}</div></div></div>`;
}

// ---------- router ----------
const route = () => { const h = location.hash.replace(/^#\/?/, '').split('/'); return { page: h[0] || 'dashboard', id: h[1], sub: h[2] }; };
let seq = 0;
async function render() {
  const my = ++seq;
  if (!CMS.ME) {
    try { const r = await api('me'); CMS.ME = r.user; CMS.SCHEMA = r.schema; CMS.CSRF = r.csrf; } catch { return loginView(); }
  }
  if (CMS.dirty() && !confirm('You have unsaved changes. Leave without saving?')) { history.replaceState(null, '', CMS.lastHash); return; }
  CMS.dirty = () => false; CMS.lastHash = location.hash || '#/dashboard';
  const { page, id } = route();
  try { const d = await api('dashboard'); CMS.BADGE = d.counts.newBookings; CMS.dash = d; } catch {}
  if (my !== seq || !CMS.ME) return;
  app.innerHTML = shell(page, '<div class="empty">Loading…</div>'); wire();
  const c = $('#content');
  try {
    let fn = CMS.routes[page];
    if (!fn && CMS.SCHEMA[page]) fn = (el, i, s) => (i ? CMS.editor(el, page, i) : CMS.list(el, page));
    if (!fn) fn = el => { el.innerHTML = '<div class="empty">Page not found</div>'; };
    await fn(c, id, route().sub);
  } catch (e) { if (e.message !== 'Signed out') c.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
}
function wire() {
  $('#signout').onclick = async () => { await api('logout', { method: 'POST' }).catch(() => {}); CMS.ME = null; location.hash = ''; loginView(); };
  $('#print').onclick = () => window.print();
  $('#addnew').onchange = e => { if (e.target.value) location.hash = '#/' + e.target.value + '/new'; e.target.value = ''; };
  const gs = $('#gsearch'), res = $('#sres'), clr = $('#gclear'); let t;
  gs.oninput = () => { clr.hidden = !gs.value; clearTimeout(t); t = setTimeout(async () => { if (gs.value.length < 2) { res.hidden = true; return; } const r = await api('search?q=' + enc(gs.value)).catch(() => []); res.innerHTML = r.length ? r.map(x => `<a href="${esc(x.hash)}"><span>${esc(x.title)}</span><small>${esc(x.type)}</small></a>`).join('') : '<div class="empty">No matches</div>'; res.hidden = false; }, 220); };
  clr.onclick = () => { gs.value = ''; clr.hidden = true; res.hidden = true; };
  document.onclick = e => { if (!e.target.closest('.search')) res.hidden = true; if (e.target.closest('#sres a')) { res.hidden = true; gs.value = ''; clr.hidden = true; } };
}
CMS.render = render; CMS.reload = () => { seq++; render(); };
window.addEventListener('hashchange', render);

// ---------- sign-in ----------
function loginView(notice) {
  const keep = ($('#lemail') || {}).value || '';
  app.innerHTML = `<div class="auth"><aside class="auth__side"><div class="auth__shade"></div><div class="auth__brand"><img src="/assets/logo-light.png" alt="Lengai Trails Expeditions"></div>
  <div class="auth__pitch"><h2>Run your whole website from one place</h2><p>Tours, destinations, bookings, enquiries and every page of the site, in a single secure dashboard.</p><ul><li>Update packages and prices instantly</li><li>Preview every change before it goes live</li><li>Reply to enquiries and manage bookings</li></ul></div>
  <p class="auth__copy">&copy; ${new Date().getFullYear()} Lengai Trails Expeditions</p></aside>
  <main class="auth__main"><form id="lf" class="auth__card" novalidate><img class="auth__logo" src="/assets/logo.png" alt="Lengai Trails Expeditions"><h1>Welcome back</h1><p class="auth__sub">Sign in to manage the Lengai Trails website.</p>
  <div class="auth__alert" id="le" role="alert" aria-live="polite" ${notice ? '' : 'hidden'}>${esc(notice || '')}</div>
  <label class="auth__f"><span>Email address</span><input id="lemail" name="email" type="email" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@example.com" value="${esc(keep)}"></label>
  <label class="auth__f"><span>Password</span><div class="auth__pw"><input id="lpass" name="password" type="password" required autocomplete="current-password" placeholder="Your password"><button type="button" id="lshow" class="auth__eye" aria-label="Show password" tabindex="-1">Show</button></div></label>
  <p class="auth__caps" id="lcaps" hidden>Caps Lock is on</p><button class="auth__btn" id="lbtn" type="submit"><span class="auth__spin" hidden></span><span id="lbtxt">Sign in</span></button>
  <p class="auth__foot"><a href="/">&larr; Back to the website</a></p></form></main></div>`;
  const f = $('#lf'), email = $('#lemail'), pass = $('#lpass'), btn = $('#lbtn'), err = $('#le'), show = m => { err.textContent = m; err.hidden = !m; };
  (keep ? pass : email).focus();
  $('#lshow').onclick = () => { const on = pass.type === 'password'; pass.type = on ? 'text' : 'password'; $('#lshow').textContent = on ? 'Hide' : 'Show'; pass.focus(); };
  pass.addEventListener('keyup', e => { $('#lcaps').hidden = !(e.getModifierState && e.getModifierState('CapsLock')); }); pass.addEventListener('blur', () => { $('#lcaps').hidden = true; });
  let busy = false;
  f.onsubmit = async e => {
    e.preventDefault(); if (busy) return;
    const d = { email: email.value.trim(), password: pass.value };
    if (!d.email || !d.password) { show('Enter your email address and password.'); (d.email ? pass : email).focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(d.email)) { show('That does not look like a valid email address.'); email.focus(); return; }
    busy = true; btn.disabled = true; $('.auth__spin', btn).hidden = false; $('#lbtxt').textContent = 'Signing in…'; show('');
    try { await api('login', { method: 'POST', body: d }); $('#lbtxt').textContent = 'Opening dashboard…'; CMS.ME = null; busy = false; render(); }
    catch (er) { busy = false; btn.disabled = false; $('.auth__spin', btn).hidden = true; $('#lbtxt').textContent = 'Sign in'; show(er instanceof TypeError ? 'Cannot reach the server. Check your connection and try again.' : er.message); pass.value = ''; pass.focus(); }
  };
}
window.addEventListener('load', render);
window.addEventListener('beforeunload', e => { if (CMS.dirty()) { e.preventDefault(); e.returnValue = ''; } });
})();
