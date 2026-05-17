#!/usr/bin/env node
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { permissionDescription } from "../lib/authz/permissionDefinitions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

function createPrisma(): { prisma: PrismaClient; pool: pg.Pool } {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  return { prisma, pool };
}

async function main() {
  const { prisma, pool } = createPrisma();
  try {
    const rows = await prisma.authzPermission.findMany({
      where: {
        OR: [{ description: null }, { description: "" }],
      },
      select: { id: true, entity: true, action: true, scope: true },
    });
    for (const row of rows) {
      await prisma.authzPermission.update({
        where: { id: row.id },
        data: { description: permissionDescription(row.entity, row.action, row.scope) },
      });
    }
    console.log(`Backfilled ${rows.length} authz permission description(s).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
