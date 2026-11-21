// Small shared helpers.
const slugify = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const httpErr = (code, message) => Object.assign(new Error(message), { code });

// Route shown on cards: the places named in the day titles, in order (e.g. Arusha, Tarangire, Serengeti).
const PLACES = [['Arusha', /arusha/i], ['Tarangire', /tarangire/i], ['Lake Manyara', /manyara|karatu/i], ['Serengeti', /serengeti|seronera|ndutu/i], ['Ngorongoro', /ngorongoro/i], ['Lake Eyasi', /eyasi/i], ['Lake Natron', /natron|lengai/i],
  ['Mikumi', /mikumi/i], ['Nyerere', /nyerere|selous/i], ['Ruaha', /ruaha/i], ['Zanzibar', /zanzibar|stone town/i], ['Kilimanjaro', /kilimanjaro|marangu|machame|lemosho|rongai|umbwe|kibo|horombo|mandara/i], ['Mount Meru', /meru|momella/i], ['Usambara', /usambara|lushoto/i]];
function routeOf(dayTitles) {
  const seen = [];
  for (const t of dayTitles || []) for (const [n, re] of PLACES) if (re.test(String(t || '').replace(/kilimanjaro\s+(international\s+)?airport|jro/gi, '')) && !seen.includes(n)) seen.push(n);
  return seen.join(' · ');
}
module.exports = { slugify, clip, httpErr, routeOf };
