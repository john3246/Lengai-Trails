// Sessions, CSRF, login throttling, API keys and roles.
//  - the session cookie is random, HttpOnly, SameSite=Strict, scoped to /cms, and only its SHA-256 hash is stored in the database
//  - every write needs the session's CSRF token in the X-CSRF-Token header
//  - failed logins are counted per IP and per email and temporarily blocked; passwords use scrypt
const crypto = require('crypto');
const { get, run, verifyPassword, hashPassword } = require('./db');
const { httpErr } = require('./util');

const COOKIE = 'cms_session';
const IDLE_MS = 8 * 3600e3, ABS_MS = 7 * 864e5, WINDOW_MS = 15 * 60e3;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = n => crypto.randomBytes(n).toString('hex');
const ROLE = { super_admin: 4, admin: 3, editor: 2, viewer: 1 };
const DUMMY = hashPassword('not-a-real-password');

const cookieOf = (req, name) => { for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()); } return null; };
const isHttps = req => process.env.NODE_ENV === 'production' || (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' || !!(req.socket && req.socket.encrypted);
const clientIp = req => (process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || (req.socket && req.socket.remoteAddress) || '';
const sessionCookie = (req, token, maxAge) => `${COOKIE}=${token}; Path=/cms; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (isHttps(req) ? '; Secure' : '');

async function login(req, body) {
  const email = String((body && body.email) || '').trim().toLowerCase().slice(0, 200), password = String((body && body.password) || '').slice(0, 200), ip = clientIp(req), now = Date.now();
  if (!email || !password) throw httpErr(400, 'Enter your email address and password.');
  const byIp = (await get('SELECT COUNT(*) c FROM login_attempts WHERE ip = ? AND ok = FALSE AND ts > ?', ip, now - WINDOW_MS)).c;
  const byMail = (await get('SELECT COUNT(*) c FROM login_attempts WHERE email = ? AND ok = FALSE AND ts > ?', email, now - WINDOW_MS)).c;
  if (byIp >= 12 || byMail >= 6) throw httpErr(429, 'Too many failed attempts. Please wait 15 minutes and try again.');
  const u = await get('SELECT * FROM users WHERE email = ?', email);
  const ok = verifyPassword(password, u ? u.pass_hash : DUMMY) && u && u.active === 1 && Number(u.locked_until) < now; // always runs scrypt, so timing does not reveal which emails exist
  await run('INSERT INTO login_attempts (ts, ip, email, ok) VALUES (?,?,?,?)', now, ip, email, !!ok);
  await run('DELETE FROM login_attempts WHERE ts < ?', now - 24 * 3600e3);
  if (!ok) throw httpErr(401, 'Wrong email or password.');
  const token = rand(32), csrf = rand(24);
  await run('INSERT INTO sessions (token, user_id, expires, csrf, last_seen, ip) VALUES (?,?,?,?,?,?)', sha(token), u.id, now + ABS_MS, csrf, now, ip);
  await run('DELETE FROM sessions WHERE expires < ?', now);
  await run('UPDATE users SET last_login = now() WHERE id = ?', u.id);
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role }, cookie: sessionCookie(req, token, ABS_MS / 1000) };
}
async function logout(req) { const t = cookieOf(req, COOKIE); if (t) await run('DELETE FROM sessions WHERE token = ?', sha(t)); return sessionCookie(req, '', 0); }

// Returns the signed-in user, or null. Also sets user.via = 'session' | 'key'.
async function current(req) {
  const t = cookieOf(req, COOKIE);
  if (t) {
    const s = await get('SELECT s.token, s.expires, s.csrf, s.last_seen, u.id, u.email, u.name, u.role, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', sha(t));
    const now = Date.now();
    if (s && s.active === 1 && Number(s.expires) > now && now - Number(s.last_seen || 0) < IDLE_MS) {
      if (now - Number(s.last_seen || 0) > 60e3) await run('UPDATE sessions SET last_seen = ? WHERE token = ?', now, s.token);
      return { id: s.id, email: s.email, name: s.name, role: s.role, csrf: s.csrf, via: 'session' };
    }
  }
  const key = req.headers['x-api-key'];
  if (key) {
    const k = await get('SELECT id, name, scope FROM api_keys WHERE key_hash = ?', sha(key));
    if (k) { await run('UPDATE api_keys SET last_used = now() WHERE id = ?', k.id); return { id: 0, email: 'api:' + k.name, name: k.name, role: k.scope === 'write' ? 'editor' : 'viewer', via: 'key' }; }
  }
  return null;
}
function csrfOk(req, user) {
  if (user.via !== 'session') return true;
  const h = String(req.headers['x-csrf-token'] || ''); if (!h || !user.csrf || h.length !== user.csrf.length) return false;
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(user.csrf));
}
const can = (user, need) => (ROLE[user.role] || 0) >= need;
const hashKey = k => sha(k);
const newKey = () => 'lt_' + crypto.randomBytes(24).toString('base64url');
const killOtherSessions = (userId, keepToken) => run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', userId, keepToken ? sha(keepToken) : '');
module.exports = { COOKIE, cookieOf, login, logout, current, csrfOk, can, ROLE, hashKey, newKey, clientIp, killOtherSessions, sha, hashPassword };
