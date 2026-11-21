// Tiny, safe formatter used by the CMS editor preview and the public pages.
// One line = one paragraph. # / ## / ### headings, - or 1. lists, > quote, --- rule, **bold**, *italic*, [text](link), ![alt](image).
// Everything else is escaped, so stored text can never inject HTML.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CmsMd = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u) ? u : /^[\w./-]+$/.test(u) ? '/' + u : '#');
  function inline(s) {
    return esc(s)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => '<img src="' + safeUrl(u.replace(/&amp;/g, '&')) + '" alt="' + a + '" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => '<a href="' + safeUrl(u.replace(/&amp;/g, '&')) + '"' + (/^https?:/i.test(u) ? ' rel="noopener" target="_blank"' : '') + '>' + t + '</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }
  function render(src) {
    const lines = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
    let out = '', list = null;
    const close = () => { if (list) { out += '</' + list + '>'; list = null; } };
    for (const raw of lines) {
      const l = raw.trim(); let m;
      if (!l) { close(); continue; }
      if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { close(); const n = m[1].length + 1; out += '<h' + n + '>' + inline(m[2]) + '</h' + n + '>'; }
      else if ((m = /^[-*]\s+(.*)$/.exec(l))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = /^\d+[.)]\s+(.*)$/.exec(l))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; }
      else if ((m = /^>\s?(.*)$/.exec(l))) { close(); out += '<blockquote>' + inline(m[1]) + '</blockquote>'; }
      else if (/^---+$/.test(l)) { close(); out += '<hr>'; }
      else { close(); out += '<p>' + inline(l) + '</p>'; }
    }
    close();
    return out;
  }
  const text = src => String(src == null ? '' : src).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^[#>\s]+|^[-*]\s+|^\d+[.)]\s+/gm, '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  return { render, text, esc };
});
