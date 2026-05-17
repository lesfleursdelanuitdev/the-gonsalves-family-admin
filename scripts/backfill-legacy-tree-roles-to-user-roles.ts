#!/usr/bin/env node
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

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
    const [treeOwnerRole, treeMaintainerRole, treeContributorRole] = await Promise.all([
      prisma.role.findUnique({ where: { key: "tree_owner" }, select: { id: true } }),
      prisma.role.findUnique({ where: { key: "tree_maintainer" }, select: { id: true } }),
      prisma.role.findUnique({ where: { key: "tree_contributor" }, select: { id: true } }),
    ]);

    if (!treeOwnerRole || !treeMaintainerRole || !treeContributorRole) {
      throw new Error("Default tree roles are missing. Run `npm run seed-authz-roles` first.");
    }

    const [owners, maintainers, contributors] = await Promise.all([
      prisma.treeOwner.findMany({ select: { userId: true, treeId: true, addedBy: true } }),
      prisma.treeMaintainer.findMany({ select: { userId: true, treeId: true, addedBy: true } }),
      prisma.treeContributor.findMany({ select: { userId: true, treeId: true, addedBy: true } }),
    ]);

    let created = 0;
    for (const row of owners) {
      await prisma.userRole.upsert({
        where: { userId_roleId_treeId: { userId: row.userId, roleId: treeOwnerRole.id, treeId: row.treeId } },
        update: {},
        create: { userId: row.userId, roleId: treeOwnerRole.id, treeId: row.treeId, createdBy: row.addedBy },
      });
      created += 1;
    }
    for (const row of maintainers) {
      await prisma.userRole.upsert({
        where: { userId_roleId_treeId: { userId: row.userId, roleId: treeMaintainerRole.id, treeId: row.treeId } },
        update: {},
        create: { userId: row.userId, roleId: treeMaintainerRole.id, treeId: row.treeId, createdBy: row.addedBy },
      });
      created += 1;
    }
    for (const row of contributors) {
      await prisma.userRole.upsert({
        where: { userId_roleId_treeId: { userId: row.userId, roleId: treeContributorRole.id, treeId: row.treeId } },
        update: {},
        create: { userId: row.userId, roleId: treeContributorRole.id, treeId: row.treeId, createdBy: row.addedBy },
      });
      created += 1;
    }

    console.log(`Backfill complete. Processed ${created} legacy role memberships.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

