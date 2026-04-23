# Read-only database user for the-gonsalves-family

This app needs read-only access to the `ligneous_frontend` PostgreSQL database. Create a dedicated user with `SELECT` privileges only.

## Option 1: Automated script

```bash
ADMIN_DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/postgres" \
GONSALVES_READONLY_PASSWORD="your_secure_readonly_password" \
./scripts/setup-readonly-db.sh
```

This creates the user and writes `DATABASE_URL` to `.env.local`.

## Option 2: Manual SQL (run as superuser)

```sql
CREATE USER gonsalves_readonly WITH PASSWORD 'your_secure_password';

GRANT CONNECT ON DATABASE ligneous_frontend TO gonsalves_readonly;

-- Connect to ligneous_frontend first, then:
\c ligneous_frontend

GRANT USAGE ON SCHEMA public TO gonsalves_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO gonsalves_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO gonsalves_readonly;
```

Then add to `the-gonsalves-family/.env.local`:

```
DATABASE_URL="postgresql://gonsalves_readonly:your_secure_password@localhost:5432/ligneous_frontend?sslmode=disable"
```

Replace `localhost:5432` and add `sslmode=require` if your database uses SSL.
