/* Media library, users, API keys, settings, status, audit log and profile. */
(() => {
const { $, $$, esc, usd, fmtDate, enc, api, toast, guard, routes, icon } = window.CMS, CMS = window.CMS;
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

routes.media = async c => {
  const items = await api('media'), q = (sessionStorage.getItem('mq') || '').toLowerCase(), shown = items.filter(i => i.name.toLowerCase().includes(q));
  c.innerHTML = `<div class="ph"><div><h1>Media library</h1><p>${items.length} files. Pictures and PDFs you upload here can be used in any record.</p></div></div>
  <div class="drop" id="drop">Drag files here or <label class="link" style="cursor:pointer">choose files<input id="mf" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple hidden></label> <span class="hint">PNG, JPG, WebP, GIF, PDF · up to 8 MB each</span></div>
  <div class="bar"><input type="search" id="mq" placeholder="Search by file name…" value="${esc(q)}"></div>
  <div class="mgrid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${shown.map(i => `<div class="panel" style="padding:0;margin:0;overflow:hidden"><img src="/${/\.pdf$/i.test(i.url) ? 'assets/logo-t.png' : esc(i.url)}" loading="lazy" alt="${esc(i.alt || '')}" style="height:92px;width:100%;object-fit:cover;display:block"><div style="padding:6px 8px"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(i.name)}">${esc(i.name)}</b><span class="hint">${i.size ? kb(i.size) : 'site image'}</span>${i.id ? `<input class="in" data-alt="${i.id}" value="${esc(i.alt || '')}" placeholder="Alt text" style="margin-top:4px;height:24px">` : ''}<div style="display:flex;gap:4px;margin-top:5px"><button class="btn btn--sm" data-copy="/${esc(i.url)}">Copy link</button>${i.id && i.builtin !== true ? `<button class="btn btn--sm btn--danger" data-del="${i.id}">Delete</button>` : ''}</div></div></div>`).join('') || '<div class="empty">No files match.</div>'}</div>`;
  const files = guard(async list => { for (const f of list) await CMS.uploadFile(f); toast('Uploaded'); CMS.reload(); });
  $('#mf').onchange = e => files([...e.target.files]);
  const d = $('#drop'); d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over'); d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); files([...e.dataTransfer.files]); };
  let t; $('#mq').oninput = e => { clearTimeout(t); t = setTimeout(() => { sessionStorage.setItem('mq', e.target.value); CMS.reload(); }, 300); };
  $$('[data-copy]', c).forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(location.origin + b.dataset.copy); toast('Link copied'); });
  $$('[data-alt]', c).forEach(i => i.onchange = guard(async () => { await api('media/' + i.dataset.alt, { method: 'PUT', body: { alt: i.value } }); toast('Saved'); }));
  $$('[data-del]', c).forEach(b => b.onclick = guard(async () => { if (confirm('Delete this file? It will be removed from anything it is attached to.')) { await api('media/' + b.dataset.del, { method: 'DELETE' }); CMS.reload(); } }));
};

