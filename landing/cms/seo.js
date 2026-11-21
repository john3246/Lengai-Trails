// Server-side SEO + AI-crawler support: per-page <head> (title, description, canonical, Open Graph, JSON-LD),
// crawlable content for pages that are otherwise filled in by JavaScript, plus robots.txt, sitemap.xml and llms.txt.
// Set SITE_URL (for example https://lengaitrails.com) in production so canonical URLs are always correct.
const { all } = require('./db');
const tourRepo = require('./tours');
const store = require('./store');

const BRAND = 'Lengai Trails Expeditions';
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const arr = v => (Array.isArray(v) ? v : v ? [v] : []);

const PAGES = {
  '/': ['Lengai Trails Expeditions | Safaris, Kilimanjaro Climbs & Zanzibar Stays from Arusha', 'Tailor-made journeys to the Serengeti, Kilimanjaro and Zanzibar, designed and guided by a Tanzanian team that lives in Arusha.'],
  '/safaris': ['Safari Trips Across Northern Tanzania | ' + BRAND, 'Browse our private, shared, luxury and fly-in safaris, each with a day-by-day plan and a per-person price. Migration, Serengeti, Ngorongoro and more.'],
  '/packages': ['Every Trip We Run: Safaris, Climbs and Treks | ' + BRAND, 'The full list of our safaris, migration trips, Kilimanjaro and Mount Meru climbs, with itineraries, what is included and prices.'],
  '/kilimanjaro': ['Climb Kilimanjaro: Six Routes Compared | ' + BRAND, 'Compare the Lemosho, Machame, Marangu, Rongai, Umbwe and Northern Circuit routes by length, difficulty and price, led by trained mountain guides.'],
  '/group-safari': ['Shared Safaris on Fixed Dates | ' + BRAND, 'Travel with a small group and split the cost of the vehicle and guide. Set departures from Arusha through the Northern Circuit.'],
  '/destinations': ['Where We Go in Tanzania | ' + BRAND, 'The parks and regions on our routes: Serengeti, Ngorongoro, Tarangire, Lake Manyara, Zanzibar, Kilimanjaro and the south.'],
  '/accommodations': ['Where You Will Stay: Lodges and Camps | ' + BRAND, 'The lodges, tented camps and campsites we book across Tanzania, from simple camping to high-end Serengeti camps.'],
  '/blogs': ['Travel Guides for Tanzania | ' + BRAND, 'Helpful reading before you book: when to go, how the migration works, balloon flights, Kilimanjaro, costs and what to pack.'],
  '/reviews': ['What Our Guests Say | ' + BRAND, 'Reviews from travellers who went on safari or climbed Kilimanjaro with Lengai Trails Expeditions.'],
  '/faq': ['Questions Before You Travel | ' + BRAND, 'Answers on safaris, Kilimanjaro, payments, visas, insurance and packing.'],
  '/about': ['Who We Are | ' + BRAND, 'Lengai Trails Expeditions is a Tanzanian safari and trekking company with its office in Arusha.'],
  '/contact': ['Talk to Our Arusha Team | ' + BRAND, 'Send your dates, party size and wish list and a travel consultant will reply with a proposed route and price.'],
  '/book': ['Request a Booking | ' + BRAND, 'Ask us to hold a Tanzania safari or Kilimanjaro climb. We confirm availability and price by email.']
};
const NOINDEX = new Set(['/book']);

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0];
  return proto + '://' + (req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
}
const abs = (base, u) => (/^https?:/.test(u || '') ? u : base + '/' + String(u || 'assets/img/serengeti-04-card.webp').replace(/^\/+/, ''));
const ld = o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>';

function org(base) {
  return {
    '@context': 'https://schema.org', '@type': ['TravelAgency', 'LocalBusiness'], '@id': base + '/#org', name: BRAND, url: base + '/',
    logo: base + '/assets/logo.png', image: base + '/assets/img/serengeti-04.webp', email: 'info@lengaitrails.com',
    description: 'Locally owned Tanzania safari and Kilimanjaro trekking operator based in Arusha.', priceRange: '$$',
    address: { '@type': 'PostalAddress', addressLocality: 'Arusha', addressCountry: 'TZ' }, areaServed: 'Tanzania'
  };
}
const crumbs = (base, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: base + c[1] })) });

