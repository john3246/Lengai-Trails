/* Full-page record editor for every content type (no pop-up forms): left info panel, tabbed main area,
   formatting editor with preview, ordered lists, attachments and a live preview of the real public page. */
(() => {
const { $, $$, esc, usd, fmtDate, enc, api, toast, guard, icon } = window.CMS, CMS = window.CMS;
const tag = (t, on) => `<span class="tag ${on ? 'on' : ''}">${esc(t)}</span>`;

// ---------- media drawer (choose or upload a picture) ----------
function pickMedia(done, opts = {}) {
  const back = document.createElement('div'); back.className = 'drawer__back';
  const d = document.createElement('aside'); d.className = 'drawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Media library');
  d.innerHTML = `<header><span>Choose a file</span><button class="btn btn--sm" id="dx">Close</button></header><div class="drawer__body"><div class="bar"><input type="search" id="dq" placeholder="Search files…" style="flex:1"><label class="btn btn--gold" style="cursor:pointer">Upload<input id="du" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden></label></div><div class="mgrid" id="dg"><div class="empty">Loading…</div></div></div>`;
  document.body.append(back, d);
  const close = () => { back.remove(); d.remove(); document.removeEventListener('keydown', esc_); }, esc_ = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc_); back.onclick = close; $('#dx', d).onclick = close;
  let items = [];
  const draw = t => { $('#dg', d).innerHTML = items.filter(i => (opts.images === false || !/\.pdf$/i.test(i.url)) && i.name.toLowerCase().includes(t)).map((i, n) => `<div class="mitem" data-n="${items.indexOf(i)}" tabindex="0"><img src="/${/\.pdf$/i.test(i.url) ? 'assets/logo-t.png' : esc(i.url)}" loading="lazy" alt=""><div>${esc(i.name)}</div></div>`).join('') || '<div class="empty">No files</div>'; };
  api('media').then(m => { items = m; draw(''); });
  $('#dq', d).oninput = e => draw(e.target.value.toLowerCase());
  $('#dg', d).onclick = guard(async e => { const it = e.target.closest('.mitem'); if (!it) return; let row = items[+it.dataset.n]; if (!row.id && opts.needId) row = await api('media/import', { method: 'POST', body: { url: row.url } }); close(); done(row); });
  $('#du', d).onchange = guard(async e => { const f = e.target.files[0]; if (!f) return; const row = await uploadFile(f); close(); done(row); });
}
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function uploadFile(f) { if (f.size > 8e6) throw new Error('Files must be smaller than 8 MB.'); return api('media', { method: 'POST', body: { name: f.name, data: await readFile(f) } }); }
CMS.pickMedia = pickMedia; CMS.uploadFile = uploadFile;