routes.users = async c => {
  const rows = await api('users');
  c.innerHTML = `<div class="ph"><div><h1>Users &amp; roles</h1><p>Super admin: everything · Editor: content and operations · Viewer: read only</p></div><button class="btn btn--gold" id="nu">${icon('plus')} Add user</button></div>
  <div class="tbl-wrap"><table><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th class="r">Actions</th></tr>${rows.map(u => `<tr><td>${esc(u.name || '')}<small>${esc(u.email)}</small></td><td><select class="btn btn--sm" data-role="${u.id}">${['super_admin', 'editor', 'viewer'].map(r => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><span class="tag ${u.active ? 'on' : 'off'}">${u.active ? 'active' : 'disabled'}</span></td><td>${esc(fmtDate(u.last_login) || 'never')}</td><td class="r"><button class="btn btn--sm" data-tog="${u.id}" data-a="${u.active}">${u.active ? 'Disable' : 'Enable'}</button> <button class="btn btn--sm" data-pw="${u.id}">Reset password</button> <button class="btn btn--sm btn--danger" data-del="${u.id}">Delete</button></td></tr>`).join('')}</table></div>
  <form class="panel" id="uf" style="max-width:520px;margin-top:10px" hidden><h2>New user</h2><label class="f"><span>Email</span><input name="email" type="email" required autocomplete="off"></label><label class="f"><span>Full name</span><input name="name"></label><div class="row2"><label class="f"><span>Role</span><select name="role"><option>editor</option><option>viewer</option><option>super_admin</option></select></label><label class="f"><span>Temporary password (10+ characters)</span><input name="password" type="password" minlength="10" required autocomplete="new-password"></label></div><button class="btn btn--gold">Create user</button></form>`;
  $('#nu').onclick = () => { $('#uf').hidden = !$('#uf').hidden; };
  $('#uf').onsubmit = guard(async e => { e.preventDefault(); await api('users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('User added'); CMS.reload(); });
  $$('[data-role]', c).forEach(s => s.onchange = guard(async () => { await api('users/' + s.dataset.role, { method: 'PUT', body: { role: s.value } }); toast('Role updated'); }));
  $$('[data-tog]', c).forEach(b => b.onclick = guard(async () => { await api('users/' + b.dataset.tog, { method: 'PUT', body: { active: b.dataset.a === '1' ? 0 : 1 } }); CMS.reload(); }));
  $$('[data-pw]', c).forEach(b => b.onclick = guard(async () => { const p = prompt('New password (at least 10 characters). The user will be signed out everywhere.'); if (p) { await api('users/' + b.dataset.pw, { method: 'PUT', body: { password: p } }); toast('Password reset'); } }));
  $$('[data-del]', c).forEach(b => b.onclick = guard(async () => { if (confirm('Delete this user?')) { await api('users/' + b.dataset.del, { method: 'DELETE' }); CMS.reload(); } }));
};

routes.keys = async c => {
  const rows = await api('keys');
  c.innerHTML = `<div class="ph"><div><h1>API keys</h1><p>Send a key in the <code>X-API-Key</code> header. <b>Read</b> keys can only read; <b>write</b> keys have editor access.</p></div><div class="ph__r"><select class="btn" id="ks"><option value="read">Read-only</option><option value="write">Read &amp; write</option></select><button class="btn btn--gold" id="nk">${icon('plus')} New key</button></div></div>
  <div class="tbl-wrap"><table><tr><th>Name</th><th>Key</th><th>Access</th><th>Created</th><th>Last used</th><th class="r"></th></tr>${rows.map(k => `<tr><td>${esc(k.name)}</td><td><code>${esc(k.prefix)}…</code></td><td><span class="tag ${k.scope === 'write' ? 'on' : ''}">${esc(k.scope)}</span></td><td>${fmtDate(k.created_at)}</td><td>${esc(fmtDate(k.last_used) || 'never')}</td><td class="r"><button class="btn btn--sm btn--danger" data-del="${k.id}">Revoke</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No keys yet</td></tr>'}</table></div>`;
  $('#nk').onclick = guard(async () => { const name = prompt('What is this key for?'); if (!name) return; const r = await api('keys', { method: 'POST', body: { name, scope: $('#ks').value } }); prompt('Copy this key now. It is shown only once:', r.key); CMS.reload(); });
  $$('[data-del]', c).forEach(b => b.onclick = guard(async () => { if (confirm('Revoke this key?')) { await api('keys/' + b.dataset.del, { method: 'DELETE' }); CMS.reload(); } }));
};

routes.settings = async c => {
  const s = await api('settings'), F = [['site_name', 'Site name'], ['tagline', 'Tagline'], ['contact_email', 'Public contact email'], ['contact_phone', 'Public phone / WhatsApp'], ['address', 'Address'], ['notify_email', 'Send new-inquiry alerts to'], ['currency', 'Currency'], ['seo_title', 'Default SEO title'], ['seo_description', 'Default SEO description']];
  c.innerHTML = `<div class="ph"><div><h1>Site settings</h1></div></div><form class="panel" id="sf" style="max-width:640px">${F.map(([k, l]) => `<label class="f"><span>${l}</span><input name="${k}" value="${esc(s[k] || '')}" maxlength="500"></label>`).join('')}<button class="btn btn--gold">Save settings</button></form>`;
  $('#sf').onsubmit = guard(async e => { e.preventDefault(); await api('settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('Settings saved'); });
};

routes.status = async c => {
  const s = await api('status'), up = s.uptime_s;
  c.innerHTML = `<div class="ph"><div><h1>System status</h1><p>Server healthy as of ${esc(s.time)}</p></div></div><div class="grid g2"><div class="panel"><h2>Server</h2><dl class="kvl"><b>Node.js</b><span>${esc(s.node)}</span><b>Platform</b><span>${esc(s.platform)}</span><b>Uptime</b><span>${Math.floor(up / 3600)}h ${Math.floor(up % 3600 / 60)}m</span><b>Memory</b><span>${s.memory_mb} MB</span><b>Database</b><span>${esc(s.db)} (${s.db_kb} KB)</span></dl></div>
  <div class="panel"><h2>Database tables</h2><table><tr><th>Table</th><th class="r">Rows</th></tr>${s.tables.map(t => `<tr><td>${esc(t.table)}</td><td class="r">${t.rows}</td></tr>`).join('')}</table></div></div>`;
};
routes.audit = async c => {
  const rows = await api('audit');
  c.innerHTML = `<div class="ph"><div><h1>Audit log</h1><p>The last ${rows.length} changes</p></div></div><div class="tbl-wrap"><table><tr><th>When (UTC)</th><th>User</th><th>Action</th><th>Item</th><th>Detail</th></tr>${rows.map(r => `<tr><td>${esc(String(r.ts).replace('T', ' ').slice(0, 19))}</td><td>${esc(r.user)}</td><td><span class="tag">${esc(r.action)}</span></td><td>${esc(r.entity)}</td><td>${esc(r.detail)}</td></tr>`).join('')}</table></div>`;
};
routes.profile = async c => {
  const ME = CMS.ME;
  c.innerHTML = `<div class="ph"><div><h1>My profile</h1></div></div><form class="panel" id="pf" style="max-width:480px"><label class="f"><span>Email</span><input value="${esc(ME.email)}" disabled></label><label class="f"><span>Display name</span><input name="name" value="${esc(ME.name || '')}" maxlength="80"></label><h2 style="margin-top:6px">Change password</h2><label class="f"><span>Current password</span><input type="password" name="current_password" autocomplete="current-password"></label><label class="f"><span>New password (at least 10 characters)</span><input type="password" name="new_password" autocomplete="new-password" minlength="10"></label><button class="btn btn--gold">Save</button></form>`;
  $('#pf').onsubmit = guard(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (!d.new_password) { delete d.new_password; delete d.current_password; } await api('profile', { method: 'PUT', body: d }); toast('Profile saved'); CMS.ME = null; CMS.reload(); });
};
})();
