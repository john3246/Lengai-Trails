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

// Contact form: no backend yet, opens an email draft
const form = document.getElementById('quoteForm');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const note = document.getElementById('formNote');
    if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email || '')) { note.textContent = 'Please enter your name and a valid email.'; return; }
    const body = `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone}\nDates: ${d.dates}\nInterest: ${d.interest}\nTravellers: ${d.pax}\n\n${d.msg}`;
    location.href = `mailto:info@lengaitrails.com?subject=${encodeURIComponent('Quote request from ' + d.name)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Thank you. Your email app should open with your request.';
  });
}
