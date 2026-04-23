#!/usr/bin/env node
/**
 * Find "The Gonsalves Family" tree in the database and print ADMIN_TREE_ID.
 * Run: node scripts/find-gonsalves-tree.mjs (from the-gonsalves-family-admin)
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Run from the-gonsalves-family-admin with .env.local.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, file_id FROM trees
     WHERE name ILIKE '%Gonsalves%'
     ORDER BY created_at DESC
     LIMIT 5`
  );

  if (rows.length === 0) {
    const { rows: anyRows } = await pool.query(
      "SELECT id, name FROM trees ORDER BY created_at DESC LIMIT 5"
    );
    console.error("No tree matching 'Gonsalves' found.");
    if (anyRows.length > 0) {
      console.error("Existing trees:", anyRows.map((t) => `${t.name} (${t.id})`).join(", "));
    }
    await pool.end();
    process.exit(1);
  }

  const tree = rows[0];
  console.log("ADMIN_TREE_ID=" + tree.id);
  console.log("# Tree: " + tree.name);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
