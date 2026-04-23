#!/bin/bash
# Deploy script for admin.gonsalvesfamily.com
# Ensures production build completes and static files exist before restart.
# Run from app root so PM2 (ecosystem cwd) serves this .next.

set -e
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

PM2_NAME="admin-gonsalvesfamily"

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
