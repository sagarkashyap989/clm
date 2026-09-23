# One-box production deploy (VM + Docker)

This runs MongoDB, the Express API, and Nginx (static SPA + `/api` proxy) on a single machine. The browser talks to **one origin** on port 80.

## What you need on the VM

- Ubuntu 22.04+ (or similar)
- Docker Engine + Docker Compose plugin
- Ports **80** (and later **443** if you add TLS) open in the cloud firewall
- This git repo on the VM

Do **not** use local `docker-compose.yml` (Mailhog/MinIO/Redis) for production.

## 1. Copy the project to the VM

On your laptop (PowerShell), from the repo root:

```powershell
git push
```

On the VM:

```bash
git clone <your-repo-url> cml
cd cml
```

Or `scp` / `rsync` the folder if there is no remote.

## 2. Create production env

```bash
cp .env.production.example .env.production
nano .env.production
```

Set at least:

- `CLIENT_URL=http://YOUR_PUBLIC_IP` (exact origin, no trailing slash)
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — generate with:

```bash
openssl rand -hex 48
```

Leave `COOKIE_SECURE=false` until you terminate TLS.

`MONGODB_URI` is injected by Compose (`mongodb://mongo:27017/cml`). Do not point it at `localhost`.

SMTP is optional. Without it, accounts still work; invite/verify emails will not be delivered.

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

You want `MongoDB connected` and `API listening`.

## 4. Smoke test

From your laptop:

- `http://YOUR_PUBLIC_IP/health` → `{"status":"ok"}`
- `http://YOUR_PUBLIC_IP/` → landing page
- Register → `/dashboard`
- Refresh `/dashboard` — must not 404
- Invite a member only if SMTP is configured

## 5. Updates

```bash
cd cml
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. HTTPS later (recommended)

After a domain points at the VM:

1. Set `CLIENT_URL=https://cml.example.com`
2. Set `COOKIE_SECURE=true`
3. Put Caddy or Certbot in front of port 80/443, still proxying to this stack (or publish 80 only to the TLS proxy)

Until HTTPS is on, keep `COOKIE_SECURE=false` or login cookies will not stick.

## Useful commands

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml down
```

Mongo data is in the `mongo_data` volume. `down` without `-v` keeps it.

## Out of scope on this stack

Shared With Me / Share Contract, Mailhog, MinIO, Redis.
