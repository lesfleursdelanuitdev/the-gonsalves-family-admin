#!/bin/bash
# Deploy script for admin.gonsalvesfamily.com
# Applies Prisma migrations, ensures production build completes and static files exist before restart.
# Run from app root so PM2 (ecosystem cwd) serves this .next.
#
# Requires DATABASE_URL (Postgres, writable user) for migrate deploy. Typical server setup:
#   export DATABASE_URL=...   # or place it in .env.production / .env.local in this directory.

set -e
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

PM2_NAME="admin-gonsalvesfamily"
PRISMA_ROOT="$(cd "$APP_ROOT/../packages/ligneous-prisma" && pwd)"

# Load DATABASE_URL if not already set (same files as local migrate:all, plus plain .env)
if [ -z "${DATABASE_URL:-}" ]; then
  for envfile in "$APP_ROOT/.env" "$APP_ROOT/.env.production" "$APP_ROOT/.env.local"; do
    if [ -f "$envfile" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$envfile"
      set +a
    fi
  done
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Prisma cannot run migrations."
  echo "Set DATABASE_URL in the shell, or add it to $APP_ROOT/.env.production (or .env.local), then re-run deploy."
  exit 1
fi

echo "Applying Prisma migrations ($PRISMA_ROOT)..."
(cd "$PRISMA_ROOT" && npx prisma migrate deploy)

echo "Building production bundle in $APP_ROOT..."
npm run build

# Verify static files were generated (prevents serving without CSS/JS)
if [ ! -d ".next/static" ]; then
  echo "ERROR: Build failed - .next/static directory missing"
  exit 1
fi
if [ ! -d ".next/static/chunks" ] || [ -z "$(ls -A .next/static/chunks 2>/dev/null)" ]; then
  echo "ERROR: Build failed - .next/static/chunks is missing or empty"
  exit 1
fi

echo "Static files OK. Restarting PM2 (${PM2_NAME})..."
if ! pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  echo "ERROR: PM2 app '${PM2_NAME}' is not registered."
  echo "First time: cd $APP_ROOT && pm2 start deployment/ecosystem.config.cjs && pm2 save"
  exit 1
fi
pm2 restart "$PM2_NAME"

echo "Deploy complete. Site: https://admin.gonsalvesfamily.com"
echo "If CSS/code still stale: hard-refresh (Ctrl+Shift+R) or clear site data; ensure nginx is not caching the HTML response."
