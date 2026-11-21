const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
document.getElementById('yr').textContent = new Date().getFullYear();

// Safaris page: filter chips (also supports ?f=luxury)
const chips = document.getElementById('chips');
if (chips) {
  const cards = document.querySelectorAll('#tripgrid .trip');
  const apply = f => {
    chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', c.dataset.f === f));
    cards.forEach(c => { c.style.display = (f === 'all' || c.dataset.cat === f) ? '' : 'none'; });
  };
  chips.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) apply(b.dataset.f); });
  apply(new URLSearchParams(location.search).get('f') || 'all');
}

// ---- helpers ----
const abs = u => (!u || /^(https?:|\/|data:)/.test(u)) ? u : '/' + u;
const slugOf = () => { const s = location.pathname.split('/').filter(Boolean); return s.length > 1 ? decodeURIComponent(s[s.length - 1]) : (new URLSearchParams(location.search).get('slug') || ''); };
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'USD ' + Number(n).toLocaleString('en-US');
// Package card shared by every list on the site (same design as the destination cards)
const TI = { clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4', tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01' };
const tIco = n => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + TI[n] + '"/></svg>';
const STYLES = [['luxury', 'Luxury'], ['honeymoon', 'Honeymoon'], ['family', 'Family'], ['migration', 'Migration'], ['midrange', 'Mid-range'], ['budget', 'Budget'], ['fly-in', 'Fly-in'], ['zanzibar', 'With Zanzibar'], ['cultural', 'Cultural'], ['camping', 'Camping'], ['day-trip', 'Day trip']];
const CATS_L = { safari: 'Private safari', group: 'Group safari', trekking: 'Trekking' };
window.tripCardHtml = t => {
  const chip = (STYLES.find(([k]) => (t.tags || []).includes(k)) || [])[1] || t.subcategory || CATS_L[t.category] || 'Safari';
  const href = '/packages/' + encodeURIComponent(t.slug);
  const dur = t.days ? t.days + (t.days > 1 ? ' Days / ' + (t.days - 1) + ' Nights' : ' Day') : '';
  return '<article class="dcard dcard--pkg"><a class="dcard__img" href="' + href + '"><img src="' + esc(abs(t.image)) + '" alt="' + esc(t.title) + '" loading="lazy"></a><div class="dcard__b"><div class="dcard__h"><h3><a href="' + href + '">' + esc(t.title) + '</a></h3><span class="dcard__chip">' + esc(chip) + '</span></div>' + (t.summary ? '<p class="dcard__t">' + esc(t.summary) + '</p>' : '') + '<ul class="dcard__facts">' + (dur ? '<li>' + tIco('clock') + '<span>Duration: <b>' + dur + '</b></span></li>' : '') + (t.route ? '<li>' + tIco('pin') + '<span>Route: ' + esc(t.route) + '</span></li>' : '') + '<li>' + tIco('tag') + '<span>' + (t.price_from ? 'From: <b>' + money(t.price_from) + '</b> per person' : 'Price on request') + '</span></li></ul><a class="dcard__link" href="' + href + '">View itinerary &amp; price &rarr;</a></div></article>';
};


// ---- visitor tracking (cookie-free, feeds CMS "Website traffic") ----
try { fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: location.pathname + location.search, title: document.title, ref: document.referrer }), keepalive: true }).catch(() => {}); } catch (e) {}

// ---- enquiry forms post to the CMS database ----
async function sendInquiry(form, note, extra) {
  const d = Object.assign(Object.fromEntries(new FormData(form)), extra || {});
  if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email || '')) { note.textContent = 'Please enter your name and a valid email.'; return; }
  note.textContent = 'Sending…';
  try {
    const r = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not send');
    form.reset(); note.textContent = 'Thank you. We received your request and will reply within one working day.';
  } catch (err) {
    note.textContent = err.message + ' You can also email info@lengaitrails.com.';
  }
}
const form = document.getElementById('quoteForm');
if (form) form.addEventListener('submit', e => { e.preventDefault(); sendInquiry(form, document.getElementById('formNote')); });

