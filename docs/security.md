# Security notes

## What the CMS does
- **Data**: every content type is a real PostgreSQL table (`cms_*`) with typed columns; lists, itinerary days, prices and attachments are rows in their own tables. No JSON blobs are used for content. All SQL uses bound parameters, and table or column names only come from `landing/cms/schema.js`.
- **Sessions**: random 256-bit token in an `HttpOnly; SameSite=Strict; Secure (on HTTPS)` cookie scoped to `/cms`. Only the SHA-256 hash is stored in the database. 8 hour idle timeout, 7 day maximum, rotated on every login, all other sessions are ended when a password changes.
- **CSRF**: every write needs the session's `X-CSRF-Token` header (API keys are exempt because they are not cookies).
- **Login protection**: failed attempts are counted per IP (12) and per email (6) in 15 minutes, then answered with `429`. Passwords are hashed with scrypt, and a hash is always computed so response time does not reveal which emails exist.
- **Roles**: viewer = read only, editor = content and operations, super admin = settings, users, API keys, integrations and the audit log. API keys are `read` or `write` scoped (read by default).
- **Uploads**: PNG, JPG, WebP, GIF and PDF only, checked by file signature (not just the name), max 8 MB, random file names. SVG is refused on purpose because it can carry scripts.
- **Output**: the admin escapes every value; public pages escape everything and format long text with a small whitelist (`js/md.js`), so stored text cannot inject HTML.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS on HTTPS, and a strict Content-Security-Policy on `/cms` (no inline scripts).
- **Draft preview**: `/cms/preview/...` needs a signed-in session, is marked `noindex`, and drafts never appear in the public API, the sitemap or search results.
- **Webhooks**: https only, and addresses that resolve to private networks are refused.
- **Public forms**: size limits, per-IP rate limits, a honeypot field, validation against the same schema as the admin.
- **Static files**: server code, `/data`, `/tools`, dotfiles and `.json/.env/.md/.sql` are never served.

## Production checklist
1. Set `NODE_ENV=production` (adds `Secure` cookies and HSTS) and serve only over HTTPS.
2. Behind a proxy or load balancer set `TRUST_PROXY=1` so rate limits use the real visitor IP.
3. Set `ADMIN_EMAIL` and a long `ADMIN_PASSWORD` before the first start, or sign in and change the generated password straight away, then delete `landing/data/.admin-initial.txt`.
4. Use a database user that can only touch this app's tables:
   ```sql
   CREATE ROLE lengai_app LOGIN PASSWORD '...';
   GRANT CONNECT ON DATABASE lengai TO lengai_app;
   GRANT USAGE, CREATE ON SCHEMA public TO lengai_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lengai_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lengai_app;
   ```
   (CREATE is needed only on first start, to build the tables. It can be revoked afterwards.)
5. Back up the database (`pg_dump`) and the `landing/assets/uploads` folder.
6. The old `records` and `tours` tables are only an import source for a first-time install and a backup of the data from before the move. The running site and the CMS no longer read them. Leave them in place (the startup code recreates them if they are dropped).
