# Deployment: admin.gonsalvesfamily.com

**App:** `the-gonsalves-family-admin` (Next.js)  
**Public URLs:** https://admin.gonsalvesfamily.com, https://storycreator.gonsalvesfamily.com  
**Process manager:** PM2 name **`admin-gonsalvesfamily`**  
**Local bind:** `127.0.0.1:3040` (`npm run start:prod`)

Full first-time and ongoing steps: **[deployment/README.md](deployment/README.md)**.

---

## Nginx (reference)

- **Repo template:** [deployment/nginx-admin.gonsalvesfamily.com.conf](deployment/nginx-admin.gonsalvesfamily.com.conf)
- **Standalone StoryCreator template:** [deployment/nginx-storycreator.gonsalvesfamily.com.conf](deployment/nginx-storycreator.gonsalvesfamily.com.conf)
- **Typical install:** `/etc/nginx/sites-available/admin.gonsalvesfamily.com` → `sites-enabled`
- **StoryCreator install:** `/etc/nginx/sites-available/storycreator.gonsalvesfamily.com` → `sites-enabled`
- **Proxy:** `http://127.0.0.1:3040`
- **TLS:** `/etc/letsencrypt/live/admin.gonsalvesfamily.com/`
- **Logs:** `/var/log/nginx/admin.gonsalvesfamily.com.access.log`, `.error.log`, and matching `storycreator...` logs

Do **not** cache HTML aggressively at nginx for this app; `/_next/static/*` is safe to cache (immutable hashes from Next).

---

## PM2 (reference)

- **Config:** [deployment/ecosystem.config.cjs](deployment/ecosystem.config.cjs)
- **First start:** `pm2 start deployment/ecosystem.config.cjs` (from app root), then `pm2 save` / `pm2 startup`

---

## Deploy command

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
npm run deploy
```

Build → verify `.next/static/chunks` → `pm2 restart admin-gonsalvesfamily`.

---

## Static assets / stale UI

Same considerations as other Next production sites:

1. Production must use `next start` with a successful `next build` (not `next dev` on the server).
2. PM2 **cwd** must be this app root so `.next` matches the built tree.
3. HTML should not be cached; hashed assets under `/_next/static/` are cached via `next.config.ts`.

See `src/proxy.ts` for document `Cache-Control` behavior.
