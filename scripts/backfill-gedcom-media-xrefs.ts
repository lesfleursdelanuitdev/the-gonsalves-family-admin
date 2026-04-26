#!/usr/bin/env node
/**
 * Assigns GEDCOM-style `@Mn@` xrefs to `gedcom_media_v2` rows where `xref` is null or empty,
 * per `file_uuid` (tree), without colliding with existing `@M…@` values.
 *
 * Usage (from the-gonsalves-family-admin):
 *   DATABASE_URL=… node --experimental-strip-types scripts/backfill-gedcom-media-xrefs.ts --dry-run
 *   DATABASE_URL=… node --experimental-strip-types scripts/backfill-gedcom-media-xrefs.ts
 *
 * Env: DATABASE_URL — required
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Prisma, PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { nextMediaXrefsAfterOccupied } from "../lib/admin/gedcom-media-xref";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

function parseArgs(argv: string[]) {
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
  }
  return { dryRun };
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

function xrefMissing(x: string | null | undefined): boolean {
  return x == null || String(x).trim() === "";
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const { prisma, pool } = createScriptPrisma();
  try {
    const pendingRows = await prisma.$queryRaw<Array<{ file_uuid: string }>>(
      Prisma.sql`
        SELECT DISTINCT m.file_uuid
        FROM gedcom_media_v2 m
        WHERE m.xref IS NULL OR TRIM(COALESCE(m.xref, '')) = ''
      `,
    );
    const fileUuids = pendingRows.map((r) => r.file_uuid);
    console.log(`Trees with missing media xref: ${fileUuids.length}${dryRun ? " (dry-run)" : ""}`);

    let totalUpdated = 0;

    for (const fileUuid of fileUuids) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${fileUuid}::text)::bigint)`);
        const all = await tx.gedcomMedia.findMany({
          where: { fileUuid },
          orderBy: { createdAt: "asc" },
          select: { id: true, xref: true },
        });
        const needIds = all.filter((r) => xrefMissing(r.xref)).map((r) => r.id);
        if (needIds.length === 0) return;

        const newXrefs = nextMediaXrefsAfterOccupied(
          all.map((r) => r.xref),
          needIds.length,
        );

        console.log(
          `  file ${fileUuid}: assign ${needIds.length} xref(s) → ${newXrefs[0]!} … ${newXrefs[newXrefs.length - 1]!}`,
        );

        if (!dryRun) {
          for (let i = 0; i < needIds.length; i++) {
            await tx.gedcomMedia.update({
              where: { id: needIds[i]! },
              data: { xref: newXrefs[i]! },
            });
          }
        }
        totalUpdated += needIds.length;
      });
    }

    console.log(
      dryRun
        ? `Done (dry-run). Would update ${totalUpdated} row(s). Re-run without --dry-run to apply.`
        : `Done. Updated ${totalUpdated} row(s).`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
