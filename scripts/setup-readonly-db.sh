#!/usr/bin/env bash
# Create read-only DB user and configure the-gonsalves-family.
# Requires: GONSALVES_READONLY_PASSWORD, ADMIN_DATABASE_URL
#
# ADMIN_DATABASE_URL: postgres superuser connection including password
#   e.g. postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/postgres
# GONSALVES_READONLY_PASSWORD: password for the new gonsalves_readonly user
#
# Example:
#   ADMIN_DATABASE_URL=postgresql://postgres:mypostgrespw@localhost:5432/postgres \
#   GONSALVES_READONLY_PASSWORD=myreadonlypw \
#   ./scripts/setup-readonly-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PW="${GONSALVES_READONLY_PASSWORD:?Set GONSALVES_READONLY_PASSWORD}"
ADMIN_URL="${ADMIN_DATABASE_URL:?Set ADMIN_DATABASE_URL (postgres superuser URL with password)}"

# Escape single quotes for use in SQL: ' -> ''
PW_ESC="${PW//\'/\'\'}"

echo "Creating gonsalves_readonly user..."
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 << EOF
-- Drop if exists (idempotent for reruns)
DROP USER IF EXISTS gonsalves_readonly;

CREATE USER gonsalves_readonly WITH PASSWORD '${PW_ESC}';

GRANT CONNECT ON DATABASE ligneous_frontend TO gonsalves_readonly;
EOF

echo "Granting SELECT on ligneous_frontend tables..."
psql "$ADMIN_URL" -d ligneous_frontend -v ON_ERROR_STOP=1 << EOF
GRANT USAGE ON SCHEMA public TO gonsalves_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO gonsalves_readonly;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO gonsalves_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO gonsalves_readonly;
EOF

echo "Creating .env.local..."
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
# URL-encode password for connection string
export PW
PW_URLENC=$(node -e "console.log(encodeURIComponent(process.env.PW))")

cat > "$PROJECT_ROOT/.env.local" << ENV
# Read-only database for the-gonsalves-family
DATABASE_URL="postgresql://gonsalves_readonly:${PW_URLENC}@${DB_HOST}:${DB_PORT}/ligneous_frontend?sslmode=disable"
ENV

echo "Done. .env.local created. Start the app with: npm run dev"
