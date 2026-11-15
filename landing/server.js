// Lengai Trails: website + CMS on PostgreSQL (set DATABASE_URL).
//   node server.js  ->  http://localhost:3000   CMS: /cms
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const { admin, pub, send } = require('./cms/api');
const seo = require('./cms/seo');
const zlib = require('zlib');

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon'
};
const BLOCKED = /^\/(data|cms)(\/|$)/; // never serve the database / server code as static files

function sendText(req, res, type, body, extra = {}) {
  const h = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra };
  if (/gzip/.test(req.headers['accept-encoding'] || '') && body.length > 1024) { h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding'; res.writeHead(200, h); return res.end(zlib.gzipSync(body)); }
  res.writeHead(200, h); res.end(body);
}
async function serveHtml(req, res, file, clean) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const r = await seo.decorate(req, clean, html);
  const h = { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=0, must-revalidate' };
  const body = Buffer.from(r.html);
  if (/gzip/.test(req.headers['accept-encoding'] || '')) { h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding'; res.writeHead(r.status, h); return res.end(zlib.gzipSync(body)); }
  res.writeHead(r.status, h); res.end(body);
}

function serveFile(res, file, extra = {}) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);

    if (p.startsWith('/cms') || p.startsWith('/api/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (p.startsWith('/cms/api/')) return await admin(req, res, url);
    if (p.startsWith('/api/')) return await pub(req, res, url);
    if (p === '/cms' || p === '/cms/') return serveFile(res, path.join(root, 'admin', 'index.html'), { 'Cache-Control': 'no-store' });
    if (p.startsWith('/cms/')) {
      const f = path.normalize(path.join(root, 'admin', p.slice(5)));
      if (!f.startsWith(path.join(root, 'admin') + path.sep)) { res.writeHead(403); return res.end(); }
      return serveFile(res, f, { 'Cache-Control': 'no-store' });
    }

    // Clean URLs: /safaris, /packages/<slug>, /destinations/<slug> ... (old *.html links redirect)
    const DETAIL = { packages: 'package', destinations: 'destination', accommodations: 'accommodation', blogs: 'post' };
    const LIST = ['safaris', 'packages', 'destinations', 'accommodations', 'group-safari', 'kilimanjaro', 'blogs', 'reviews', 'faq', 'about', 'contact', 'book'];
    const redirect = to => { res.writeHead(301, { Location: to }); res.end(); };
    let m;
    if (p === '/index.html') return redirect('/' + url.search);
    if ((m = p.match(/^\/(package|destination|accommodation|post)\.html$/)) && url.searchParams.get('slug')) {
      const base = Object.keys(DETAIL).find(k => DETAIL[k] === m[1]);
      return redirect('/' + base + '/' + encodeURIComponent(url.searchParams.get('slug')));
    }
    if ((m = p.match(/^\/([a-z-]+)\.html$/)) && LIST.includes(m[1])) return redirect('/' + m[1] + url.search);
    p = p.replace(/\/+$/, '') || '/';
    if (p === '/robots.txt') return sendText(req, res, 'text/plain; charset=utf-8', Buffer.from(seo.robotsTxt(req)), { 'Cache-Control': 'public, max-age=3600' });
    if (p === '/sitemap.xml') return sendText(req, res, 'application/xml; charset=utf-8', Buffer.from(await seo.sitemapXml(req)), { 'Cache-Control': 'public, max-age=3600' });
    if (p === '/llms.txt') return sendText(req, res, 'text/plain; charset=utf-8', Buffer.from(await seo.llmsTxt(req)), { 'Cache-Control': 'public, max-age=3600' });
    const clean = p;
    if (p === '/') p = '/index.html';
    else if (LIST.includes(p.slice(1))) p = p + '.html';
    else if ((m = p.match(/^\/(packages|destinations|accommodations|blogs)\/[^/]+$/))) p = '/' + DETAIL[m[1]] + '.html';
    if (BLOCKED.test(p)) { res.writeHead(404); return res.end('Not found'); }
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    if (file.endsWith('.html')) return await serveHtml(req, res, file, clean);
    serveFile(res, file, /\.(webp|png|jpe?g|svg)$/.test(file) ? { 'Cache-Control': 'public, max-age=86400' } : {});
  } catch (e) {
    if ([400, 404, 413].includes(e.code)) return send(res, e.code, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
});

require('./cms/db').ready.then(() => {
  server.listen(process.env.PORT || 3000, () => console.log('Lengai Trails running on port ' + (process.env.PORT || 3000) + ' — CMS at /cms'));
}).catch(e => { console.error('[cms] database setup failed:', e.message); process.exit(1); });