// Put crawlable HTML into a "Loading…" container. The page script overwrites it once it runs.
function fill(html, id, inner) {
  const re = new RegExp('(id="' + id + '"[^>]*>)\\s*<p[^>]*>Loading[^<]*</p>');
  return re.test(html) ? html.replace(re, '$1' + inner) : html;
}
const linkList = (items, hrefOf, labelOf, extraOf) => '<ul class="ssr-list">' + items.map(i => `<li><a href="${esc(hrefOf(i))}">${esc(labelOf(i))}</a>${extraOf ? ' ' + esc(extraOf(i)) : ''}</li>`).join('') + '</ul>';

async function pageData(p, base) {
  let m;
  const out = { title: null, desc: null, ld: [], image: null, type: 'website', body: {} };
  if ((m = p.match(/^\/packages\/([^/]+)$/))) {
    const t = await tourRepo.one(decodeURIComponent(m[1]), { drafts: false });
    if (!t) return { notFound: true };
    const days = t.days ? t.days + ' day' + (t.days > 1 ? 's' : '') : '';
    const ov = arr(t.overview).join(' ');
    out.title = clip(t.title, 62) + ' | Lengai Trails';
    out.desc = clip((t.price_from ? 'From USD ' + t.price_from + ' per person. ' : '') + ov, 158);
    out.image = t.image; out.type = 'product';
    const url = base + '/packages/' + t.slug;
    const trip = { '@context': 'https://schema.org', '@type': ['Product', 'TouristTrip'], '@id': url + '#trip', name: t.title, description: clip(ov, 500), url, image: abs(base, t.image), category: t.category === 'trekking' ? 'Trekking' : 'Safari',
      touristType: t.subcategory || undefined, provider: { '@id': base + '/#org' }, brand: { '@type': 'Brand', name: BRAND } };
    if (t.price_from) trip.offers = { '@type': 'Offer', url, priceCurrency: 'USD', price: String(t.price_from), availability: 'https://schema.org/InStock', priceValidUntil: new Date().getFullYear() + 1 + '-12-31' };
    const it = arr(t.itinerary);
    if (it.length) trip.itinerary = { '@type': 'ItemList', itemListElement: it.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: 'Day ' + d.day + ': ' + d.title, description: clip(arr(d.body).join(' '), 300) })) };
    out.ld.push(trip, crumbs(base, [['Home', '/'], ['Packages', '/packages'], [t.title, '/packages/' + t.slug]]));
    const li = a => arr(a).map(x => '<li>' + esc(x) + '</li>').join('');
    out.h1 = t.title;
    out.body.pkdetail = `<article class="ssr"><h2>${esc(t.title)}</h2><p>${esc(days)}${t.price_from ? ' · from USD ' + esc(t.price_from) + ' per person' : ''}</p>${arr(t.overview).map(x => '<p>' + esc(x) + '</p>').join('')}`
      + (it.length ? '<h2>Itinerary</h2>' + it.map(d => `<h3>Day ${esc(d.day)}: ${esc(d.title)}</h3>` + arr(d.body).map(x => '<p>' + esc(x) + '</p>').join('')).join('') : '')
      + (arr(t.inclusions).length ? '<h2>Included</h2><ul>' + li(t.inclusions) + '</ul>' : '') + (arr(t.exclusions).length ? '<h2>Not included</h2><ul>' + li(t.exclusions) + '</ul>' : '')
      + `<p><a href="/book?package=${encodeURIComponent(t.slug)}">Book this trip</a></p></article>`;
    return out;
  }
  if ((m = p.match(/^\/(destinations|accommodations|blogs)\/([^/]+)$/))) {
    const kind = m[1] === 'blogs' ? 'blog' : m[1];
    const d = await store.publicOne(kind, decodeURIComponent(m[2]));
    if (!d) return { notFound: true };
    const name = d.name || d.title;
    const text = d.description || d.body || d.excerpt || d.summary || '';
    const url = base + p;
    out.title = clip(name, 55) + (m[1] === 'blogs' ? ' | Tanzania Safari Guide | ' : m[1] === 'destinations' ? ' Safari Guide | ' : ' | ') + BRAND;
    out.desc = clip(d.excerpt || d.summary || text, 158); out.image = d.image;
    const label = { destinations: 'Destinations', accommodations: 'Accommodations', blogs: 'Guides' }[m[1]];
    if (m[1] === 'blogs') out.ld.push({ '@context': 'https://schema.org', '@type': 'Article', headline: name, description: out.desc, image: abs(base, d.image), url, mainEntityOfPage: url, datePublished: d.published_at || undefined, author: { '@id': base + '/#org' }, publisher: { '@id': base + '/#org' } });
    else if (m[1] === 'destinations') out.ld.push({ '@context': 'https://schema.org', '@type': 'TouristDestination', name, description: out.desc, url, image: abs(base, d.image) });
    else out.ld.push({ '@context': 'https://schema.org', '@type': 'LodgingBusiness', name, description: out.desc, url, image: abs(base, d.image), address: d.location ? { '@type': 'PostalAddress', addressLocality: d.location, addressCountry: 'TZ' } : undefined });
    out.ld.push(crumbs(base, [['Home', '/'], [label, '/' + m[1]], [name, p]]));
    const id = { destinations: 'destdetail', accommodations: 'accdetail', blogs: 'postdetail' }[m[1]];
    out.h1 = name;
    out.body[id] = `<article class="ssr"><h2>${esc(name)}</h2>${String(text).split(/\n{2,}|\n/).filter(Boolean).map(x => '<p>' + esc(x) + '</p>').join('')}</article>`;
    return out;
  }
  const meta = PAGES[p];
  if (!meta) return out;
  out.title = meta[0]; out.desc = meta[1];
  if (p === '/') out.ld.push(org(base), { '@context': 'https://schema.org', '@type': 'WebSite', '@id': base + '/#site', url: base + '/', name: BRAND, publisher: { '@id': base + '/#org' }, inLanguage: 'en' });
  else if (p !== '/book') out.ld.push(crumbs(base, [['Home', '/'], [meta[0].split(' | ')[0], p]]));
  const tours = cat => all(`SELECT slug, title, days, price_from FROM cms_tours WHERE status = 'published' ${cat ? 'AND category = ?' : ''} ORDER BY sort, id`, ...(cat ? [cat] : []));
  const tl = rows => linkList(rows, t => '/packages/' + t.slug, t => t.title, t => (t.price_from ? '(from USD ' + t.price_from + ')' : ''));
  if (p === '/safaris') { const r = await tours('safari'); out.body.sflist = tl(r); out.ld.push(itemList(base, r)); }
  if (p === '/packages') { const r = await tours(); out.body.pkgrid = tl(r); out.ld.push(itemList(base, r)); }
  if (p === '/kilimanjaro') out.body.kilist = tl(await tours('trekking'));
  if (p === '/destinations' || p === '/accommodations' || p === '/blogs') {
    const kind = p === '/blogs' ? 'blog' : p.slice(1);
    const rows = await store.publicList(kind, { limit: 200 });
    out.body[{ '/destinations': 'destlist', '/accommodations': 'acclist', '/blogs': 'bloglist' }[p]] = linkList(rows.filter(x => x.slug), x => p + '/' + x.slug, x => x.name || x.title);
  }
  if (p === '/faq') {
    const rows = (await store.publicList('faqs', { limit: 200 })).filter(f => f.question && f.answer);
    if (rows.length) {
      out.ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: rows.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: clip(f.answer, 1000) } })) });
      out.body.faqlist = rows.map(f => `<details class="iday"><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
    }
  }
  return out;
}
const itemList = (base, rows) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: rows.slice(0, 100).map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: base + '/packages/' + t.slug, name: t.title })) });

async function decorate(req, p, html) {
  const base = siteUrl(req);
  let d;
  try { d = await pageData(p, base); } catch (e) { console.error('[seo]', e.message); return { html, status: 200 }; }
  const status = d.notFound ? 404 : 200;
  if (d.notFound) d = { title: 'Page not found | ' + BRAND, desc: 'This page could not be found.', ld: [], body: {}, noindex: true };
  if (d.title) html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(d.title) + '</title>');
  if (d.desc) html = html.replace(/<meta name="description"[^>]*>/, '<meta name="description" content="' + esc(d.desc) + '">');
  const canon = base + (p === '/' ? '/' : p);
  const img = abs(base, d.image || 'assets/img/serengeti-04.webp');
  const robots = d.noindex || NOINDEX.has(p) ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1';
  const head = [
    `<link rel="canonical" href="${esc(canon)}">`, `<meta name="robots" content="${robots}">`,
    `<meta property="og:site_name" content="${esc(BRAND)}">`, `<meta property="og:type" content="${d.type === 'product' ? 'website' : 'website'}">`, `<meta property="og:title" content="${esc(d.title || '')}">`,
    `<meta property="og:description" content="${esc(d.desc || '')}">`, `<meta property="og:url" content="${esc(canon)}">`, `<meta property="og:image" content="${esc(img)}">`,
    '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(d.title || '')}">`, `<meta name="twitter:description" content="${esc(d.desc || '')}">`, `<meta name="twitter:image" content="${esc(img)}">`,
    '<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site summary">',
    ...d.ld.map(ld)
  ].join('\n');
  if (d.h1) html = html.replace(/<h1>[\s\S]*?<\/h1>/, '<h1>' + esc(d.h1) + '</h1>');
  html = html.replace('</head>', head + '\n</head>');
  for (const [id, inner] of Object.entries(d.body || {})) html = fill(html, id, inner);
  return { html, status };
}

