# Deploy admin.gonsalvesfamily.com

Production stack: **Next.js** (`next start` on **port 3040**) behind **nginx**, managed with **PM2**.

Canonical app path on the server (adjust if yours differs):

`/apps/gonsalves-genealogy/the-gonsalves-family-admin`

---

## 1. DNS

Create an **A** (and **AAAA** if you use IPv6) record:

- **Host:** `admin` (or `admin.gonsalvesfamily.com`, depending on your DNS UI)
- **Target:** your server’s public IP

---

## 2. Environment variables

On the server, in the app root, create or update **`.env`** / **`.env.production`** (however you load prod env for Next). Typical values:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection for Prisma |
| `ADMIN_TREE_ID` or `ADMIN_TREE_FILE_ID` | Scopes admin data to one tree (see `lib/admin-tree.ts`) |
| Session / auth secrets | Whatever `requireAuth` and login use in this app |
| `NEXT_PUBLIC_*` | Any public config the client needs |
| `ADMIN_MEDIA_FILES_ROOT` | **Production:** absolute path under **`/mnt/`** to the **parent** of the `gedcom-admin` upload folder (same layout as `public/uploads`). Default in code if unset: `/mnt/storage/uploads`. Example: `/mnt/storage/uploads` → files in `…/gedcom-admin/`. Must be **writable** by the user running PM2 (see §9). |
| `LIB_API_URL` | Base URL for **ligneous-gedcom-lib-api** (server-side `fetch` from Next). Required for **Admin → Export** (`/api/admin/export`). If unset, the app defaults to `http://localhost:8092` (fine for local dev). **Production on this host:** run the lib API on loopback **8092** and set `LIB_API_URL=http://127.0.0.1:8092` (also the default in `deployment/ecosystem.config.cjs`). **Remote API:** set to your HTTPS origin, e.g. `https://gedcom-api.example.com`. Install/always-on: [`../../ligneous-gedcom-lib-api/deploy/README.md`](../../ligneous-gedcom-lib-api/deploy/README.md). |

Run `npm run build` only after required env vars are present; some Next builds read them.

---

## 3. Install dependencies and build

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
npm ci
npm run build
```

---

## 4. TLS certificate (Let’s Encrypt)

**Option A — certbot standalone** (simple if nothing else is on port 80):

```bash
sudo systemctl stop nginx   # only if nginx holds :80
sudo certbot certonly --standalone -d admin.gonsalvesfamily.com
sudo systemctl start nginx
```

**Option B — certbot nginx** (nginx already serving HTTP for this host):

```bash
sudo certbot --nginx -d admin.gonsalvesfamily.com
```

Certificates are expected at:

`/etc/letsencrypt/live/admin.gonsalvesfamily.com/`

If `options-ssl-nginx.conf` is missing, install `certbot`’s nginx plugin packages for your OS or merge the SSL directives certbot prints.

---

## 5. Nginx

Copy the site config and enable it:

```bash
sudo cp /apps/gonsalves-genealogy/the-gonsalves-family-admin/deployment/nginx-admin.gonsalvesfamily.com.conf \
  /etc/nginx/sites-available/admin.gonsalvesfamily.com
sudo ln -sf /etc/nginx/sites-available/admin.gonsalvesfamily.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

- **Upstream:** `http://127.0.0.1:3040` (must match PM2 / `start:prod`).
- **Logs:** `/var/log/nginx/admin.gonsalvesfamily.com.*.log`

If `nginx -t` fails because SSL files are not there yet, obtain the certificate first (step 4), or temporarily comment out the `listen 443` server block until certs exist.

---

## 6. PM2 (first start)

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
pm2 start deployment/ecosystem.config.cjs
pm2 save
pm2 startup    # run the command it prints once, so processes survive reboot
```

Process name: **`admin-gonsalvesfamily`**.

If you later change **`deployment/ecosystem.config.cjs`** (for example `LIB_API_URL`), reload from disk:

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
pm2 startOrReload deployment/ecosystem.config.cjs
pm2 save
```

---

## 7. Ongoing deploys

From the app root:

```bash
cd /apps/gonsalves-genealogy/the-gonsalves-family-admin
npm run deploy
```

This runs `scripts/deploy.sh`: production **build**, checks **`.next/static`**, then **`pm2 restart admin-gonsalvesfamily`**.

---

## 8. Verify

- `pm2 status` — `admin-gonsalvesfamily` online  
- `curl -sI https://admin.gonsalvesfamily.com` — `200` or redirect to login  
- **GEDCOM lib API** (export and any server route that calls it):  
  `curl -fsS "${LIB_API_URL:-http://127.0.0.1:8092}/health"` → `{"status":"ok"}`  
  If this fails, start **ligneous-gedcom-lib-api** on the same host (Docker or systemd) or fix `LIB_API_URL` / firewall.
- Browser: hard refresh after deploy if assets look stale (`Cache-Control` on HTML is handled in `src/proxy.ts`)

---

## Firewall

Allow **80** and **443** from the internet. Do **not** expose **3040** publicly; only nginx should talk to it.

---

## 9. Media uploads (`/uploads/gedcom-admin/`)

GEDCOM media files from the admin UI are stored on disk and referenced in the DB as paths like `/uploads/gedcom-admin/<uuid>_<filename>`.

**Thumbnails / previews** use `<img>`-style delivery for `/uploads/…` (not the Next image optimizer) so they keep working behind nginx.

**Production checklist**

1. **Persist uploads under `/mnt`** — Production uploads must live under **`/mnt/`** (enforced at runtime). Create the tree and ensure the PM2 user can write:
   ```bash
   sudo mkdir -p /mnt/storage/uploads/gedcom-admin
   sudo chown -R "$USER:$USER" /mnt/storage/uploads
   ```
   Set **`ADMIN_MEDIA_FILES_ROOT=/mnt/storage/uploads`** (or another path under `/mnt/`) if you do not want the built-in default, then restart PM2 (`pm2 restart … --update-env`).
   Use the same user that runs `pm2` (often your deploy user).

2. **Permissions** — If uploads fail with 500 or empty thumbnails, the Node process cannot write `gedcom-admin`. Fix ownership/permissions on that folder.

3. **Public family site** — If another hostname (e.g. `www.…`) loads pages that use the same `file_ref` paths, the browser requests `/uploads/…` on **that** host, where the files do not exist. Either proxy `/uploads/` to the admin app, serve the same files from both hosts, or store **absolute** URLs pointing at `https://admin.gonsalvesfamily.com/uploads/…` for media meant for the public site.

**Optional nginx** — For heavy traffic you can serve `ADMIN_MEDIA_FILES_ROOT/gedcom-admin/` directly with `alias` before `proxy_pass`; otherwise Next serves them via `src/app/uploads/gedcom-admin/[...path]/route.ts` when files are outside `public/`.
