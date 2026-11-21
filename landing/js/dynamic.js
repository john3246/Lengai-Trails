// Database-driven pages: destinations, accommodations, blog, reviews, group departures,
// Kilimanjaro, safaris, FAQs and the booking form. Data comes from /api (PostgreSQL).
(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'USD ' + Number(n).toLocaleString('en-US');
  const q = new URLSearchParams(location.search);
  const api = (u, opt) => (window.__PREVIEW && /^content\/(destinations|accommodations|blog)\/[^/]+$/.test(u) ? Promise.resolve({ ok: true, json: () => Promise.resolve(window.__PREVIEW) }) : fetch('/api/' + u, opt)).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });
  const paras = t => window.CmsMd ? window.CmsMd.render(t) : String(t || '').split(/\n+/).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
  const setHero = (title, sub, img) => {
    document.title = title + ' | Lengai Trails Expeditions';
    const h = document.querySelector('.phero h1'); if (h) h.textContent = title;
    const s = document.querySelector('.phero__in > p:last-child'); if (s && sub != null) s.textContent = sub;
    const b = document.querySelector('.phero__bg'); if (b && img) b.src = abs(img);
  };
  const notFound = (el, back, label) => { el.innerHTML = `<p>We could not find that page. <a class="link" href="${back}">${label} &rarr;</a></p>`; };
  const CAT = { safari: 'Private safari', group: 'Group / joining', trekking: 'Trekking' };
  const tripCard = t => window.tripCardHtml(t);
  const fail = el => { el.innerHTML = '<p>This content could not be loaded. Please try again shortly.</p>'; };

  // ---- safaris (private) with filter chips ----
  let el = $('safarilist');
  if (el) api('tours?category=safari').then(rows => {
    const FIL = [['all', 'All'], ['luxury', 'Luxury'], ['midrange', 'Midrange'], ['migration', 'Migration'], ['calving', 'Calving season'], ['fly-in', 'Fly-in'], ['zanzibar', 'With Zanzibar'], ['day-trip', 'Day trips']];
    $('safarichips').innerHTML = FIL.map(([k, l]) => `<button class="chip" data-f="${k}">${l}</button>`).join('');
    const draw = f => { document.querySelectorAll('#safarichips .chip').forEach(c => c.classList.toggle('is-on', c.dataset.f === f)); const list = f === 'all' ? rows : rows.filter(t => (t.tags || []).includes(f)); $('safaricount').textContent = list.length + ' safaris'; $('safarilist').innerHTML = list.map(tripCard).join('') || '<p>No safaris in this category yet.</p>'; };
    $('safarichips').onclick = e => { const b = e.target.closest('.chip'); if (b) draw(b.dataset.f); };
    draw(q.get('f') || 'all');
  }).catch(() => fail($('safarilist')));

  // ---- Kilimanjaro & trekking ----
  el = $('kilist');
  if (el) api('tours?category=trekking').then(rows => {
    const groups = {};
    rows.forEach(t => { (groups[t.subcategory || 'Trekking'] = groups[t.subcategory || 'Trekking'] || []).push(t); });
    const order = ['Kilimanjaro', 'Mount Meru', 'Oldoinyo Lengai', 'Usambara'];
    $('kilist').innerHTML = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99).map(g => `<div class="sec__head" style="margin-top:28px"><div><p class="eyebrow">${esc(g)}</p><h2>${esc(g === 'Kilimanjaro' ? 'Kilimanjaro climbing routes' : g + ' treks')}</h2></div></div><div class="grid g3">${groups[g].map(tripCard).join('')}</div>`).join('');
  }).catch(() => fail($('kilist')));

  // ---- group safari: departures + packages ----
  el = $('deplist');
  if (el) {
    api('content/departures').then(rows => {
      $('deplist').innerHTML = rows.length ? `<table class="ptable dep"><tr><th>Departure</th><th>Package</th><th>Seats left</th><th>Per person</th><th></th></tr>${rows.map(d => `<tr><td>${esc(d.departure_date)}</td><td>${esc(d.tour)}</td><td>${esc(d.seats_left ?? '')}</td><td>${d.price_usd ? money(d.price_usd) : ''}</td><td><a class="link" href="/book?title=${encodeURIComponent(d.tour)}&date=${encodeURIComponent(d.departure_date || '')}">Book &rarr;</a></td></tr>`).join('')}</table>` : '<p>No fixed departures are scheduled right now. Tell us your dates and we will confirm the next open departure.</p>';
    }).catch(() => fail($('deplist')));
    api('tours?category=group').then(rows => { $('grouplist').innerHTML = rows.map(tripCard).join(''); }).catch(() => fail($('grouplist')));
  }

  // ---- destinations ----
  const short = t => String(t || '').replace(/\s*\([^)]*\)/g, '').trim();
  const DI = { tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2' };
  const di = n => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + DI[n] + '"/></svg>';
  const destCard = d => { const href = '/destinations/' + encodeURIComponent(d.slug); return `<article class="dcard"><a class="dcard__img" href="${href}"><img src="${esc(abs(d.image || '/assets/img/serengeti-04-card.webp'))}" alt="${esc(d.name)}" loading="lazy"></a><div class="dcard__b"><div class="dcard__h"><h3><a href="${href}">${esc(d.name)}</a></h3><span class="dcard__chip">${esc(d.region)}</span></div><p class="dcard__t">${esc(d.summary)}</p><ul class="dcard__facts">${d.price_from ? `<li>${di('tag')}<span>Packages from: <b>${money(d.price_from)}</b></span></li>` : ''}${d.best_time ? `<li>${di('cal')}<span>Best time: ${esc(short(d.best_time))}</span></li>` : ''}${d.high_season ? `<li>${di('sun')}<span>High season: ${esc(short(d.high_season))}</span></li>` : ''}</ul><a class="dcard__link" href="${href}#packages">${d.tour_count ? esc(d.name) + ' tours (' + d.tour_count + ')' : 'Explore ' + esc(d.name)} &rarr;</a></div></article>`; };
  el = $('destlist');
  if (el) api('content/destinations').then(rows => {
    const regions = ['Northern Tanzania', 'Southern Tanzania', 'The Coast', 'Mountains'];
    $('destlist').innerHTML = regions.filter(r => rows.some(x => x.region === r)).map(r => `<div id="${esc(r.split(' ')[0].toLowerCase().replace('the', 'coast'))}" class="sec__head" style="margin-top:26px"><div><p class="eyebrow">${esc(r)}</p><h2>${esc(r)}</h2></div></div><div class="dgrid">${rows.filter(x => x.region === r).map(destCard).join('')}</div>`).join('');
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(() => fail($('destlist')));
  el = $('destdetail');
  if (el) api('content/destinations/' + encodeURIComponent(slugOf())).then(async d => {
    setHero(d.name, d.summary, d.image);
    const kw = d.keyword || '';
    const [rel, stays] = await Promise.all([kw ? api('tours?mention=' + encodeURIComponent(kw)).catch(() => []) : [], api('content/accommodations').catch(() => [])]);
    const k = kw.replace(/^title:/, '').toLowerCase();
    const near = stays.filter(a => k && ((a.location || '') + ' ' + a.name).toLowerCase().includes(k)).slice(0, 4);
    const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
    const split = x => { const i = x.indexOf(':'); return i > 0 && i < 48 ? [x.slice(0, i), x.slice(i + 1).trim()] : ['', x]; };
    const hl = lines(d.highlights), acts = lines(d.activities), tips = lines(d.tips), wl = lines(d.wildlife);
    const facts = [['Best time to visit', d.best_time], ['High season', d.high_season], ['Weather', d.best_weather]].filter(f => f[1]);
    const sec = (title, body) => body ? `<section class="dsec"><h2>${title}</h2>${body}</section>` : '';
    const main = `<div class="dsec dsec--lead"><p class="meta">${esc(d.region)}</p>${paras(d.description)}</div>`
      + sec('Highlights', hl.length ? `<div class="dcards">${hl.map((x, i) => { const [t, tx] = split(x); return `<div class="dtile"><span class="dtile__n">${i + 1}</span><div>${t ? `<h3>${esc(t)}</h3>` : ''}<p>${esc(tx)}</p></div></div>`; }).join('')}</div>` : '')
      + sec('Things to do', acts.length ? `<ul class="dlist">${acts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
      + sec('Wildlife you may see', wl.length ? `<ul class="wl">${wl.map(x => { const [t, tx] = split(x); return `<li><b>${esc(t || tx)}</b>${t ? `<span>${esc(tx)}</span>` : ''}</li>`; }).join('')}</ul>` : '')
      + sec('Getting there', d.getting_there ? paras(d.getting_there) : '')
      + sec('Travel tips', tips.length ? `<ul class="dlist dlist--tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
      + sec('Where to stay', near.length ? `<div class="dstays">${near.map(a => `<a class="dstay" href="/accommodations/${encodeURIComponent(a.slug)}">${a.image ? `<img src="${esc(abs(a.image))}" alt="" loading="lazy">` : ''}<span><b>${esc(a.name)}</b><small>${esc([a.category, a.location].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</div>` : '');
    const side = `<aside class="dside"><div class="dside__card"><h3>Quick facts</h3><dl>${facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}${d.price_from ? `<div><dt>Packages from</dt><dd>${money(d.price_from)} per person</dd></div>` : ''}${d.tour_count ? `<div><dt>Packages</dt><dd>${d.tour_count} trips include ${esc(d.name)}</dd></div>` : ''}</dl><a class="btn btn--gold" href="/contact?interest=Safari&dates=">Plan a trip here</a><a class="dside__link" href="#packages">See packages &darr;</a></div></aside>`;
    $('destdetail').innerHTML = `<div class="ddetail"><div class="ddetail__main">${main}</div>${side}</div>${rel.length ? `<div class="sec__head sec__head--center" id="packages" style="margin-top:44px"><div><p class="eyebrow">Packages</p><h2>Trips that include ${esc(d.name)}</h2></div></div><div class="grid g4">${rel.slice(0, 8).map(tripCard).join('')}</div>` : ''}`;

  }).catch(() => notFound($('destdetail'), '/destinations', 'All destinations'));

  // ---- accommodations ----
  el = $('acclist');
  if (el) api('content/accommodations').then(rows => {
    const cats = ['Lodge', 'Tented camp', 'Camp', 'Hotel', 'Beach resort'].filter(c => rows.some(r => r.category === c));
    $('acclist').innerHTML = cats.map(c => `<div class="sec__head" style="margin-top:26px"><div><p class="eyebrow">${esc(c)}</p><h2>${esc(c === 'Camp' ? 'Campsites' : c + 's')}</h2></div></div><div class="grid g4">${rows.filter(r => r.category === c).map(a => `<a class="bcard" href="/accommodations/${encodeURIComponent(a.slug)}">${a.image ? `<img src="${esc(abs(a.image))}" alt="" loading="lazy">` : ''}<div><p class="meta">${esc(a.location || c)}</p><h3>${esc(a.name)}</h3>${a.description ? `<p>${esc(a.description.slice(0, 110))}</p>` : ''}<span class="link">Details &rarr;</span></div></a>`).join('')}</div>`).join('') || '<p>Accommodation listings are being added.</p>';
  }).catch(() => fail($('acclist')));
  el = $('accdetail');
  if (el) api('content/accommodations/' + encodeURIComponent(slugOf())).then(async a => {
    setHero(a.name, [a.category, a.location].filter(Boolean).join(' · '), a.image);
    const used = await api('tours?mention=' + encodeURIComponent(a.name.replace(/ (Lodge|Hotel|Camp|Tented Camp|Campsite)$/i, ''))).catch(() => []);
    $('accdetail').innerHTML = `<div class="pkmain" style="max-width:820px;margin-inline:auto">${a.stars ? `<p class="stars">${'&#9733;'.repeat(Math.min(5, a.stars))}</p>` : ''}${paras(a.description) || '<p>Full details for this property are coming soon. Ask us and we will tell you what we know.</p>'}<p><a class="btn btn--gold btn--sm" href="/contact">Ask about this stay</a></p></div>${used.length ? `<div class="sec__head" style="margin-top:34px"><div><p class="eyebrow">Where you can stay here</p><h2>Packages that use ${esc(a.name)}</h2></div></div><div class="grid g4">${used.slice(0, 8).map(tripCard).join('')}</div>` : ''}`;
  }).catch(() => notFound($('accdetail'), '/accommodations', 'All accommodations'));

  // ---- blog ----
  el = $('bloglist');
  if (el) api('content/blog').then(rows => {
    $('bloglist').innerHTML = rows.length ? rows.map(p => { const href = '/blogs/' + encodeURIComponent(p.slug); return `<article class="dcard dcard--pkg"><a class="dcard__img" href="${href}"><img src="${esc(abs(p.image || '/assets/img/serengeti-04.webp'))}" alt="${esc(p.title)}" loading="lazy"></a><div class="dcard__b"><div class="dcard__h"><h3><a href="${href}">${esc(p.title)}</a></h3><span class="dcard__chip">Safari guide</span></div>${p.excerpt ? `<p class="dcard__t">${esc(p.excerpt)}</p>` : ''}<ul class="dcard__facts">${p.published_at ? `<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/></svg><span>Published: <b>${esc(p.published_at)}</b></span></li>` : ''}${p.author ? `<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3-6 8-6s8 2 8 6"/></svg><span>By ${esc(p.author)}</span></li>` : ''}</ul><a class="dcard__link" href="${href}">Read guide &rarr;</a></div></article>`; }).join('') : '<p>New safari guides are on the way. In the meantime, <a class="link" href="/contact">ask us anything &rarr;</a></p>';
  }).catch(() => fail($('bloglist')));
  el = $('postdetail');
  if (el) api('content/blog/' + encodeURIComponent(slugOf())).then(p => {
    setHero(p.title, [p.author, p.published_at].filter(Boolean).join(' · '), p.image);
    $('postdetail').innerHTML = `<article class="pkmain" style="max-width:780px;margin-inline:auto">${paras(p.body || p.excerpt)}<p style="margin-top:24px"><a class="btn btn--gold btn--sm" href="/packages">Browse packages</a> <a class="link" href="/blogs">&larr; All guides</a></p></article>`;
  }).catch(() => notFound($('postdetail'), '/blogs', 'All guides'));

  // ---- reviews + submit form ----
  el = $('revlist');
  if (el) {
    api('content/reviews').then(rows => {
      const avg = rows.length ? (rows.reduce((a, r) => a + (Number(r.rating) || 5), 0) / rows.length).toFixed(1) : '';
      if ($('revavg')) $('revavg').textContent = avg ? avg + ' average from ' + rows.length + ' reviews' : '';
      $('revlist').innerHTML = rows.map(r => `<article class="review"><p class="stars">${'&#9733;'.repeat(Math.min(5, Number(r.rating) || 5))}</p>${r.headline ? `<h3>${esc(r.headline)}</h3>` : ''}<p>${esc(r.text)}</p><p class="who">${esc(r.name)}${r.country ? ', ' + esc(r.country) : ''}${r.tour ? ' · ' + esc(r.tour) : ''}</p></article>`).join('') || '<p>Be the first to share your experience.</p>';
    }).catch(() => fail($('revlist')));
    const f = $('revForm');
    if (f) f.addEventListener('submit', async e => {
      e.preventDefault(); const note = $('revNote'); note.textContent = 'Sending…';
      try { await api('review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) }); f.reset(); note.textContent = 'Thank you. Your review will appear once we have checked it.'; }
      catch (err) { note.textContent = err.message; }
    });
  }

  // ---- FAQs ----
  el = $('faqlist');
  if (el) api('content/faqs').then(rows => {
    const cats = [...new Set(rows.map(r => r.category || 'General'))];
    $('faqlist').innerHTML = cats.map(c => `<h2 style="margin:26px 0 10px">${esc(c)}</h2>${rows.filter(r => (r.category || 'General') === c).slice().reverse().map(r => `<details class="iday"><summary>${esc(r.question)}</summary>${paras(r.answer)}</details>`).join('')}`).join('') || '<p>Our FAQ is being written. <a class="link" href="/contact">Ask us a question &rarr;</a></p>';
  }).catch(() => fail($('faqlist')));

  // ---- booking form ----
  const bf = $('bookForm');
  if (bf) {
    let tours = [], cur = null;
    const sel = bf.elements.tour_slug, tra = bf.elements.travelers, dt = bf.elements.start_date;
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10); dt.min = tomorrow;
    if (q.get('date') && q.get('date') >= tomorrow) dt.value = q.get('date');
    const per = (t, n) => { const tiers = (t.price_tiers || []).slice().sort((a, b) => a.pax - b.pax); if (tiers.length) return (tiers.filter(r => r.pax <= n).pop() || tiers[0]).usd; return t.price_single || t.price_from || null; };
    const est = () => {
      const box = $('bookEst'); if (!cur) { box.innerHTML = ''; return; }
      const n = Math.max(1, parseInt(tra.value, 10) || 1), pp = per(cur, n);
      box.innerHTML = pp ? `<p class="meta">Estimated price</p><p class="from"><strong>${money(pp * n)}</strong> for ${n} ${n === 1 ? 'traveller' : 'travellers'}</p><p class="route">${money(pp)} per person at this group size. This is an estimate from our price list; we confirm the final price and payment details by email.</p>` : '<p class="route">We will send you a price for these dates and this group size.</p>';
    };
    const load = async slug => { cur = slug ? await api('tours/' + encodeURIComponent(slug)).catch(() => null) : null; if (cur) setHero('Book: ' + cur.title, cur.days ? cur.days + (cur.days === 1 ? ' day' : ' days') : '', cur.image); est(); };
    api('tours').then(rows => {
      tours = rows;
      let slug = q.get('slug') || '';
      if (!slug && q.get('title')) { const m = rows.find(t => t.title === q.get('title')); if (m) slug = m.slug; }
      sel.innerHTML = '<option value="">Choose a package…</option>' + ['safari', 'group', 'trekking'].map(c => `<optgroup label="${CAT[c]}">${rows.filter(t => t.category === c).map(t => `<option value="${esc(t.slug)}">${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
      sel.value = slug; load(slug);
    }).catch(() => { $('bookNote').textContent = 'Packages could not be loaded. Please try again.'; });
    sel.addEventListener('change', () => load(sel.value)); tra.addEventListener('input', est);
    bf.addEventListener('submit', async e => {
      e.preventDefault(); const note = $('bookNote'); const d = Object.fromEntries(new FormData(bf));
      if (!d.tour_slug) { note.textContent = 'Please choose a package.'; return; }
      if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email || '')) { note.textContent = 'Please enter your name and a valid email.'; return; }
      note.textContent = 'Sending your booking request…'; bf.querySelector('button[type=submit]').disabled = true;
      try {
        const r = await api('booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        $('bookWrap').innerHTML = `<div class="pkbox" style="max-width:640px"><p class="meta">Booking request received</p><h2>Thank you, ${esc(d.name.split(' ')[0])}</h2><p>Your reference is <strong>${esc(r.reference)}</strong>.</p><p>${esc(r.title)}<br>Start date: ${esc(d.start_date)} · ${esc(d.travelers)} ${Number(d.travelers) === 1 ? 'traveller' : 'travellers'}</p>${r.estimate ? `<p class="from">Estimated total <strong>${money(r.estimate)}</strong></p>` : ''}<p class="route">This is a request, not a confirmed booking. A travel consultant in Arusha will email ${esc(d.email)} within one working day with availability, the final price and how to pay the deposit.</p><p><a class="btn btn--gold btn--sm" href="/packages">Browse more packages</a></p></div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { note.textContent = err.message; bf.querySelector('button[type=submit]').disabled = false; }
    });
  }

  // ---- safari explorer (filters + sort) ----
  const sfl = $('sflist');
  if (sfl) {
    const STYLE = { migration: 'Great Migration', calving: 'Calving season', 'fly-in': 'Fly-in', luxury: 'Luxury', midrange: 'Midrange', budget: 'Budget', family: 'Family', honeymoon: 'Honeymoon', zanzibar: 'Zanzibar & beach', cultural: 'Cultural', camping: 'Camping', 'day-trip': 'Day trips', kilimanjaro: 'Kilimanjaro', meru: 'Mount Meru', 'lengai-natron': 'Lengai & Natron', usambara: 'Usambara' };
    const LEN = { '1': [1, 1, '1 day'], '2': [2, 3, '2 to 3 days'], '4': [4, 6, '4 to 6 days'], '7': [7, 99, '7+ days'] };
    const st = { cat: q.get('c') || 'all', styles: new Set(), len: new Set(), max: 0, text: '', sort: 'popular' };
    const f0 = q.get('style') || q.get('f'); if (f0) st.styles.add(f0);
    let all = [];
    const cnt = (fn) => all.filter(fn).length;
    const render = () => {
      let l = all.filter(t => (st.cat === 'all' || t.category === st.cat)
        && (!st.styles.size || [...st.styles].every(x => (t.tags || []).includes(x)))
        && (!st.len.size || [...st.len].some(k => t.days >= LEN[k][0] && t.days <= LEN[k][1]))
        && (!st.max || !t.price_from || t.price_from <= st.max)
        && (!st.text || (t.title + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(st.text)));
      const by = { 'price-asc': (a, b) => (a.price_from || 9e9) - (b.price_from || 9e9), 'price-desc': (a, b) => (b.price_from || 0) - (a.price_from || 0), 'days-asc': (a, b) => (a.days || 99) - (b.days || 99), 'days-desc': (a, b) => (b.days || 0) - (a.days || 0) }[st.sort];
      if (by) l = l.slice().sort(by);
      $('sfcount').textContent = l.length + (l.length === 1 ? ' package matches' : ' packages match');
      sfl.innerHTML = l.map(tripCard).join('') || '<p>No packages match these filters. <button class="link" id="sfclear2" type="button">Clear filters</button></p>';
      const c2 = $('sfclear2'); if (c2) c2.onclick = clear;
      $('sfmaxv').textContent = st.max ? 'Up to ' + money(st.max) : 'Any budget';
    };
    const clear = () => { st.cat = 'all'; st.styles.clear(); st.len.clear(); st.max = 0; st.text = ''; $('sfmax').value = $('sfmax').max; $('sfq').value = ''; build(); };
    const build = () => {
      const cats = [['all', 'All packages'], ['safari', 'Private safaris'], ['group', 'Group & joining'], ['trekking', 'Trekking']];
      $('sfcat').innerHTML = cats.map(([k, l]) => `<label class="chk"><input type="radio" name="sfc" value="${k}"${st.cat === k ? ' checked' : ''}> ${l} <small>${k === 'all' ? all.length : cnt(t => t.category === k)}</small></label>`).join('');
      const tags = {}; all.forEach(t => (t.tags || []).forEach(x => tags[x] = (tags[x] || 0) + 1));
      $('sfstyle').innerHTML = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).map(k => `<label class="chk"><input type="checkbox" data-s="${esc(k)}"${st.styles.has(k) ? ' checked' : ''}> ${esc(STYLE[k] || k)} <small>${tags[k]}</small></label>`).join('');
      $('sflen').innerHTML = Object.keys(LEN).map(k => `<label class="chk"><input type="checkbox" data-l="${k}"${st.len.has(k) ? ' checked' : ''}> ${LEN[k][2]}</label>`).join('');
      render();
    };
    api('tours').then(rows => {
      all = rows;
      const top = Math.max(...all.map(t => t.price_from || 0), 1000), mx = Math.ceil(top / 500) * 500;
      const r = $('sfmax'); r.max = mx; r.min = 250; r.step = 250; r.value = mx;
      r.oninput = () => { st.max = +r.value >= mx ? 0 : +r.value; render(); };
      $('sfq').oninput = e => { st.text = e.target.value.trim().toLowerCase(); render(); };
      $('sfsort').onchange = e => { st.sort = e.target.value; render(); };
      $('sfclear').onclick = clear;
      $('sffilters').addEventListener('change', e => {
        const t = e.target;
        if (t.name === 'sfc') st.cat = t.value;
        else if (t.dataset.s) t.checked ? st.styles.add(t.dataset.s) : st.styles.delete(t.dataset.s);
        else if (t.dataset.l) t.checked ? st.len.add(t.dataset.l) : st.len.delete(t.dataset.l);
        render();
      });
      build();
    }).catch(() => fail(sfl));
  }
})();
