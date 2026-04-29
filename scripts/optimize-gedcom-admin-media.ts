#!/usr/bin/env node
/**
 * Re-encode large admin images/videos on disk and update `gedcom_media_v2.file_ref` / `form`.
 * Run on the host that holds `ADMIN_MEDIA_FILES_ROOT` (or dev `public/uploads`).
 *
 * Usage (from the-gonsalves-family-admin):
 *   DATABASE_URL=… npm run optimize-gedcom-admin-media -- --dry-run
 *   DATABASE_URL=… npm run optimize-gedcom-admin-media -- --ids=id1,id2
 *
 * Env: DATABASE_URL — required. Optional: ADMIN_MEDIA_FILES_ROOT (same as the app).
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { isAdminMediaStoreCategory, type AdminMediaStoreCategory } from "../lib/admin/media-upload-storage.ts";
import { optimizeExistingAdminMediaFile } from "../lib/admin/optimize-admin-uploaded-media.ts";
import { resolveFileRefToGedcomAdminDiskPath } from "../lib/admin/resolve-file-ref-to-gedcom-disk-path.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

const DEFAULT_MEDIA_IDS = [
  "2db5ca2e-d0e7-40fb-8ddb-6952db2ecca6",
  "d9038c41-5511-49f5-80a3-aeda5bef329f",
  "a090a053-998f-4db4-9d97-84c352390181",
];

function parseArgs(argv: string[]) {
  let dryRun = false;
  let ids: string[] | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--ids=")) {
      ids = a.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return { dryRun, ids: ids ?? DEFAULT_MEDIA_IDS };
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

function categoryFromDiskPath(absPath: string): AdminMediaStoreCategory | null {
  const parts = absPath.split(path.sep).filter(Boolean);
  const idx = parts.lastIndexOf("gedcom-admin");
  if (idx < 0 || idx + 1 >= parts.length) return null;
  const seg = parts[idx + 1]!;
  if (!isAdminMediaStoreCategory(seg)) return null;
  return seg;
}

async function main() {
  const { dryRun, ids } = parseArgs(process.argv.slice(2));
  const { prisma, pool } = createScriptPrisma();
  try {
    for (const id of ids) {
      const row = await prisma.gedcomMedia.findUnique({
        where: { id },
        select: { id: true, fileRef: true, form: true, title: true },
      });
      if (!row) {
        console.warn(`[skip] No gedcom_media row for id=${id}`);
        continue;
      }
      const ref = row.fileRef?.trim();
      if (!ref) {
        console.warn(`[skip] id=${id} has empty file_ref`);
        continue;
      }
      const diskPath = resolveFileRefToGedcomAdminDiskPath(ref);
      if (!diskPath) {
        console.warn(`[skip] id=${id} file_ref not under gedcom-admin: ${ref}`);
        continue;
      }
      const category = categoryFromDiskPath(diskPath);
      if (!category) {
        console.warn(`[skip] id=${id} could not infer category from path: ${diskPath}`);
        continue;
      }

      console.log(`--- ${id} (${row.title ?? "no title"})`);
      console.log(`    file_ref: ${ref}`);
      console.log(`    disk:     ${diskPath}`);

      const result = await optimizeExistingAdminMediaFile({ diskPath, category, dryRun });
      if (!result.changed) {
        console.log(`    -> no change: ${result.reason}`);
        continue;
      }
      if (result.dryRun) {
        console.log(`    [dry-run] would set file_ref=${result.newFileRef} form=${result.newForm}`);
        continue;
      }

      await prisma.gedcomMedia.update({
        where: { id },
        data: {
          fileRef: result.newFileRef,
          form: result.newForm ?? undefined,
        },
      });
      console.log(`    -> updated file_ref=${result.newFileRef} form=${result.newForm} size=${result.newSize}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
