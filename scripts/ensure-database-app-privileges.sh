#!/usr/bin/env bash
# Grant full DML (and execute on public functions) on schema public to an app role.
# Use when the admin app DATABASE_URL points at a user that lacks INSERT/UPDATE on
# tables such as public.sessions (PostgreSQL: "permission denied" / "keine Berechtigung für Tabelle …").
#
# Must run connected as a role that OWNS the tables (typically the Prisma migrate user, e.g. ligneous_user),
# not as the limited app user receiving grants.
#
# Usage:
#   cd the-gonsalves-family-admin
#   ./scripts/ensure-database-app-privileges.sh gonsalves_readonly
#
# Connection URL (in order):
#   1. GRANT_CONNECT_URL if set
#   2. Else DATABASE_URL after sourcing .env.local then .env.production (first file wins per var)
#
# Example (production):
#   GRANT_CONNECT_URL="postgresql://ligneous_user:…@host:5432/ligneous_frontend?sslmode=require" \
#     ./scripts/ensure-database-app-privileges.sh gonsalves_readonly

set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_ROOT"

TARGET_ROLE="${1:-}"
if [[ -z "$TARGET_ROLE" ]]; then
  echo "Usage: $0 <target_postgres_role>" >&2
  echo "Example: $0 gonsalves_readonly" >&2
  exit 1
fi
if ! [[ "$TARGET_ROLE" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "ERROR: target role must be a simple PostgreSQL identifier." >&2
  exit 1
fi

if [[ -z "${GRANT_CONNECT_URL:-}" ]]; then
  for envfile in "$APP_ROOT/.env.local" "$APP_ROOT/.env.production" "$APP_ROOT/.env"; do
    if [[ -f "$envfile" ]]; then
      set -a
      # shellcheck disable=SC1090
      . "$envfile"
      set +a
    fi
  done
fi

CONNECT_URL="${GRANT_CONNECT_URL:-${DATABASE_URL:-}}"
if [[ -z "$CONNECT_URL" ]]; then
  echo "ERROR: Set GRANT_CONNECT_URL or DATABASE_URL (e.g. via .env.local) to a writer/owner connection." >&2
  exit 1
fi

OWNER_USER="$(node -e "console.log(new URL(process.argv[1]).username)" "$CONNECT_URL")"

echo "Applying grants on public.* to role: $TARGET_ROLE"
echo "(connected as: $OWNER_USER)"

psql "$CONNECT_URL" -v ON_ERROR_STOP=1 <<SQL
GRANT USAGE ON SCHEMA public TO "${TARGET_ROLE}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${TARGET_ROLE}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${TARGET_ROLE}";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "${TARGET_ROLE}";
ALTER DEFAULT PRIVILEGES FOR ROLE "${OWNER_USER}" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${TARGET_ROLE}";
ALTER DEFAULT PRIVILEGES FOR ROLE "${OWNER_USER}" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${TARGET_ROLE}";
SQL

echo "Done. Verify with: psql \"\$DATABASE_URL\" -c '\\dp public.sessions'"