// ---- packages list (reads /api/tours) ----
const pkgrid = document.getElementById('pkgrid');
if (pkgrid) {
  const CAT = { safari: 'Private safari', group: 'Group / joining', trekking: 'Trekking' };
  let all = [];
  const draw = f => {
    document.querySelectorAll('#pkchips .chip').forEach(c => c.classList.toggle('is-on', c.dataset.f === f));
    const list = f === 'all' ? all : all.filter(t => t.category === f);
    document.getElementById('pkcount').textContent = list.length + ' packages';
    pkgrid.innerHTML = list.map(window.tripCardHtml).join('') || '<p>No packages in this category yet.</p>';
  };
  fetch('/api/tours').then(r => r.json()).then(rows => {
    all = rows;
    document.getElementById('pkchips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) draw(b.dataset.f); });
    draw(new URLSearchParams(location.search).get('c') || 'all');
  }).catch(() => { pkgrid.innerHTML = '<p>Packages could not be loaded. Please try again shortly.</p>'; });
}

// ---- package detail (reads /api/tours/:slug) ----
const pkd = document.getElementById('pkdetail');
if (pkd) {
  const slug = slugOf();
  const getJ = u => fetch(u).then(r => r.ok ? r.json() : []).catch(() => []);
  const ACT = [[/game drive/i, 'Game drive'], [/picnic/i, 'Picnic lunch'], [/boat/i, 'Boat safari'], [/walking safari|guided walk/i, 'Walking safari'], [/balloon/i, 'Hot-air balloon'], [/hadzabe|datoga|cultural/i, 'Cultural visit'], [/canoe/i, 'Canoe safari'], [/spice/i, 'Spice farm visit'], [/stone town/i, 'Stone Town tour'], [/snorkel/i, 'Snorkelling'], [/flight|fly /i, 'Flight'], [/trek|hik|climb|summit/i, 'Trekking'], [/waterfall/i, 'Waterfall walk']];
  Promise.all([(window.__PREVIEW ? Promise.resolve(window.__PREVIEW) : fetch('/api/tours/' + encodeURIComponent(slug)).then(r => { if (!r.ok) throw 0; return r.json(); })), getJ('/api/content/destinations'), getJ('/api/content/accommodations')]).then(([t, dests, accs]) => {
    document.title = t.title + ' | Lengai Trails Expeditions';
    const h1 = document.querySelector('.phero h1'); if (h1) h1.textContent = t.title;
    const sub = document.querySelector('.phero__in > p:last-child'); if (sub) sub.textContent = [t.days ? t.days + (t.days === 1 ? ' day' : ' days') : '', t.subcategory, t.type].filter(Boolean).join(' · ');
    const bg = document.querySelector('.phero__bg'); if (bg && t.image) bg.src = abs(t.image);
    const ul = a => a && a.length ? '<ul>' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '';
    const p = a => (a || []).map(x => `<p>${esc(x)}</p>`).join('');
    const tiers = t.price_tiers || [];
    const price = tiers.length
      ? `<table class="ptable"><tr><th>Group size</th><th>Per person</th></tr>${tiers.map(r => `<tr><td>${r.pax} ${r.pax === 1 ? 'traveller' : 'travellers'}</td><td>${money(r.usd)}</td></tr>`).join('')}</table>`
      : t.price_single ? `<p class="from">${money(t.price_single)} / person</p>${t.price_note ? `<p class="route">${esc(t.price_note)}</p>` : ''}` : '<p class="from">Price on request</p>';
    const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const findDest = (name, title) => {
      const n = norm(name);
      if (n) { const d = dests.find(x => norm(x.name) === n || x.slug === n.replace(/ /g, '-') || norm(x.name).includes(n) || (x.keyword && n.includes(norm(x.keyword)))); if (d) return d; }
      const tt = norm(title); let best = null, at = -1;
      dests.forEach(d => { const k = norm(d.keyword || String(d.name).split(' ')[0]); const i = k ? tt.lastIndexOf(k) : -1; if (i > at) { at = i; best = d; } });
      return best;
    };
    const findAcc = name => { const n = norm(String(name || '').replace(/\s+or similar$/i, '')); return n ? accs.find(a => norm(a.name) === n) : null; };
    const wild = d => String(d.wildlife || '').split('\n').map(x => x.split(':')).filter(x => x[0].trim()).map(([n, l]) => ({ n: n.trim(), l: (l || '').trim() }));
    const dayHtml = d => {
      const m = d.meta || {};
      const dest = findDest(m.Destination, d.title);
      const accName = m.Accommodation || m.Overnight || '';
      const acc = findAcc(accName);
      let acts = m.Activities ? m.Activities.split(',').map(x => x.trim()).filter(Boolean) : [];
      if (!acts.length) { const txt = (d.body || []).join(' ') + ' ' + d.title; acts = ACT.filter(([re]) => re.test(txt)).map(a => a[1]); }
      const meals = m.Meals || m['Meal Plan'] || '';
      const skip = ['Destination', 'Activities', 'Accommodation', 'Overnight', 'Meals', 'Meal Plan'];
      const stats = Object.entries(m).filter(([k]) => !skip.includes(k));
      const w = dest ? wild(dest) : [];
      const destBox = dest ? `<div class="ifact ifact--dest"><h4>Main destination</h4><p><a class="link" href="/destinations/${encodeURIComponent(dest.slug)}">${esc(dest.name)}</a></p>${dest.best_time ? `<dl><dt>Best time to visit</dt><dd>${esc(dest.best_time)}</dd>${dest.high_season ? `<dt>High season</dt><dd>${esc(dest.high_season)}</dd>` : ''}${dest.best_weather ? `<dt>Best weather</dt><dd>${esc(dest.best_weather)}</dd>` : ''}</dl>` : ''}${w.length ? `<h5>Wildlife you may see</h5><ul class="wl">${w.slice(0, 8).map(x => `<li class="wl--${esc(x.l.toLowerCase())}"><b>${esc(x.n)}</b><span>${esc(x.l)}</span></li>`).join('')}</ul>` : ''}</div>` : '';
      const accBox = accName ? `<div class="ifact"><h4>Accommodation</h4><p>${acc ? `<a class="link" href="/accommodations/${encodeURIComponent(acc.slug)}">${esc(acc.name)}</a>` : esc(accName)}</p>${acc ? `<p class="route">${esc([acc.category, acc.location].filter(Boolean).join(' · '))}</p>` : ''}</div>` : '';
      return `<article class="iday2" id="day-${esc(d.day)}"><header><span class="iday2__n">Day ${esc(d.day)}</span><h3>${esc(d.title)}</h3></header><div class="iday2__b">${p(d.body)}</div>
        <div class="ifacts">${destBox}${acts.length ? `<div class="ifact"><h4>Activities</h4><ul>${acts.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}${accBox}${meals ? `<div class="ifact"><h4>Meals &amp; drinks</h4><p>${esc(meals)}</p></div>` : ''}${stats.length ? `<div class="ifact"><h4>Details</h4><dl>${stats.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}</div></article>`;
    };
    const itin = t.itinerary || [];
    const zan = /zanzibar/i.test(t.title);
    const days = itin.length ? `<section class="pksec" id="itinerary"><h2>Day by day</h2>
      <div class="iarr"><b>Arrival</b><p>You are collected from Kilimanjaro International Airport (JRO) or your Arusha hotel. Extra nights before the tour can be arranged at extra cost.</p></div>
      ${itin.map(dayHtml).join('')}
      <div class="iarr"><b>End of tour</b><p>${zan ? 'You are transferred to the airport for your onward flight. Extra nights on Zanzibar can be arranged.' : 'You are dropped at the airport or your hotel. Additional accommodation can be arranged for an extra cost.'}</p></div></section>` : '';
    const hasInc = (t.inclusions || []).length || (t.exclusions || []).length;
    const nav = [['overview', 'Overview'], itin.length ? ['itinerary', 'Day by day'] : null, ['rates', 'Price'], hasInc ? ['inclusions', 'Inclusions'] : null, ['getting-there', 'Getting there']].filter(Boolean);
    pkd.innerHTML = `<div class="pkgrid"><div class="pkmain">
      <nav class="pknav" aria-label="Page sections">${nav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
      <section class="pksec" id="overview">${p(t.overview)}${t.highlights && t.highlights.length ? '<h2>Highlights</h2>' + ul(t.highlights) : ''}</section>
      ${days}
      <section class="pksec" id="rates"><h2>Price</h2>${price}<p class="route" style="margin-top:8px">Prices in US dollars, per person. The final quote depends on dates and group size.</p></section>
      ${hasInc ? `<section class="pksec" id="inclusions"><div class="pkinc"><div><h2>Included</h2>${ul(t.inclusions)}</div><div><h2>Not included</h2>${ul(t.exclusions)}</div></div></section>` : ''}
      <section class="pksec" id="getting-there"><h2>Getting there</h2><p>Most guests fly into Kilimanjaro International Airport (JRO), about an hour from Arusha, where we meet you. ${zan ? 'Zanzibar airport (ZNZ) is used for the island part of the trip. ' : ''}Tell us your flight details when you book and we arrange the transfers.</p></section>
      ${(t.notes || []).length ? '<section class="pksec"><h2>Good to know</h2>' + p(t.notes) + '</section>' : ''}</div>
      <aside class="pkside"><div class="pkbox"><p class="meta">From</p>${t.price_from ? `<p class="from"><strong>${money(t.price_from)}</strong> / person</p>` : '<p class="from">Price on request</p>'}<p class="route" style="margin-top:8px">Prices in US dollars, per person.</p><a class="btn btn--gold" style="margin-top:12px;width:100%;justify-content:center;text-align:center" href="/book?slug=${encodeURIComponent(t.slug)}">Book this package</a></div>
      <form class="form" id="pkForm" novalidate><h3>Ask about this package</h3><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Phone / WhatsApp<input name="phone"></label><div class="row"><label>Travel dates<input name="dates" placeholder="e.g. July 2027"></label><label>Travellers<input name="pax" type="number" min="1"></label></div><label>Message<textarea name="msg" rows="3"></textarea></label><button class="btn btn--gold" type="submit">Request a quote</button><p class="note" id="pkNote" role="status"></p></form></aside></div>`;
    document.getElementById('pkForm').addEventListener('submit', e => { e.preventDefault(); sendInquiry(e.target, document.getElementById('pkNote'), { interest: t.title, source: 'Package: ' + t.title }); });
  }).catch(() => { pkd.innerHTML = '<p>This package could not be found. <a class="link" href="/packages">See all packages &rarr;</a></p>'; });
}

// ---- whole-card links: clicking anywhere on a card opens its page ----
document.addEventListener('click', e => {
  if (e.target.closest('a, button, input, select, textarea, label')) return;
  const card = e.target.closest('article.trip, article.offer, .bcard, .region, .guide');
  const a = card && card.querySelector('a[href]');
  if (a) location.href = a.getAttribute('href');
});

// ---- home hero: rotate the background pictures, thumbnails pick one ----
(() => {
  const slides = [...document.querySelectorAll('.hero__slide')], thumbs = [...document.querySelectorAll('.hero__thumbs button')];
  if (slides.length < 2) return;
  let cur = 0, timer;
  const show = i => { cur = (i + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('is-on', k === cur)); thumbs.forEach((t, k) => t.classList.toggle('is-on', k === cur)); slides[cur].loading = 'eager'; };
  const start = () => { clearInterval(timer); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(cur + 1), 6500); };
  thumbs.forEach(t => t.addEventListener('click', () => { show(+t.dataset.i); start(); }));
  start();
})();

// ---- mega dropdowns: intro, links, popular trips (from the database) and a featured card ----
(() => {
  const items = [...document.querySelectorAll('.nav__item')]; if (!items.length) return;
  const JSONget = u => fetch(u).then(r => r.ok ? r.json() : []).catch(() => []);
  Promise.all([JSONget('/api/tours'), JSONget('/api/content/destinations')]).then(([tours, dests]) => {
    if (!tours.length) return;
    const by = c => tours.filter(t => t.category === c);
    const rank = l => l.slice().sort((a, b) => (b.featured || 0) - (a.featured || 0));
    const meta = t => (t.days ? t.days + (t.days > 1 ? ' Days / ' + (t.days - 1) + ' Nights' : ' Day') : '') + (t.price_from ? ' · From ' + money(t.price_from) : '');
    const CFG = {
      '/destinations': { t: 'Where we go', d: 'From the Serengeti and Ngorongoro to Kilimanjaro and Zanzibar, explore the places we know best.', all: 'Browse all ' + dests.length + ' destinations', col: 'Regions', pop: 'Popular destinations', dests: true },
      '/safaris': { t: 'Tanzania safaris', d: 'Private, tailor-made and small-group safaris across the Northern Circuit and beyond.', all: 'Browse all ' + by('safari').length + ' safaris', col: 'Safari styles', pop: 'Popular safaris', list: rank(by('safari')) },
      '/packages': { t: 'All packages', d: 'Safaris, group trips and climbs, each with a day-by-day itinerary and a clear price.', all: 'Browse all ' + tours.length + ' packages', col: 'Browse by type', pop: 'Popular trips', list: rank(by('safari')).slice(0, 2).concat(rank(by('trekking')).slice(0, 1), rank(by('group')).slice(0, 1)) },
      '/group-safari': { t: 'Group safaris', d: 'Share the vehicle and the cost on fixed departures with a professional guide.', all: 'See all group departures', col: 'Group safaris', pop: 'Popular group trips', list: rank(by('group')) },
      '/kilimanjaro': { t: 'Climb Kilimanjaro', d: 'Fully supported climbs on six routes with experienced mountain guides.', all: 'Browse all ' + by('trekking').length + ' climbs & treks', col: 'Kilimanjaro', pop: 'Popular climbs', list: rank(by('trekking')) }
    };
    items.forEach(it => {
      const top = it.querySelector(':scope > a'), sub = it.querySelector('.submenu'); if (!top || !sub) return;
      const key = (top.getAttribute('href') || '').split(/[?#]/)[0], c = CFG[key]; if (!c) return;
      const links = [...sub.querySelectorAll('a')].map(a => '<a href="' + esc(a.getAttribute('href')) + '"><i></i>' + esc(a.textContent) + '</a>').join('');
      let pop = '', feat = '';
      if (c.dests) {
        const PRI = ['serengeti', 'ngorongoro-crater', 'tarangire', 'lake-manyara', 'zanzibar', 'kilimanjaro', 'ruaha', 'nyerere']; const ds = dests.filter(d => d.slug).sort((x, y) => (PRI.indexOf(x.slug) + 99) % 99 - (PRI.indexOf(y.slug) + 99) % 99).slice(0, 6);
        pop = ds.map(d => '<a class="mega__trip" href="/destinations/' + encodeURIComponent(d.slug) + '"><b>' + esc(d.name) + '</b><small>' + esc(d.region) + '</small></a>').join('');
        const f = dests.find(d => d.slug === 'serengeti') || ds[0];
        if (f) feat = '<a class="mega__feat" href="/destinations/' + encodeURIComponent(f.slug) + '" style="background-image:url(' + esc(abs(f.image)) + ')"><span><em>Featured destination</em><b>' + esc(f.name) + '</b><small>' + esc(f.region) + '</small></span></a>';
      } else {
        const l = (c.list || []).slice(0, 5);
        pop = l.map(t => '<a class="mega__trip" href="/packages/' + encodeURIComponent(t.slug) + '"><b>' + esc(t.title) + '</b><small>' + esc(meta(t)) + '</small></a>').join('');
        const f = (c.list || []).find(t => (t.tags || []).includes('luxury')) || (c.list || [])[0];
        if (f) feat = '<a class="mega__feat" href="/packages/' + encodeURIComponent(f.slug) + '" style="background-image:url(' + esc(abs(f.image)) + ')"><span><em>Featured journey</em><b>' + esc(f.title) + '</b><small>' + esc(f.days ? f.days + (f.days > 1 ? ' Days' : ' Day') : '') + '</small></span></a>';
      }
      sub.classList.add('is-mega');
      sub.innerHTML = '<div class="mega"><div class="mega__col mega__col--links"><h5>' + esc(c.col) + '</h5><a class="mega__all" href="' + esc(key) + '">' + esc(c.all) + ' &rarr;</a>' + links + '</div><div class="mega__col mega__col--pop"><h5>' + esc(c.pop) + '</h5>' + pop + '</div>' + feat + '</div>';
    });
  });
})();

// ---- homepage sections are filled from the database (the static markup is only a fallback) ----
(() => {
  if (!document.getElementById('featured') || !document.getElementById('offers')) return;
  const ICP = { pin: 'M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4', tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3-6 8-6s8 2 8 6' };
  const ico = n => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICP[n] + '"/></svg>';
  fetch('/api/home').then(r => (r.ok ? r.json() : null)).then(h => {
    if (!h) return;
    const fill = (sel, html) => { const el = document.querySelector(sel); if (el && html) el.innerHTML = html; };
    if (h.featured && h.featured.length && window.tripCardHtml) fill('#featured .grid', h.featured.slice(0, 4).map(window.tripCardHtml).join(''));
    if (h.kili && h.kili.length && window.tripCardHtml) fill('#kilimanjaro .grid', h.kili.map(window.tripCardHtml).join(''));
    if (h.offers && h.offers.length) fill('#offers .grid', h.offers.map(o => {
      const href = '/packages/' + encodeURIComponent(o.slug), n = v => Number(v).toLocaleString('en-US');
      return '<article class="dcard dcard--pkg"><a class="dcard__img" href="' + href + '"><img src="' + esc(abs(o.image)) + '" alt="' + esc(o.title) + '" loading="lazy">' + (o.percent ? '<span class="tag">' + o.percent + '% off</span>' : '') + '</a><div class="dcard__b"><div class="dcard__h"><h3><a href="' + href + '">' + esc(o.title) + '</a></h3>' + (o.label ? '<span class="dcard__chip">' + esc(o.label) + '</span>' : '') + '</div>' + (o.summary ? '<p class="dcard__t">' + esc(o.summary) + '</p>' : '') + '<ul class="dcard__facts">' + (o.route ? '<li>' + ico('pin') + '<span>Route: ' + esc(o.route) + '</span></li>' : '') + (o.saving ? '<li>' + ico('tag') + '<span>Previous price: <s>USD ' + n(o.previous) + '</s> · Save ' + o.percent + '% · USD ' + n(o.saving) + '</span></li>' : '') + '<li>' + ico('tag') + '<span>Offer price: <b>USD ' + n(o.price) + '</b> per person</span></li>' + (o.child_note ? '<li>' + ico('user') + '<span>' + esc(o.child_note) + '</span></li>' : '') + '</ul><a class="dcard__link" href="' + href + '">View offer &rarr;</a></div></article>';
    }).join(''));
    if (h.guides && h.guides.length) fill('#guides .grid', h.guides.map(p => {
      const href = '/blogs/' + encodeURIComponent(p.slug);
      return '<article class="dcard dcard--pkg"><a class="dcard__img" href="' + href + '"><img src="' + esc(abs(p.image || '/assets/img/serengeti-04.webp')) + '" alt="' + esc(p.title) + '" loading="lazy"></a><div class="dcard__b"><div class="dcard__h"><h3><a href="' + href + '">' + esc(p.title) + '</a></h3><span class="dcard__chip">Safari guide</span></div>' + (p.excerpt ? '<p class="dcard__t">' + esc(p.excerpt) + '</p>' : '') + '<ul class="dcard__facts">' + (p.published_at ? '<li>' + ico('cal') + '<span>Published: <b>' + esc(p.published_at) + '</b></span></li>' : '') + (p.author ? '<li>' + ico('user') + '<span>By ' + esc(p.author) + '</span></li>' : '') + '</ul><a class="dcard__link" href="' + href + '">Read guide &rarr;</a></div></article>';
    }).join(''));
  }).catch(() => {});
})();

// ---- home planner: next 12 months in the month picker ----
(() => {
  const sel = document.getElementById('plan-month'); if (!sel) return;
  const d = new Date(); d.setDate(1);
  for (let i = 0; i < 12; i++) { sel.add(new Option(d.toLocaleString('en', { month: 'long', year: 'numeric' }))); d.setMonth(d.getMonth() + 1); }
  sel.selectedIndex = 1;
})();

// ---- contact: prefill from the home planner (?interest=&month=&travellers=) ----
(() => {
  const f = document.getElementById('quoteForm'); if (!f) return;
  const q = new URLSearchParams(location.search); if (![...q.keys()].length) return;
  const map = { Safari: 'Safari', Kilimanjaro: 'Kilimanjaro climb', Zanzibar: 'Zanzibar holiday' };
  const sel = f.elements.interest, i = q.get('interest');
  if (sel && map[i]) sel.value = map[i];
  const m = q.get('month'); if (m && f.elements.dates && m !== 'Not sure yet') f.elements.dates.value = m;
  const t = q.get('travellers'), n = t && t.match(/\d+/); if (n && f.elements.pax) f.elements.pax.value = n[0];
})();
