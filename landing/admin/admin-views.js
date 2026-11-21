/* Dashboard, generic list view, traffic and reports. */
(() => {
const { $, $$, esc, usd, fmtDate, enc, api, toast, guard, routes, icon } = window.CMS, CMS = window.CMS;
const tag = (t, on) => `<span class="tag ${on ? 'on' : ''}">${esc(t)}</span>`;
const GOOD = ['published', 'open', 'Paid', 'active', 'Confirmed', 'New', 'Completed'];

// ---------- dashboard ----------
routes.dashboard = async c => {
  const d = await api('dashboard'), k = d.counts, ME = CMS.ME, empty = t => `<div class="empty">${t}</div>`;
  const tile = (l, v, s) => `<div class="tile"><small>${l}</small><b>${v}</b><span>${s || '&nbsp;'}</span></div>`;
  const max = Math.max(1, ...d.overview.map(o => o.total));
  const qa = [['New tour', '#/tours/new'], ['New blog post', '#/blog/new'], ['New destination', '#/destinations/new'], ['New accommodation', '#/accommodations/new'], ['Media library', '#/media'], ['Bookings', '#/bookings'], ['Inquiries', '#/inquiries'], ['Site settings', '#/settings']];
  const chart = (s) => { const m = Math.max(1, ...s.map(x => x.views)); return `<div class="chart">${s.map(x => `<div class="col"><div class="bars" title="${x.visitors} visitors, ${x.views} views"><div class="pv" style="height:${x.views / m * 100}%"></div><div class="vs" style="height:${x.visitors / m * 100}%"></div></div><div class="lbl">${esc(x.day.slice(8))}</div></div>`).join('')}</div><div class="legend"><span><i style="background:var(--gold)"></i>Visitors</span><span><i style="background:#e6d9ae"></i>Page views</span></div>`; };
  c.innerHTML = `<div class="ph"><div><h1>Welcome back, ${esc((ME.name || ME.email).split(' ')[0])}</h1><p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><div class="ph__r"><a class="btn btn--gold" href="#/tours/new">${icon('plus')} New tour</a></div></div>
  <div class="tiles">${tile('Tours', k.tours, k.published + ' published')}${tile('Drafts', k.drafts, 'need review')}${tile('Bookings', k.bookings, k.newBookings + ' new')}${tile('Inquiries', k.inquiries, k.newInquiries + ' new')}${tile('Reviews', k.pendingReviews, 'waiting for approval')}${tile('Customers', k.customers)}${tile('Media files', k.media)}${tile('Paid invoices', usd(k.revenue))}</div>
  <div class="grid g3"><div class="panel"><h2>Recent bookings <a href="#/bookings">View all</a></h2>${d.recentBookings.length ? `<table><tr><th>Ref</th><th>Guest</th><th>Date</th><th>Status</th><th class="r">Amount</th></tr>${d.recentBookings.map(r => `<tr><td><a class="t" href="#/bookings/${r.id}">${esc(r.reference)}</a></td><td>${esc(r.customer)}<small>${esc(r.tour)}</small></td><td>${esc(r.start_date || '')}</td><td>${tag(r.status, r.status === 'New')}</td><td class="r num">${r.total_usd ? usd(r.total_usd) : '—'}</td></tr>`).join('')}</table>` : empty('No bookings yet')}</div>
  <div class="panel"><h2>Latest inquiries <a href="#/inquiries">View all</a></h2>${d.recentInquiries.length ? `<table>${d.recentInquiries.map(r => `<tr><td><a class="t" href="#/inquiries/${r.id}">${esc(r.name)}</a><small>${esc(r.interest || r.email || '')}</small></td><td>${tag(r.status, r.status === 'New')}</td><td class="r">${fmtDate(r.created_at)}</td></tr>`).join('')}</table>` : empty('No inquiries yet')}</div>
  <div class="panel"><h2>Quick actions</h2><div class="qa">${qa.map(([l, h]) => `<a href="${h}">${l}</a>`).join('')}</div></div></div>
  <div class="grid g3"><div class="panel"><h2>Content overview</h2>${d.overview.map(o => `<div class="ov"><span>${esc(o.label)}</span><div class="t"><i style="width:${o.total / max * 100}%"></i></div><small>${o.published}/${o.total}</small></div>`).join('')}</div>
  <div class="panel"><h2>Drafts needing review</h2>${d.drafts.length ? `<table>${d.drafts.map(r => `<tr><td><a class="t" href="#/${r.kind}/${r.id}">${esc(r.title || '(untitled)')}</a><small>${esc(r.type)}</small></td><td>${tag(r.status)}</td><td class="r">${fmtDate(r.updated_at)}</td></tr>`).join('')}</table>` : empty('Everything is published')}</div>
  <div class="panel"><h2>Upcoming trips <a href="#/bookings">View all</a></h2>${d.upcoming.length ? `<table>${d.upcoming.map(r => `<tr><td>${esc(r.start_date)}</td><td><a class="t" href="#/bookings/${r.id}">${esc(r.customer)}</a><small>${esc(r.tour)}</small></td><td>${tag(r.status, r.status === 'New')}</td></tr>`).join('')}</table>` : empty('Nothing scheduled')}</div></div>
  <div class="grid g21"><div class="panel"><h2>Visitors, last 7 days <a href="#/traffic">Details</a></h2>${chart(d.traffic.series)}</div><div class="panel"><h2>Latest media <a href="#/media">Library</a></h2><div class="lm">${d.latestMedia.map(m => `<img src="/${esc(m.url)}" alt="" title="${esc(m.name)}">`).join('') || empty('No uploads yet')}</div></div></div>`;
};

// ---------- generic list ----------
const COLS = {
  tours: [['title', 'Package', 'title'], ['category', 'Type', 'cat'], ['days', 'Days'], ['price_from', 'From', 'usd'], ['featured', 'On home', 'bool'], ['status', 'Status', 'status']],
  destinations: [['name', 'Destination', 'title'], ['region', 'Region'], ['best_time', 'Best time'], ['status', 'Status', 'status']],
  accommodations: [['name', 'Name', 'title'], ['location', 'Location'], ['category', 'Category'], ['stars', 'Stars'], ['status', 'Status', 'status']],
  blog: [['title', 'Title', 'title'], ['author', 'Author'], ['published_at', 'Published'], ['status', 'Status', 'status']],
  faqs: [['question', 'Question', 'title'], ['category', 'Category'], ['status', 'Status', 'status']],
  reviews: [['name', 'Guest', 'title'], ['country', 'Country'], ['rating', 'Rating'], ['date', 'Date'], ['status', 'Status', 'status']],
  testimonials: [['name', 'Name', 'title'], ['role', 'Role'], ['status', 'Status', 'status']],
  offers: [['title', 'Offer', 'title'], ['tour', 'Package'], ['discount', 'Saving', 'usd'], ['valid_until', 'Valid until'], ['status', 'Status', 'status']],
  group: [['tour', 'Package', 'title'], ['departure_date', 'Departure'], ['seats_left', 'Seats left'], ['price_usd', 'Price', 'usd'], ['status', 'Status', 'status']],
  bookings: [['reference', 'Reference', 'title'], ['customer', 'Guest'], ['tour', 'Package'], ['start_date', 'Start'], ['total_usd', 'Total', 'usd'], ['status', 'Status', 'status']],
  inquiries: [['name', 'Name', 'title'], ['email', 'Email'], ['interest', 'Interest'], ['created_at', 'Received', 'date'], ['status', 'Status', 'status']],
  customers: [['name', 'Name', 'title'], ['email', 'Email'], ['country', 'Country'], ['trips', 'Trips']],
  invoices: [['number', 'Number', 'title'], ['customer', 'Customer'], ['amount_usd', 'Amount', 'usd'], ['due', 'Due'], ['status', 'Status', 'status']],
  clients: [['name', 'Name', 'title'], ['email', 'Email'], ['country', 'Country'], ['status', 'Status', 'status']],
  tasks: [['title', 'Task', 'title'], ['assignee', 'Assigned'], ['due', 'Due'], ['status', 'Status', 'status']],
  integrations: [['name', 'Name', 'title'], ['type', 'Type'], ['event', 'Event'], ['active', 'State']]
};
const CAT = { safari: 'Private safari', group: 'Group', trekking: 'Trekking' };
const QUICK = ['bookings', 'inquiries', 'invoices', 'tasks', 'clients', 'group'];
const LIMIT = 50;

CMS.list = async (c, kind) => {
  const R = CMS.SCHEMA[kind], st = JSON.parse(sessionStorage.getItem('ls_' + kind) || '{}');
  const q = st.q || '', status = st.status || '', page = st.page || 0;
  const data = await api(`r/${kind}?q=${enc(q)}&status=${enc(status)}&category=${enc(st.category || "")}&limit=${LIMIT}&offset=${page * LIMIT}&sort=${enc(st.sort || 'newest')}`);
  const rows = data.rows, cols = COLS[kind] || [[R.title, R.single, 'title']];
  const publishable = !!(R.statuses && R.statuses.includes('draft'));
  const save = patch => { sessionStorage.setItem('ls_' + kind, JSON.stringify({ ...st, ...patch })); CMS.reload(); };
  const cell = (r, [k, , t]) => {
    const v = r[k];
    if (t === 'title') return `<a class="t" href="#/${kind}/${r.id}">${kind === 'tours' && r.image ? `<img class="th" src="/${esc(r.image)}" alt=""> ` : ''}${esc(v || '(untitled)')}</a>${kind === 'tours' ? `<small>/${esc(r.slug)}</small>` : ''}`;
    if (t === 'status') return QUICK.includes(kind) && R.statuses ? `<select class="btn btn--sm" data-st="${r.id}">${R.statuses.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : tag(v, GOOD.includes(v));
    if (t === 'usd') return `<span class="num">${v ? usd(v) : '—'}</span>`;
    if (t === 'cat') return esc(CAT[v] || v);
    if (t === 'bool') return v ? tag('Yes', true) : '<span class="muted">—</span>';
    if (t === 'date') return esc(fmtDate(v));
    return esc(v == null ? '' : v);
  };
  const pages = Math.max(1, Math.ceil(data.total / LIMIT));
  c.innerHTML = `<div class="ph"><div><h1>${esc(R.label)}</h1><p>${data.total} record${data.total === 1 ? '' : 's'}</p></div><div class="ph__r"><a class="btn" href="/cms/api/export/${kind}">Export CSV</a><a class="btn btn--gold" href="#/${kind}/new">${icon('plus')} New ${esc(R.single.toLowerCase())}</a></div></div>
  ${R.statuses ? `<div class="tabs"><button class="${!status ? 'on' : ''}" data-s="">All</button>${R.statuses.map(s => `<button class="${status === s ? 'on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
  <div class="bar"><input type="search" id="lq" placeholder="Search ${esc(R.label.toLowerCase())}…" value="${esc(q)}">${kind === 'tours' ? `<select id="lcat"><option value="">All types</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${st.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}<select id="lsort"><option value="newest">Newest first</option><option value="updated" ${st.sort === 'updated' ? 'selected' : ''}>Recently edited</option><option value="title" ${st.sort === 'title' ? 'selected' : ''}>A to Z</option><option value="oldest" ${st.sort === 'oldest' ? 'selected' : ''}>Oldest first</option></select></div>
  <div class="bulk" id="bulk" hidden><b id="bn"></b>${publishable ? '<button class="btn btn--sm" data-b="publish">Publish</button><button class="btn btn--sm" data-b="draft">Unpublish</button>' : ''}<button class="btn btn--sm btn--danger" data-b="delete">Delete</button></div>
  <div class="tbl-wrap"><table><tr><th style="width:24px"><input type="checkbox" id="ball" aria-label="Select all"></th>${cols.map(x => `<th>${esc(x[1])}</th>`).join('')}<th class="r">Actions</th></tr>
  ${rows.map(r => `<tr><td><input type="checkbox" data-sel="${r.id}"></td>${cols.map(x => `<td>${cell(r, x)}</td>`).join('')}<td class="r"><a class="btn btn--sm" href="#/${kind}/${r.id}">Edit</a> <button class="btn btn--sm" data-dup="${r.id}" title="Duplicate">${icon('copy')}</button></td></tr>`).join('') || `<tr><td colspan="${cols.length + 2}" class="empty">Nothing here yet.</td></tr>`}</table></div>
  <div class="pager"><span>Page ${page + 1} of ${pages}</span><span><button class="btn btn--sm" id="prev" ${page ? '' : 'disabled'}>Previous</button> <button class="btn btn--sm" id="next" ${page + 1 < pages ? '' : 'disabled'}>Next</button></span></div>`;
  $$('[data-s]', c).forEach(b => b.onclick = () => save({ status: b.dataset.s, page: 0 }));
  let t; $('#lq').oninput = e => { clearTimeout(t); t = setTimeout(() => save({ q: e.target.value, page: 0 }), 350); };
  const lc = $('#lcat'); if (lc) lc.onchange = e => save({ category: e.target.value, page: 0 });
  $('#lsort').onchange = e => save({ sort: e.target.value, page: 0 });
  $('#prev').onclick = () => save({ page: page - 1 }); $('#next').onclick = () => save({ page: page + 1 });
  const sel = new Set(), bar = $('#bulk'), sync = () => { bar.hidden = !sel.size; $('#bn').textContent = sel.size + ' selected'; $('#ball').checked = sel.size > 0 && sel.size === rows.length; $$('[data-sel]', c).forEach(b => b.closest('tr').classList.toggle('sel', b.checked)); };
  $$('[data-sel]', c).forEach(b => b.onchange = () => { b.checked ? sel.add(b.dataset.sel) : sel.delete(b.dataset.sel); sync(); });
  $('#ball').onchange = e => { $$('[data-sel]', c).forEach(b => { b.checked = e.target.checked; e.target.checked ? sel.add(b.dataset.sel) : sel.delete(b.dataset.sel); }); sync(); };
  $$('[data-b]', bar).forEach(b => b.onclick = guard(async () => { const a = b.dataset.b; if (a === 'delete' && !confirm('Permanently delete ' + sel.size + ' item(s)? This cannot be undone.')) return; await api('bulk/' + kind, { method: 'POST', body: { ids: [...sel], action: a } }); toast('Done'); CMS.reload(); }));
  $$('[data-dup]', c).forEach(b => b.onclick = guard(async () => { const r = await api(`duplicate/${kind}/${b.dataset.dup}`, { method: 'POST', body: {} }); toast('Copy created as a draft'); location.hash = `#/${kind}/${r.id}`; }));
  $$('[data-st]', c).forEach(s => s.onchange = guard(async () => { await api(`r/${kind}/${s.dataset.st}`, { method: 'PUT', body: { status: s.value } }); toast('Status updated'); }));
};

// ---------- traffic ----------
routes.traffic = async c => {
  const days = Number(localStorage.getItem('tdays')) || 8, t = await api('traffic?days=' + days);
  const maxC = Math.max(1, ...t.countries.map(x => x.visitors)), m = Math.max(1, ...t.series.map(x => x.views));
  const bars = (rows, label) => rows.length ? rows.map(r => `<div class="ov" style="grid-template-columns:130px 1fr 40px"><span>${label(r)}</span><div class="t"><i style="width:${r.visitors / Math.max(1, ...rows.map(x => x.visitors)) * 100}%"></i></div><small>${r.visitors}</small></div>`).join('') : '<div class="empty">No visits recorded yet.</div>';
  c.innerHTML = `<div class="ph"><div><h1>Website traffic</h1><p>${t.totals.visitors} visitors · ${t.totals.views} page views in the last ${days} days</p></div><select class="btn" id="td">${[8, 30, 90].map(n => `<option value="${n}" ${n === days ? 'selected' : ''}>Last ${n} days</option>`).join('')}</select></div>
  <div class="panel"><h2>Visitors over time</h2><div class="chart" style="height:170px">${t.series.map(x => `<div class="col"><div class="bars" title="${x.visitors} visitors, ${x.views} views"><div class="pv" style="height:${x.views / m * 100}%"></div><div class="vs" style="height:${x.visitors / m * 100}%"></div></div><div class="lbl">${t.series.length > 14 ? (x.day.slice(8) === '01' ? x.day.slice(5) : '') : x.day.slice(5)}</div></div>`).join('')}</div></div>
  <div class="grid g2"><div class="panel"><h2>Most visited pages</h2><table><tr><th>Page</th><th class="r">Visitors</th><th class="r">Views</th></tr>${t.pages.map(p => `<tr><td>${esc(p.title || p.path)}<small>${esc(p.path)}</small></td><td class="r">${p.visitors}</td><td class="r">${p.views}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">No data yet</td></tr>'}</table></div>
  <div class="panel"><h2>Countries</h2>${bars(t.countries, r => esc(r.country === '??' ? 'Unknown' : (new Intl.DisplayNames(['en'], { type: 'region' }).of(r.country) || r.country)))}<h2 style="margin-top:12px">Sources</h2>${bars(t.refs, r => esc(r.ref))}<h2 style="margin-top:12px">Devices</h2>${bars(t.devices, r => esc(r.device))}</div></div>`;
  $('#td').onchange = e => { localStorage.setItem('tdays', e.target.value); CMS.reload(); };
};

// ---------- reports ----------
routes.reports = async c => {
  const r = await api('reports'), tbl = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(x => `<tr>${x.map((v, i) => `<td class="${i ? 'r' : ''}">${v}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}" class="empty">No data yet</td></tr>`}</table>`;
  c.innerHTML = `<div class="ph"><div><h1>Reports</h1></div></div><div class="grid g2"><div class="panel"><h2>Bookings by status</h2>${tbl(['Status', 'Bookings', 'Value'], r.byStatus.map(x => [esc(x.status), x.n, usd(x.usd)]))}</div><div class="panel"><h2>Invoices</h2>${tbl(['Status', 'Count', 'Amount'], r.invoices.map(x => [esc(x.status), x.n, usd(x.usd)]))}</div>
  <div class="panel"><h2>Top booked packages</h2>${tbl(['Package', 'Bookings', 'Value'], r.topTours.map(x => [esc(x.tour || '—'), x.n, usd(x.usd)]))}</div><div class="panel"><h2>Inquiries by status</h2>${tbl(['Status', 'Count'], r.inquiries.map(x => [esc(x.status), x.n]))}</div></div>
  <div class="panel"><h2>Package catalogue</h2>${tbl(['Type', 'Packages', 'Lowest price', 'Highest price'], r.catalog.map(x => [esc(CAT[x.category] || x.category), x.n, usd(x.min_price), usd(x.max_price)]))}</div>`;
};
})();