function robotsTxt(req) {
  const base = siteUrl(req);
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bingbot', 'Googlebot'];
  return ['User-agent: *', 'Allow: /', 'Disallow: /cms', 'Disallow: /api/', 'Disallow: /book', '',
    ...bots.flatMap(b => ['User-agent: ' + b, 'Allow: /', 'Disallow: /cms', 'Disallow: /api/', '']),
    'Sitemap: ' + base + '/sitemap.xml', ''].join('\n');
}

async function sitemapXml(req) {
  const base = siteUrl(req);
  const urls = [];
  const add = (loc, lastmod, pri) => urls.push(`<url><loc>${esc(base + loc)}</loc>${lastmod ? '<lastmod>' + new Date(lastmod).toISOString().slice(0, 10) + '</lastmod>' : ''}${pri ? '<priority>' + pri + '</priority>' : ''}</url>`);
  for (const p of Object.keys(PAGES)) if (!NOINDEX.has(p)) add(p === '/' ? '/' : p, null, p === '/' ? '1.0' : '0.8');
  for (const t of await all("SELECT slug, updated_at FROM cms_tours WHERE status = 'published' ORDER BY sort, id")) add('/packages/' + t.slug, t.updated_at, '0.9');
  for (const [kind, path] of [['destinations', 'destinations'], ['accommodations', 'accommodations'], ['blog', 'blogs']])
    for (const r of await all(`SELECT updated_at, slug FROM ${store.resource(kind).table} WHERE ${store.publicWhere(store.resource(kind))}`)) if (r.slug) add('/' + path + '/' + r.slug, r.updated_at, '0.7');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

async function llmsTxt(req) {
  const base = siteUrl(req);
  const tours = await all("SELECT slug, title, days, category, price_from FROM cms_tours WHERE status = 'published' ORDER BY sort, id");
  const line = t => `- [${t.title}](${base}/packages/${t.slug}): ${t.days} day${t.days > 1 ? 's' : ''}${t.price_from ? ', from USD ' + t.price_from + ' per person' : ''}`;
  return [`# ${BRAND}`, '',
    '> Locally owned Tanzania safari and Kilimanjaro trekking operator based in Arusha. Private and group safaris, Great Migration trips, Serengeti, Ngorongoro Crater, Tarangire, Zanzibar extensions and Kilimanjaro climbs. Prices are in USD per person.', '',
    '## Main pages', ...['/safaris', '/packages', '/kilimanjaro', '/group-safari', '/destinations', '/accommodations', '/blogs', '/faq', '/about', '/contact'].map(p => `- [${PAGES[p][0].split(' | ')[0]}](${base}${p}): ${PAGES[p][1]}`), '',
    '## Safari packages', ...tours.filter(t => t.category === 'safari').map(line), '',
    '## Kilimanjaro and trekking', ...tours.filter(t => t.category !== 'safari').map(line), '',
    '## Machine-readable', `- [Sitemap](${base}/sitemap.xml)`, ''].join('\n');
}

module.exports = { decorate, robotsTxt, sitemapXml, llmsTxt, PAGES };
