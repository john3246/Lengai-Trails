// Parses the cleaned text exports of the three package documents into data/packages.json
// Run: node scripts/parseDocs.js
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'data', 'source');

const FILES = [
  { file: 'safaris-private-and-migration.txt', doc: 'com New Packages 2.docx', kind: 'safari' },
  { file: 'joining-group-safaris.txt', doc: 'GMS Joining Packages updated.docx', kind: 'group' },
  { file: 'trekking.txt', doc: 'TREKKING PACKAGES with new prices.docx', kind: 'trekking' }
];

const clean = s => s.replace(/[✅✓📵]+/g, '').replace(/\s+/g, ' ').trim();
const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = s => parseInt(String(s).replace(/[,\s]/g, ''), 10);

function isTitle(line, kind) {
  const l = line.trim();
  if (l.length > 150 || l.includes('|')) return false;
  if (/^(\d+)[ -]Days?\b/i.test(l) && !/^\d+ Days? \|/.test(l)) return !/\.\s.+\.$/.test(l) && l.length < 120;
  if (/^Day (Mount|Usambara)/i.test(l)) return true;
  if (/^Ngorongoro Day Trip Joining Safari/i.test(l)) return true;
  return false;
}

const HEAD = [
  [/^(overview|description)\b[:]?\s*(.*)$/i, 'overview'],
  [/^(safari )?highlights\b[:]?\s*(.*)$/i, 'highlights'],
  [/^(detailed )?(safari )?itinerary\b[:]?\s*(.*)$/i, 'itinerary'],
  [/^(inclusions|what.s included|included\/exclude|includes)\b[:?]?\s*(.*)$/i, 'inclusions'],
  [/^(exclusions?|what.s excluded)\b[:?]?\s*(.*)$/i, 'exclusions'],
  [/^why choose\b.*$/i, 'notes'],
  [/^important note\b.*$/i, 'notes']
];

const META_KEYS = ['Highest Point Altitude', 'Elevation Gain', 'Trekking Duration', 'Walking Time', 'Vegetation Zone', 'Elevation', 'Distance', 'Accommodation', 'Overnight', 'Meal Plan', 'Meals'];
const META_RE = new RegExp('(' + META_KEYS.join('|') + ')\\s*:', 'gi');

function splitMeta(line) {
  const parts = [];
  let m, last = null;
  META_RE.lastIndex = 0;
  const idx = [];
  while ((m = META_RE.exec(line))) idx.push({ key: m[1], start: m.index, end: META_RE.lastIndex });
  if (!idx.length || idx[0].start !== 0) return null;
  idx.forEach((k, i) => parts.push([k.key, line.slice(k.end, i + 1 < idx.length ? idx[i + 1].start : undefined).trim()]));
  return parts;
}

function parsePrice(lines, out) {
  const text = lines.join('\n');
  const tiers = [];
  for (const ln of lines) {
    const s = ln.replace(/(\d),\s(\d)/g, '$1$2');
    const m = s.match(/\$?\s*(\d[\d,]*)(?:\.\d+)?\s*,?\s*(?:pp|per person)?\.?\s*(\d+)\s*(?:pax|pac)\b/i);
    if (m) tiers.push({ pax: +m[2], usd: num(m[1]) });
  }
  if (tiers.length) { out.price_tiers = tiers; return; }
  const one = text.replace(/(\d),\s(\d)/g, '$1$2').match(/\$?\s*(\d[\d,]{2,})/);
  if (one && !out.price_tiers.length) {
    out.price_single = num(one[1]);
    out.price_note = clean(text.replace(/^price\w*\s*[:;]?\s*/i, ''));
  }
}

