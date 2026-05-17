#!/usr/bin/env node
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensureDefaultRelationshipTypes, resolveTreeIdForFileUuid } from "../lib/admin/individual-relationships.ts";

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
    const fileRows = await prisma.gedcomFile.findMany({ select: { id: true } });
    for (const file of fileRows) {
      const treeId = await resolveTreeIdForFileUuid(prisma, file.id);
      await ensureDefaultRelationshipTypes(prisma, treeId);
    }
    // Also keep global defaults available for non-tree-scoped workflows.
    await ensureDefaultRelationshipTypes(prisma, null);
    console.log("Seeded default relationship types/roles.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
