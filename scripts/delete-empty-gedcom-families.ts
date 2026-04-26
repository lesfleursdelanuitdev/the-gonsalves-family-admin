#!/usr/bin/env node
/**
 * Deletes GedcomFamily rows that have no husband, no wife, and no children
 * (validator EMPTY_FAMILY) for a single gedcom_files row, plus matching gedcom_file_objects.
 *
 * Safety: aborts if any gedcom_spouses_v2 row still points at one of these families.
 *
 * Usage (from the-gonsalves-family-admin):
 *   node --experimental-strip-types scripts/delete-empty-gedcom-families.ts --dry-run
 *   node --experimental-strip-types scripts/delete-empty-gedcom-families.ts
 *   node --experimental-strip-types scripts/delete-empty-gedcom-families.ts --file-uuid=<uuid>
 *
 * Env: DATABASE_URL — required
 * Env: CLEANUP_FAMILY_FILE_UUID — optional default (tree1.ged file id)
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const DEFAULT_FILE_UUID = "6791c94e-a2a7-43c1-b73f-32cc0cb164e9";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

function parseArgs(argv: string[]) {
  let dryRun = false;
  let fileUuid: string | null =
    process.env.CLEANUP_FAMILY_FILE_UUID?.trim() || DEFAULT_FILE_UUID;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--file-uuid=")) fileUuid = a.slice("--file-uuid=".length).trim() || null;
  }
  return { dryRun, fileUuid: fileUuid! };
}

function createScriptPrisma(): { prisma: PrismaClient; pool: pg.Pool } {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error"],
  });
  return { prisma, pool };
}

async function main() {
  const { dryRun, fileUuid } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const { prisma, pool } = createScriptPrisma();
  try {
    const file = await prisma.gedcomFile.findFirst({
      where: { id: fileUuid },
      select: { id: true, name: true, originalFilename: true },
    });
    if (!file) {
      console.error(`No gedcom_files row with id ${fileUuid}`);
      process.exit(1);
    }
    console.log(`File: ${file.id} (${file.originalFilename ?? "?"}) "${file.name}"`);

    const candidates = await prisma.gedcomFamily.findMany({
      where: {
        fileUuid,
        husbandId: null,
        wifeId: null,
        childrenCount: 0,
        familyChildren: { none: {} },
      },
      select: { id: true, xref: true },
      orderBy: { xref: "asc" },
    });

    if (candidates.length === 0) {
      console.log("No empty families found (husband/wife null, zero children).");
      return;
    }

    const ids = candidates.map((c) => c.id);
    const spouseRefs = await prisma.gedcomSpouse.count({
      where: { fileUuid, familyId: { in: ids } },
    });
    if (spouseRefs > 0) {
      console.error(
        `Refusing delete: ${spouseRefs} gedcom_spouses_v2 row(s) still reference these family id(s).`,
      );
      process.exit(1);
    }

    console.log(`Empty families to remove: ${candidates.length}${dryRun ? " (dry-run)" : ""}`);
    for (const c of candidates) {
      console.log(`  ${c.id}  ${c.xref}`);
    }

    if (dryRun) {
      console.log("Re-run without --dry-run to delete.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      const fo = await tx.gedcomFileObject.deleteMany({
        where: { fileUuid, objectType: "FAM", objectUuid: { in: ids } },
      });
      console.log(`Deleted gedcom_file_objects rows: ${fo.count}`);

      const del = await tx.gedcomFamily.deleteMany({
        where: { fileUuid, id: { in: ids } },
      });
      console.log(`Deleted gedcom_families_v2 rows: ${del.count}`);
    });

    console.log("Done.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