function parseBlock(lines, meta) {
  let title = clean(lines[0]).replace(/\s*-\s*soles price.*$/i, '').replace(/\s*\(\s*Joining\s*\)/i, ' (Joining)');
  const p = {
    title, slug: '', category: meta.kind, type: '', days: null, overview: [], highlights: [], itinerary: [],
    inclusions: [], exclusions: [], notes: [], price_tiers: [], price_single: null, price_note: '', source: meta.doc, warnings: []
  };
  let state = 'overview', day = null, priceLines = [];
  const pushDay = () => { if (day) { const ex = p.itinerary.find(d => d.day === day.day); if (ex) { if (day.body.join('').length >= ex.body.join('').length) Object.assign(ex, day); } else p.itinerary.push(day); day = null; } };

  const expanded = [];
  lines.slice(1).forEach(r => { if ((r.match(/[✓✗]/g) || []).length > 1 || /^[✓✗]/.test(r.trim()) && /[✓✗].*[✓✗]/.test(r)) r.split(/[✓✗]/).forEach(x => expanded.push(x)); else expanded.push(r); });
  for (let raw of expanded) {
    const line = clean(raw);
    if (!line) continue;
    let m;
    if ((m = line.match(/^(?:safari )?type\s*:\s*(.*)$/i))) { p.type = m[1].replace(/[“”"]/g, '').trim(); continue; }
    if (/^safari type\s*:?/i.test(line) || /^fly in fly out$/i.test(line)) { p.type = (p.type ? p.type + ' ' : '') + line.replace(/^safari type\s*:?/i, '').trim(); continue; }
    if ((m = line.match(/^days?\s*(\d+)\s*[.:;·\-–]?\s*(.*)$/i)) && /^day\s*\d/i.test(line)) { pushDay(); day = { day: +m[1], title: m[2].trim(), body: [], meta: {} }; state = 'itinerary'; continue; }
    if (/^prices?\b\s*[:;.]?/i.test(line) && !/^price(s)? (of|is)/i.test(line)) { pushDay(); state = 'price'; priceLines = [line]; continue; }
    if (state === 'price') {
      if (/\d/.test(line) && /(pp|pax|pac)\b/i.test(line)) { priceLines.push(line); continue; }
      parsePrice(priceLines, p); priceLines = []; state = 'after';
    }
    if (/^18% VAT/i.test(line) && state === 'inclusions') state = 'exclusions';
    let hit = false;
    for (const [re, name] of HEAD) {
      if ((m = line.match(re)) && line.length < 90 || (m = line.match(re)) && /^(overview|description)\b/i.test(line)) {
        pushDay(); state = name; hit = true;
        const inline = (m[m.length - 1] || '').trim();
        if (inline && name === 'overview') p.overview.push(inline);
        if (name === 'notes') p.notes.push(line);
        break;
      }
    }
    if (hit) continue;
    if (state === 'itinerary' && day) {
      const meta2 = splitMeta(line);
      if (meta2) { meta2.forEach(([k, v]) => { day.meta[k] = v; }); continue; }
      day.body.push(line); continue;
    }
    if (state === 'itinerary') { day = { day: 1, title: '', body: [line], meta: {} }; continue; }
    if (state === 'overview') { p.overview.push(line); continue; }
    if (state === 'highlights') { p.highlights.push(line); continue; }
    if (state === 'inclusions') { p.inclusions.push(line); continue; }
    if (state === 'exclusions') { p.exclusions.push(line); continue; }
    if (state === 'notes') { p.notes.push(line); continue; }
    if (state === 'after') { p.notes.push(line); }
  }
  if (state === 'price' && priceLines.length) parsePrice(priceLines, p);
  pushDay();

  p.itinerary.sort((a, b) => a.day - b.day);
  const m2 = p.title.match(/^(\d+)[ -]Days?/i);
  const maxDay = p.itinerary.reduce((a, d) => Math.max(a, d.day), 0);
  if (m2) p.days = +m2[1];
  else if (maxDay) { p.days = maxDay; p.title = p.title.replace(/^Day\s+/i, maxDay + '-Day '); p.warnings.push('Day count missing from title in source; derived from itinerary (' + maxDay + ' days).'); }
  else p.warnings.push('Day count missing from title in source and no itinerary; left blank.');
  if (/^Day\s+/i.test(p.title)) p.title = p.title.replace(/^Day\s+/i, '');
  if (/mamuya/i.test(priceLines.join(' ') + p.price_note)) p.price_note = '';
  p.title = p.title.replace(/\s+\./g, '.').trim();
  p.title = p.title.replace(/\s+:/, ':').replace(/\.\s*$/, '').replace(/ midrange /i, ' Midrange ').replace(/\s{2,}/g, ' ');
  p.slug = slugify(p.title);
  if (!p.price_tiers.length && !p.price_single) p.warnings.push('No price in source document; shown as price on request.');
  return p;
}

function classify(p) {
  const t = (p.title + ' ' + p.type).toLowerCase();
  const tags = new Set();
  const add = (re, tag) => { if (re.test(t)) tags.add(tag); };
  add(/kilimanjaro/, 'kilimanjaro'); add(/meru/, 'meru'); add(/lengai|natron/, 'lengai-natron'); add(/usambara/, 'usambara');
  add(/migration|mara river|crossing/, 'migration'); add(/calving|ndutu/, 'calving');
  add(/fly[ -]?in/, 'fly-in'); add(/zanzibar/, 'zanzibar'); add(/luxury/, 'luxury'); add(/mid ?range/, 'midrange');
  add(/budget|affordable|joining|shared|group/, 'budget'); add(/camping/, 'camping'); add(/cultural|eyasi/, 'cultural');
  if (p.days === 1) tags.add('day-trip');
  p.tags = [...tags];
  if (p.category === 'trekking') p.subcategory = tags.has('kilimanjaro') ? 'Kilimanjaro' : tags.has('meru') ? 'Mount Meru' : tags.has('lengai-natron') ? 'Oldoinyo Lengai' : tags.has('usambara') ? 'Usambara' : 'Trekking';
  if (p.category === 'safari' && /joining|group/i.test(p.type)) p.category = 'group';
  // image
  const img = p.tags.includes('kilimanjaro') ? 'kilimanjaro-01-card.webp'
    : p.tags.includes('meru') || p.tags.includes('usambara') ? 'kilimanjaro-06-card.webp'
    : p.tags.includes('lengai-natron') ? 'kilimanjaro-04-card.webp'
    : p.tags.includes('migration') ? 'serengeti-04-card.webp'
    : p.tags.includes('calving') ? 'serengeti-03-card.webp'
    : p.tags.includes('zanzibar') ? 'zanzibar-08-card.webp'
    : /ngorongoro/i.test(p.title) ? 'ngorongoro-02-card.webp'
    : /tarangire/i.test(p.title) ? 'tarangire-01-card.webp'
    : 'serengeti-04-card.webp';
  p.image = 'assets/img/' + img;
  const prices = p.price_tiers.map(t => t.usd).concat(p.price_single ? [p.price_single] : []);
  p.price_from = prices.length ? Math.min(...prices) : null;
}

const all = [];
for (const meta of FILES) {
  const lines = fs.readFileSync(path.join(SRC, meta.file), 'utf8').split('\n');
  const starts = [];
  lines.forEach((l, i) => { if (isTitle(l, meta.kind)) starts.push(i); });
  starts.forEach((s, i) => {
    const block = lines.slice(s, i + 1 < starts.length ? starts[i + 1] : undefined);
    const p = parseBlock(block, meta);
    classify(p);
    all.push(p);
  });
}

// dedupe slugs
const seen = {};
all.forEach(p => { if (seen[p.slug]) { seen[p.slug]++; p.slug += '-' + seen[p.slug]; } else seen[p.slug] = 1; });
all.forEach((p, i) => { p.sort = i; });

fs.writeFileSync(path.join(__dirname, '..', 'landing', 'data', 'packages.json'), JSON.stringify(all, null, 2));
console.log(all.length + ' packages');
all.forEach(p => console.log([p.category.padEnd(8), String(p.days).padStart(4), 'd', String(p.itinerary.length).padStart(2), 'it', String(p.inclusions.length).padStart(2), 'inc', String(p.exclusions.length).padStart(2), 'exc', String(p.price_from).padStart(6), p.title.slice(0, 70)].join(' ')));
all.filter(p => p.warnings.length).forEach(p => console.log('WARN', p.title, '->', p.warnings.join(' ')));