// ---------- form pieces ----------
const lblHtml = (f, inner, extra = '') => `<label class="f ${extra}" data-k="${esc(f.k)}"><span>${esc(f.l)}${f.req ? ' <b style="color:var(--danger)">*</b>' : ''}</span>${inner}</label>`;
function fieldHtml(f, v) {
  const val = v == null ? '' : v, nm = `data-f="${esc(f.k)}"`;
  if (f.t === 'select') return lblHtml(f, `<select ${nm}>${f.o.map(o => `<option ${String(val || f.o[0]) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
  if (f.t === 'textarea') return lblHtml(f, `<textarea ${nm} ${f.max ? `maxlength="${f.max}"` : ''}>${esc(val)}</textarea>`);
  if (f.t === 'image') return `<div class="f" data-k="${esc(f.k)}"><span style="display:block;font-size:10.5px;font-weight:800;color:var(--muted);margin-bottom:3px">${esc(f.l)}</span><div class="imgpick">${val ? `<img src="/${esc(val)}" alt="">` : '<div class="ph0">No image</div>'}<input type="hidden" ${nm} value="${esc(val)}"><button type="button" class="btn btn--sm" data-pick="${esc(f.k)}">Choose</button>${val ? `<button type="button" class="btn btn--sm" data-clear="${esc(f.k)}">Remove</button>` : ''}</div></div>`;
  if (f.t === 'tour') return lblHtml(f, `<input ${nm} list="tl" value="${esc(val)}" placeholder="Start typing a package name" autocomplete="off">`);
  const type = { number: 'number', date: 'date', email: 'email' }[f.t] || 'text';
  return lblHtml(f, `<input ${nm} type="${type}" ${type === 'number' ? 'step="any"' : ''} value="${esc(val)}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.auto ? 'placeholder="auto"' : ''} ${f.auto && val ? 'readonly' : ''}>`);
}
function mdHtml(f, v) {
  return `<div class="f" data-k="${esc(f.k)}"><span style="display:block;font-size:10.5px;font-weight:800;color:var(--muted);margin-bottom:3px">${esc(f.l)}</span><div class="md" data-md="${esc(f.k)}"><div class="md__bar">
  ${[['B', 'bold', 'Bold'], ['I', 'italic', 'Italic'], ['H2', 'h2', 'Heading'], ['H3', 'h3', 'Subheading'], ['• List', 'ul', 'Bullet list'], ['1. List', 'ol', 'Numbered list'], ['Quote', 'quote', 'Quote'], ['Link', 'link', 'Link'], ['Image', 'image', 'Insert picture']].map(([l, a, t]) => `<button type="button" class="btn" data-a="${a}" title="${t}">${l}</button>`).join('')}
  <span class="sp"></span><button type="button" class="btn" data-a="split">Side-by-side preview</button></div>
  <div class="md__body"><textarea data-f="${esc(f.k)}" spellcheck="true">${esc(v == null ? '' : v)}</textarea><div class="md__prev" hidden></div></div><div class="md__cnt"><span data-w></span><span class="hint">One line is one paragraph. Use the buttons above for headings, lists and pictures.</span></div></div></div>`;
}
function wireMd(root, onChange, focusSet) {
  $$('.md', root).forEach(box => {
    const ta = $('textarea', box), prev = $('.md__prev', box), body = $('.md__body', box);
    const refresh = () => { $('[data-w]', box).textContent = (ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0) + ' words'; if (!prev.hidden) prev.innerHTML = window.CmsMd ? CmsMd.render(ta.value) : ''; };
    const ins = (a, b = '', ph = '') => { const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph; ta.value = ta.value.slice(0, s) + a + sel + b + ta.value.slice(e); ta.focus(); ta.setSelectionRange(s + a.length, s + a.length + sel.length); onChange(); refresh(); };
    const line = p => { const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.value = ta.value.slice(0, s) + p + ta.value.slice(s); ta.focus(); onChange(); refresh(); };
    ta.addEventListener('input', () => { onChange(); refresh(); }); ta.addEventListener('focus', () => focusSet(ta)); refresh();
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'bold') ins('**', '**', 'bold text'); else if (a === 'italic') ins('*', '*', 'italic'); else if (a === 'h2') line('# '); else if (a === 'h3') line('## '); else if (a === 'ul') line('- '); else if (a === 'ol') line('1. '); else if (a === 'quote') line('> ');
      else if (a === 'link') { const u = prompt('Link address (https://… or /page)'); if (u) ins('[', '](' + u + ')', 'link text'); }
      else if (a === 'image') pickMedia(row => ins('![', '](/' + row.url + ')', row.alt || row.name.replace(/\.[a-z]+$/i, '')), { images: true });
      else if (a === 'split') { prev.hidden = !prev.hidden; body.classList.toggle('two', !prev.hidden); b.textContent = prev.hidden ? 'Side-by-side preview' : 'Hide preview'; refresh(); }
    });
  });
}
function repHtml(L, items) {
  const one = !L.b, rows = items.length ? items.map((it, i) => `<div class="rep__row ${one ? 'one' : ''}" data-i="${i}"><span class="n">${i + 1}</span><input data-a value="${esc(it.a)}" placeholder="${esc(L.a)}" maxlength="300">${one ? '' : `<input data-b value="${esc(it.b)}" placeholder="${esc(L.b)}" maxlength="600">`}<span class="rep__acts"><button type="button" class="btn" data-m="up" aria-label="Move up">${icon('up')}</button><button type="button" class="btn" data-m="down" aria-label="Move down">${icon('down')}</button><button type="button" class="btn btn--danger" data-m="rm" aria-label="Remove">${icon('trash')}</button></span></div>`).join('') : `<div class="rep__empty">Nothing added yet.</div>`;
  return `<div class="rep" data-rep="${esc(L.k)}"><header><span>${esc(L.l)}</span><button type="button" class="btn btn--sm" data-add>+ Add</button></header><div data-rows>${rows}</div></div>`;
}
function wireRep(root, lists, L, onChange) {
  const box = $(`[data-rep="${L.k}"]`, root); if (!box) return;
  const redraw = () => { box.outerHTML = repHtml(L, lists[L.k]); wireRep(root, lists, L, onChange); onChange(); };
  const pull = () => $$('.rep__row', box).forEach(r => { const i = +r.dataset.i; lists[L.k][i] = { a: $('[data-a]', r).value, b: $('[data-b]', r) ? $('[data-b]', r).value : '' }; });
  box.addEventListener('input', () => { pull(); onChange(); });
  box.addEventListener('click', e => {
    if (e.target.closest('[data-add]')) { pull(); lists[L.k].push({ a: '', b: '' }); redraw(); const rows = $$('.rep__row input', $(`[data-rep="${L.k}"]`, root)); if (rows.length) rows[L.b ? rows.length - 2 : rows.length - 1].focus(); return; }
    const m = e.target.closest('[data-m]'); if (!m) return; pull(); const i = +m.closest('.rep__row').dataset.i, a = lists[L.k];
    if (m.dataset.m === 'rm') a.splice(i, 1); else if (m.dataset.m === 'up' && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; else if (m.dataset.m === 'down' && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    redraw();
  });
}
function wireImages(root, setImg) {
  root.addEventListener('click', e => {
    const p = e.target.closest('[data-pick]'), x = e.target.closest('[data-clear]');
    if (p) pickMedia(row => setImg(p.dataset.pick, row.url), { images: true });
    if (x) setImg(x.dataset.clear, '');
  });
}

// ---------- attachments tab ----------
async function attachmentsHtml(kind, id, items) {
  if (!id) return `<div class="empty">Save the record first, then you can attach photos and files to it.</div>`;
  return `<div class="drop" id="adrop">Drag files here or <label class="link" style="cursor:pointer">choose files<input id="afile" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden></label> · <button class="btn btn--sm" id="alib" type="button">Choose from library</button><div class="hint">PNG, JPG, WebP, GIF or PDF, up to 8 MB each.</div></div>
  <div class="att">${items.map(a => `<div class="att__i" data-id="${a.id}">${/^image\//.test(a.mime) ? `<img src="/${esc(a.url)}" alt="${esc(a.alt)}">` : `<div class="pdf">PDF</div>`}<div class="att__b"><b title="${esc(a.name)}">${esc(a.name)}</b><input data-cap value="${esc(a.caption)}" placeholder="Caption (optional)" maxlength="300"><div class="row"><select class="btn btn--sm" data-role>${['cover', 'gallery', 'file'].map(r => `<option ${a.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>${/^image\//.test(a.mime) ? `<button class="btn btn--sm" data-ins type="button">Insert in text</button><button class="btn btn--sm" data-cover type="button">Use as cover</button>` : ''}<button class="btn btn--sm btn--danger" data-del type="button">Remove</button></div></div></div>`).join('') || '<div class="empty" style="grid-column:1/-1">No files attached yet.</div>'}</div>`;
}
function wireAttachments(c, kind, id, ctx) {
  const reload = async items => { ctx.attachments = items; const h = await attachmentsHtml(kind, id, items); const el = $('#tab-att', c); el.innerHTML = h; wireAttachments(c, kind, id, ctx); };
  const add = async row => reload(await api(`r/${kind}/${id}/attachments`, { method: 'POST', body: { media_id: row.id, role: /^image\//.test(row.mime) ? 'gallery' : 'file' } }));
  const files = async list => { for (const f of list) await add(await uploadFile(f)); toast('Attached'); };
  const up = $('#afile', c); if (up) up.onchange = guard(async e => files([...e.target.files]));
  const dr = $('#adrop', c); if (dr) { dr.ondragover = e => { e.preventDefault(); dr.classList.add('over'); }; dr.ondragleave = () => dr.classList.remove('over'); dr.ondrop = guard(async e => { e.preventDefault(); dr.classList.remove('over'); await files([...e.dataTransfer.files]); }); }
  const lib = $('#alib', c); if (lib) lib.onclick = () => pickMedia(guard(async row => { await add(row); toast('Attached'); }), { needId: true });
  $$('.att__i', c).forEach(el => {
    const aid = el.dataset.id, a = ctx.attachments.find(x => x.id == aid);
    $('[data-cap]', el).onchange = guard(async e => { await api(`r/${kind}/${id}/attachments/${aid}`, { method: 'PUT', body: { caption: e.target.value } }); toast('Saved'); });
    $('[data-role]', el).onchange = guard(async e => { await api(`r/${kind}/${id}/attachments/${aid}`, { method: 'PUT', body: { role: e.target.value } }); toast('Saved'); });
    $('[data-del]', el).onclick = guard(async () => { reload(await api(`r/${kind}/${id}/attachments/${aid}`, { method: 'DELETE' })); });
    const ins = $('[data-ins]', el); if (ins) ins.onclick = () => { const ta = ctx.lastMd || $('.md textarea', c); if (!ta) return toast('This record has no text field to insert into.', true); const s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + `\n![${a.caption || a.alt || ''}](/${a.url})\n` + ta.value.slice(s); ta.dispatchEvent(new Event('input')); toast('Inserted. Save to keep it.'); };
    const cv = $('[data-cover]', el); if (cv) cv.onclick = () => { ctx.setImg('image', a.url); toast('Cover set. Save to keep it.'); };
  });
}

// ---------- the editor ----------
CMS.editor = async (c, kind, id) => {
  const R = CMS.SCHEMA[kind], isNew = id === 'new';
  if (kind === 'tours') return tourEditor(c, id);
  let rec = isNew ? { lists: {}, attachments: [] } : await api(`r/${kind}/${id}`);
  const lists = {}; for (const L of R.lists) lists[L.k] = (rec.lists && rec.lists[L.k] || []).map(x => ({ ...x }));
  const ctx = { attachments: rec.attachments || [], lastMd: null };
  const tours = R.fields.some(f => f.t === 'tour') ? (await api('r/tours?limit=300')).rows : [];
  const main = R.fields.filter(f => f.g === 'main'), side = R.fields.filter(f => f.g === 'side' && f.k !== 'status'), seo = R.fields.filter(f => f.g === 'seo'), sf = R.fields.find(f => f.k === 'status');
  const canDraft = !!(R.statuses && R.statuses.includes('draft')) && R.publicStatus === 'published';
  const showTabs = [['content', 'Content']].concat(seo.length ? [['seo', 'Search appearance']] : []).concat(R.attach ? [['att', 'Photos & files']] : []);
  let dirty = false; const mark = () => { if (!dirty) { dirty = true; $('#dirty').hidden = false; } };
  CMS.dirty = () => dirty;
  const val = f => (rec[f.k] == null ? (f.t === 'select' ? f.o[0] : '') : rec[f.k]);
  const attHtml = await attachmentsHtml(kind, isNew ? null : rec.id, ctx.attachments);
  const publicUrl = { destinations: '/destinations/', accommodations: '/accommodations/', blog: '/blogs/' }[kind];
  c.innerHTML = `<div class="ph"><div><h1>${isNew ? 'New ' + esc(R.single.toLowerCase()) : esc(rec[R.title] || R.single)}</h1><p><a class="link" href="#/${kind}">&larr; ${esc(R.label)}</a>${sf ? ` · ${tag(rec.status || sf.o[0], rec.status === R.publicStatus)}` : ''}</p></div><div class="ph__r"><span class="dirty" id="dirty" hidden>Unsaved changes</span></div></div>
  <datalist id="tl">${tours.map(t => `<option value="${esc(t.title)}">`).join('')}</datalist>
  <div class="rec" id="rec"><aside class="rec__side"><div class="panel"><h3>${esc(isNew ? 'New ' + R.single.toLowerCase() : String(rec[R.title] || R.single).slice(0, 60))}</h3><div class="sub">${esc(R.single)}${isNew ? '' : ' #' + rec.id}</div>
    ${isNew ? '' : `<dl class="kv"><dt>Created</dt><dd>${esc(fmtDate(rec.created_at))}${rec.created_by ? ' by ' + esc(rec.created_by) : ''}</dd><dt>Updated</dt><dd>${esc(fmtDate(rec.updated_at))}${rec.updated_by ? ' by ' + esc(rec.updated_by) : ''}</dd>${publicUrl && rec.slug && rec.status === R.publicStatus ? `<dt>Live page</dt><dd><a class="link" href="${publicUrl}${esc(rec.slug)}" target="_blank" rel="noopener">${publicUrl}${esc(rec.slug)}</a></dd>` : ''}</dl>`}
    <div id="sidef">${sf ? fieldHtml(sf, val(sf)) : ''}${side.map(f => fieldHtml(f, val(f))).join('')}</div>
    <div class="savebar" id="savebar">${canDraft ? `<button class="btn" id="bdraft">Save draft</button><button class="btn btn--gold" id="bpub">${rec.status === 'published' ? 'Save & keep live' : 'Publish'}</button>` : '<button class="btn btn--gold" id="bsave">Save</button>'}</div>
    <div class="savebar" style="border:0;padding-top:4px">${R.preview ? `<button class="btn" id="bprev">${icon('eye')} Preview</button><button class="btn" id="blive">Side-by-side</button>` : ''}${isNew ? '' : `<button class="btn" id="bdup">${icon('copy')}</button><button class="btn btn--danger" id="bdel">${icon('trash')}</button>`}</div></div></aside>
  <section><div class="tabs" id="tabs">${showTabs.map(([k, l], i) => `<button data-t="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div>
    <div id="tab-content"><div class="panel">${main.map(f => (f.t === 'md' ? mdHtml(f, val(f)) : fieldHtml(f, val(f)))).join('')}</div>${R.lists.map(L => repHtml(L, lists[L.k])).join('')}</div>
    ${seo.length ? `<div id="tab-seo" hidden><div class="panel">${seo.map(f => fieldHtml(f, val(f))).join('')}<div class="hint">Leave these empty to use the title and excerpt automatically.</div></div></div>` : ''}
    ${R.attach ? `<div id="tab-att" hidden>${attHtml}</div>` : ''}</section><section id="prevcol" hidden><div class="preview"><header><span>Preview of the live page</span><span><button class="btn btn--sm" id="prefresh">Refresh</button></span></header><iframe id="pframe" title="Preview"></iframe></div></section></div>`;
  const root = $('#rec', c);
  ctx.setImg = (k, url) => { const h = $(`[data-f="${k}"]`, root); if (!h) return; h.value = url; const wrap = h.closest('.f'); wrap.outerHTML = fieldHtml(R.fields.find(f => f.k === k), url); mark(); };
  wireImages(root, ctx.setImg); wireMd(root, mark, ta => { ctx.lastMd = ta; }); R.lists.forEach(L => wireRep(root, lists, L, mark));
  root.addEventListener('input', e => { if (e.target.closest('[data-f]') && !e.target.closest('.md')) mark(); }); root.addEventListener('change', e => { if (e.target.matches('select')) mark(); });
  $$('#tabs button', c).forEach(b => b.onclick = () => { $$('#tabs button', c).forEach(x => x.classList.toggle('on', x === b)); for (const [k] of showTabs) { const el = $('#tab-' + k, c); if (el) el.hidden = k !== b.dataset.t; } });
  if (R.attach && !isNew) wireAttachments(c, kind, rec.id, ctx);
  const collect = override => { const body = { lists: {} }; $$('[data-f]', root).forEach(el => { body[el.dataset.f] = el.value; }); if (override) body.status = override; R.lists.forEach(L => { body.lists[L.k] = lists[L.k].filter(x => x.a.trim() || x.b.trim()); }); return body; };
  const frameUrl = () => `/cms/preview/${kind}/${rec.id}`;
  const save = async (status, stay) => {
    $$('.f.err', root).forEach(e => e.classList.remove('err'));
    let saved; try { saved = await api(isNew ? `r/${kind}` : `r/${kind}/${rec.id}`, { method: isNew ? 'POST' : 'PUT', body: collect(status) }); } catch (e) { toast(e.message, true); throw e; }
    dirty = false; $('#dirty').hidden = true; toast(status === R.publicStatus && canDraft ? 'Published' : 'Saved');
    if (isNew) { CMS.dirty = () => false; location.hash = `#/${kind}/${saved.id}`; } else { rec = saved; if (!stay) CMS.reload(); else { const fr = $('#pframe', c); if (fr && !$('#prevcol', c).hidden) fr.src = frameUrl() + '?t=' + Date.now(); } }
    return saved;
  };
  const dr = $('#bdraft', c), pb = $('#bpub', c), sv = $('#bsave', c);
  if (dr) dr.onclick = guard(() => save(R.statuses.includes('draft') ? 'draft' : undefined)); if (pb) pb.onclick = guard(() => save(R.publicStatus)); if (sv) sv.onclick = guard(() => save());
  const bp = $('#bprev', c); if (bp) bp.onclick = guard(async () => { const s = dirty || isNew ? await save(undefined, true) : rec; if (!s) return; window.open(`/cms/preview/${kind}/${s.id || rec.id}`, '_blank'); });
  const bl = $('#blive', c); if (bl) bl.onclick = guard(async () => { if (isNew || dirty) { const s = await save(undefined, true); if (isNew) return; } const col = $('#prevcol', c), on = col.hidden; col.hidden = !on; $('#rec', c).classList.toggle('split', on); if (on) $('#pframe', c).src = frameUrl(); });
  const rf = $('#prefresh', c); if (rf) rf.onclick = () => { $('#pframe', c).src = frameUrl() + '?t=' + Date.now(); };
  const dp = $('#bdup', c); if (dp) dp.onclick = guard(async () => { const r = await api(`duplicate/${kind}/${rec.id}`, { method: 'POST', body: {} }); CMS.dirty = () => false; toast('Copy created as a draft'); location.hash = `#/${kind}/${r.id}`; });
  const dl = $('#bdel', c); if (dl) dl.onclick = guard(async () => { if (!confirm('Permanently delete this ' + R.single.toLowerCase() + '? This cannot be undone.')) return; await api(`r/${kind}/${rec.id}`, { method: 'DELETE' }); CMS.dirty = () => false; toast('Deleted'); location.hash = '#/' + kind; });
  const first = $('[data-f]', $('#tab-content', c)); if (isNew && first) first.focus();
};

// ---------- tour editor (itinerary builder, prices, lists) ----------
async function tourEditor(c, id) {
  const R = CMS.SCHEMA.tours, isNew = id === 'new';
  let t = isNew ? { title: '', category: 'safari', status: 'draft', featured: 0, tags: [], overview: [], highlights: [], inclusions: [], exclusions: [], notes: [], itinerary: [], price_tiers: [], attachments: [] } : await api('r/tours/' + id);
  const ctx = { attachments: t.attachments || [], lastMd: null };
  let days = JSON.parse(JSON.stringify(t.itinerary || [])).map(d => ({ title: d.title, body: d.body || [], metaList: d.metaList || Object.entries(d.meta || {}).map(([k, v]) => ({ k, v })) })), tiers = JSON.parse(JSON.stringify(t.price_tiers || []));
  let dirty = false; const mark = () => { if (!dirty) { dirty = true; $('#dirty').hidden = false; } }; CMS.dirty = () => dirty;
  const CAT = { safari: 'Private safari', group: 'Group / joining', trekking: 'Trekking' };
  const lines = a => (a || []).join('\n'), unlines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const dayHtml = () => days.map((d, i) => `<div class="day" data-i="${i}"><header><b>Day ${i + 1}</b><input data-dt value="${esc(d.title)}" placeholder="Day title" maxlength="200"><button type="button" class="btn btn--sm" data-m="up">${icon('up')}</button><button type="button" class="btn btn--sm" data-m="down">${icon('down')}</button><button type="button" class="btn btn--sm btn--danger" data-m="rm">${icon('trash')}</button></header>
    <div class="day__b"><label class="f"><span>Description (one paragraph per line)</span><textarea data-db style="min-height:92px">${esc(lines(d.body))}</textarea></label><div><span style="display:block;font-size:10.5px;font-weight:800;color:var(--muted);margin-bottom:3px">Details (meals, accommodation, elevation…)</span>${d.metaList.map((m, j) => `<div class="mini" data-j="${j}"><input data-mk value="${esc(m.k)}" placeholder="Label"><input data-mv value="${esc(m.v)}" placeholder="Value"><button type="button" class="btn btn--sm btn--danger" data-mrm>&times;</button></div>`).join('')}<button type="button" class="btn btn--sm" data-madd>+ Detail</button></div></div></div>`).join('') || '<div class="empty">No itinerary yet. Add the first day.</div>';
  const tierHtml = () => tiers.map((p, i) => `<div class="mini" style="grid-template-columns:1fr 1fr 26px" data-i="${i}"><input type="number" min="1" data-tp value="${esc(p.pax)}" placeholder="Group size"><input type="number" min="1" data-tu value="${esc(p.usd)}" placeholder="USD per person"><button type="button" class="btn btn--sm btn--danger" data-trm>&times;</button></div>`).join('') || '<div class="hint">No group prices yet.</div>';
  const fld = (k, label, v, extra = '', type = 'text') => `<label class="f"><span>${label}</span><input data-f="${k}" type="${type}" value="${esc(v ?? '')}" ${extra}></label>`;
  c.innerHTML = `<div class="ph"><div><h1>${isNew ? 'New tour' : esc(t.title)}</h1><p><a class="link" href="#/tours">&larr; Tours</a> · ${tag(t.status, t.status === 'published')}</p></div><div class="ph__r"><span class="dirty" id="dirty" hidden>Unsaved changes</span></div></div>
  <div class="rec" id="rec"><aside class="rec__side"><div class="panel"><h3>${isNew ? 'New tour' : esc(t.title.slice(0, 60))}</h3><div class="sub">Tour${isNew ? '' : ' #' + t.id}</div>
    ${isNew ? '' : `<dl class="kv"><dt>Updated</dt><dd>${esc(fmtDate(t.updated_at))}${t.updated_by ? ' by ' + esc(t.updated_by) : ''}</dd><dt>From price</dt><dd>${t.price_from ? usd(t.price_from) : 'On request'}</dd>${t.status === 'published' ? `<dt>Live page</dt><dd><a class="link" href="/packages/${esc(t.slug)}" target="_blank" rel="noopener">/packages/${esc(t.slug)}</a></dd>` : ''}</dl>`}
    <label class="f"><span>Status</span><select data-f="status"><option ${t.status === 'draft' ? 'selected' : ''}>draft</option><option ${t.status === 'published' ? 'selected' : ''}>published</option></select></label>
    <label class="f"><span>Type</span><select data-f="category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${t.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="row2">${fld('subcategory', 'Sub-category', t.subcategory, 'placeholder="e.g. Kilimanjaro"')}${fld('days', 'Days', t.days, 'min="1"', 'number')}</div>${fld('type', 'Safari style', t.type, 'placeholder="Private, Joining…"')}${fld('slug', 'URL slug', t.slug, 'placeholder="auto from title"')}
    <label class="chk"><input type="checkbox" data-f="featured" ${t.featured ? 'checked' : ''}> Show on the homepage</label>
    <div id="imgbox">${fieldHtml({ k: 'image', l: 'Cover image', t: 'image' }, t.image)}</div>
    <div class="savebar"><button class="btn" id="bdraft">Save draft</button><button class="btn btn--gold" id="bpub">${t.status === 'published' ? 'Save & keep live' : 'Publish'}</button></div>
    <div class="savebar" style="border:0;padding-top:4px"><button class="btn" id="bprev">${icon('eye')} Preview</button><button class="btn" id="blive">Side-by-side</button>${isNew ? '' : `<button class="btn" id="bdup">${icon('copy')}</button><button class="btn btn--danger" id="bdel">${icon('trash')}</button>`}</div></div></aside>
  <section><div class="tabs" id="tabs"><button data-t="ov" class="on">Overview</button><button data-t="it">Itinerary <span class="n" id="nd">${days.length}</span></button><button data-t="pr">Pricing</button><button data-t="in">Included</button><button data-t="att">Photos & files</button></div>
    <div id="tab-ov"><div class="panel">${fld('title', 'Title <b style="color:var(--danger)">*</b>', t.title, 'maxlength="200"')}<label class="f"><span>Overview (one paragraph per line)</span><textarea data-lines="overview" style="min-height:150px">${esc(lines(t.overview))}</textarea></label><label class="f"><span>Highlights (one per line)</span><textarea data-lines="highlights" style="min-height:90px">${esc(lines(t.highlights))}</textarea></label>${fld('tags', 'Tags (comma separated: luxury, migration, zanzibar…)', (t.tags || []).join(', '))}</div></div>
    <div id="tab-it" hidden><div id="days">${dayHtml()}</div><button type="button" class="btn" id="addday">+ Add day</button></div>
    <div id="tab-pr" hidden><div class="panel"><div class="row2">${fld('price_single', 'Single price (USD per person, if not group-based)', t.price_single, 'min="0"', 'number')}${fld('price_note', 'Price note', t.price_note, 'maxlength="200"')}</div><span style="display:block;font-size:10.5px;font-weight:800;color:var(--muted);margin-bottom:4px">Group prices (USD per person)</span><div id="tiers">${tierHtml()}</div><button type="button" class="btn btn--sm" id="addtier">+ Add group price</button><p class="hint" style="margin-top:6px">The lowest price becomes the "From" price shown on cards.</p></div></div>
    <div id="tab-in" hidden><div class="panel"><div class="row2"><label class="f"><span>Included (one per line)</span><textarea data-lines="inclusions" style="min-height:180px">${esc(lines(t.inclusions))}</textarea></label><label class="f"><span>Not included (one per line)</span><textarea data-lines="exclusions" style="min-height:180px">${esc(lines(t.exclusions))}</textarea></label></div><label class="f"><span>Extra notes (one paragraph per line)</span><textarea data-lines="notes" style="min-height:80px">${esc(lines(t.notes))}</textarea></label></div></div>
    <div id="tab-att" hidden>${await attachmentsHtml('tours', isNew ? null : t.id, ctx.attachments)}</div></section>
  <section id="prevcol" hidden><div class="preview"><header><span>Preview of the live page</span><button class="btn btn--sm" id="prefresh">Refresh</button></header><iframe id="pframe" title="Preview"></iframe></div></section></div>`;
  const root = $('#rec', c);
  ctx.setImg = (k, url) => { $('#imgbox', root).innerHTML = fieldHtml({ k: 'image', l: 'Cover image', t: 'image' }, url); mark(); };
  wireImages(root, ctx.setImg);
  root.addEventListener('input', mark); root.addEventListener('change', mark);
  $$('#tabs button', c).forEach(b => b.onclick = () => { $$('#tabs button', c).forEach(x => x.classList.toggle('on', x === b)); for (const k of ['ov', 'it', 'pr', 'in', 'att']) $('#tab-' + k, c).hidden = k !== b.dataset.t; });
  const syncDays = () => $$('.day', root).forEach(el => { const d = days[+el.dataset.i]; d.title = $('[data-dt]', el).value; d.body = unlines($('[data-db]', el).value); d.metaList = $$('.mini', el).map(m => ({ k: $('[data-mk]', m).value, v: $('[data-mv]', m).value })); });
  const redrawDays = () => { $('#days', root).innerHTML = dayHtml(); $('#nd', c).textContent = days.length; mark(); };
  $('#days', root).addEventListener('click', e => {
    const dayEl = e.target.closest('.day'); if (!dayEl) return; syncDays(); const i = +dayEl.dataset.i;
    if (e.target.closest('[data-madd]')) { days[i].metaList.push({ k: '', v: '' }); return redrawDays(); }
    const mr = e.target.closest('[data-mrm]'); if (mr) { days[i].metaList.splice(+mr.closest('.mini').dataset.j, 1); return redrawDays(); }
    const m = e.target.closest('[data-m]'); if (!m) return;
    if (m.dataset.m === 'rm') days.splice(i, 1); else if (m.dataset.m === 'up' && i > 0) [days[i - 1], days[i]] = [days[i], days[i - 1]]; else if (m.dataset.m === 'down' && i < days.length - 1) [days[i + 1], days[i]] = [days[i], days[i + 1]];
    redrawDays();
  });
  $('#addday', c).onclick = () => { syncDays(); days.push({ title: '', body: [], metaList: [] }); redrawDays(); };
  const syncTiers = () => $$('#tiers .mini', root).forEach((m, i) => { tiers[i] = { pax: +$('[data-tp]', m).value, usd: +$('[data-tu]', m).value }; });
  $('#addtier', c).onclick = () => { syncTiers(); tiers.push({ pax: tiers.length + 1, usd: 0 }); $('#tiers', root).innerHTML = tierHtml(); mark(); };
  $('#tiers', root).addEventListener('click', e => { const b = e.target.closest('[data-trm]'); if (!b) return; syncTiers(); tiers.splice(+b.closest('.mini').dataset.i, 1); $('#tiers', root).innerHTML = tierHtml(); mark(); });
  if (!isNew) wireAttachments(c, 'tours', t.id, ctx);
  const collect = override => {
    syncDays(); syncTiers(); const b = {};
    $$('[data-f]', root).forEach(el => { b[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
    $$('[data-lines]', root).forEach(el => { b[el.dataset.lines] = unlines(el.value); });
    b.tags = String(b.tags || '').split(',').map(x => x.trim()).filter(Boolean); b.itinerary = days.map(d => ({ title: d.title, body: d.body, metaList: d.metaList.filter(m => m.k.trim()) })); b.price_tiers = tiers.filter(p => p.pax > 0 && p.usd > 0);
    if (!b.slug) delete b.slug; if (override) b.status = override; return b;
  };
  const frameUrl = () => `/cms/preview/tours/${t.id}`;
  const save = async (status, stay) => {
    let saved; try { saved = await api(isNew ? 'r/tours' : 'r/tours/' + t.id, { method: isNew ? 'POST' : 'PUT', body: collect(status) }); } catch (e) { toast(e.message, true); throw e; }
    dirty = false; $('#dirty').hidden = true; toast(status === 'published' ? 'Published' : 'Saved');
    if (isNew) { CMS.dirty = () => false; location.hash = '#/tours/' + saved.id; } else { t = saved; if (!stay) CMS.reload(); else if (!$('#prevcol', c).hidden) $('#pframe', c).src = frameUrl() + '?t=' + Date.now(); }
    return saved;
  };
  $('#bdraft', c).onclick = guard(() => save('draft')); $('#bpub', c).onclick = guard(() => save('published'));
  $('#bprev', c).onclick = guard(async () => { const s = dirty || isNew ? await save(undefined, true) : t; if (s) window.open('/cms/preview/tours/' + (s.id || t.id), '_blank'); });
  $('#blive', c).onclick = guard(async () => { if (isNew || dirty) { await save(undefined, true); if (isNew) return; } const col = $('#prevcol', c), on = col.hidden; col.hidden = !on; root.classList.toggle('split', on); if (on) $('#pframe', c).src = frameUrl(); });
  $('#prefresh', c).onclick = () => { $('#pframe', c).src = frameUrl() + '?t=' + Date.now(); };
  const dp = $('#bdup', c); if (dp) dp.onclick = guard(async () => { const r = await api('duplicate/tours/' + t.id, { method: 'POST', body: {} }); CMS.dirty = () => false; toast('Copy created as a draft'); location.hash = '#/tours/' + r.id; });
  const dl = $('#bdel', c); if (dl) dl.onclick = guard(async () => { if (!confirm('Permanently delete this tour? This cannot be undone.')) return; await api('r/tours/' + t.id, { method: 'DELETE' }); CMS.dirty = () => false; toast('Deleted'); location.hash = '#/tours'; });
}
})();
