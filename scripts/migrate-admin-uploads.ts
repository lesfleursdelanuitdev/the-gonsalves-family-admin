#!/usr/bin/env node
/**
 * Copy admin uploads to a new files root (optional), move flat `gedcom-admin/<file>` files into
 * `gedcom-admin/{images|documents|audio}/`, and update `gedcom_media_v2.file_ref` for legacy paths.
 *
 * Prisma schema unchanged — only `GedcomMedia.fileRef` text values.
 *
 * Usage (from the-gonsalves-family-admin):
 *   DATABASE_URL=… node --experimental-strip-types scripts/migrate-admin-uploads.ts --dry-run
 *   DATABASE_URL=… node --experimental-strip-types scripts/migrate-admin-uploads.ts \
 *     --source-parent ./public/uploads --dest-parent /mnt/storage/uploads
 *
 * Env:
 *   DATABASE_URL — required
 *   If --source-parent is omitted, uses ADMIN_MEDIA_FILES_ROOT or ./public/uploads (resolved from cwd).
 */
import { config } from "dotenv";
import { mkdir, readdir, rename, stat, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  adminMediaStoreCategoryFromFilename,
  ADMIN_MEDIA_STORE_CATEGORIES,
  type AdminMediaStoreCategory,
} from "../lib/admin/media-upload-storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

const CATEGORY_SET = new Set<string>(ADMIN_MEDIA_STORE_CATEGORIES);

function parseArgs(argv: string[]) {
  let dryRun = false;
  let sourceParent: string | null = null;
  let destParent: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--source-parent" && argv[i + 1]) {
      sourceParent = argv[++i]!;
    } else if (a === "--dest-parent" && argv[i + 1]) {
      destParent = argv[++i]!;
    }
  }
  return { dryRun, sourceParent, destParent };
}

function defaultUploadsParent(): string {
  const fromEnv = process.env.ADMIN_MEDIA_FILES_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(repoRoot, "public", "uploads");
}

function gedcomDir(uploadsParent: string): string {
  return path.join(uploadsParent, "gedcom-admin");
}

/** `/uploads/gedcom-admin/foo.jpg` → basename `foo.jpg`; already nested → null */
function parseLegacyFileRef(fileRef: string): string | null {
  const t = fileRef.trim();
  const parts = t.split("/").filter(Boolean);
  if (parts.length !== 3) return null;
  if (parts[0] !== "uploads" || parts[1] !== "gedcom-admin") return null;
  const basename = parts[2]!;
  if (CATEGORY_SET.has(basename)) return null;
  return basename;
}

function newFileRefForBasename(basename: string, category: AdminMediaStoreCategory): string {
  return `/uploads/gedcom-admin/${category}/${basename}`;
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

async function copyGedcomTree(sourceUploadsParent: string, destUploadsParent: string, dryRun: boolean) {
  const src = gedcomDir(sourceUploadsParent);
  const dest = gedcomDir(destUploadsParent);
  try {
    await stat(src);
  } catch {
    console.error(`Source gedcom-admin missing: ${src}`);
    process.exit(1);
  }
  console.log(`Copy ${src} → ${dest} (recursive)`);
  if (dryRun) return;
  await mkdir(destUploadsParent, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
}

async function reorganizeFlatFiles(uploadsParent: string, dryRun: boolean) {
  const ged = gedcomDir(uploadsParent);
  let dirEntries;
  try {
    dirEntries = await readdir(ged, { withFileTypes: true });
  } catch (e) {
    console.error(`Cannot read ${ged}:`, e);
    process.exit(1);
  }

  const moves: { from: string; to: string; category: AdminMediaStoreCategory; basename: string }[] = [];

  for (const ent of dirEntries) {
    if (ent.isDirectory()) {
      if (CATEGORY_SET.has(ent.name)) continue;
      console.warn(`Skipping unknown directory: ${path.join(ged, ent.name)}`);
      continue;
    }
    if (!ent.isFile()) continue;
    const basename = ent.name;
    const category = adminMediaStoreCategoryFromFilename(basename);
    const from = path.join(ged, basename);
    const destDir = path.join(ged, category);
    const to = path.join(destDir, basename);
    moves.push({ from, to, category, basename });
  }

  for (const { from, to, basename, category } of moves) {
    try {
      const st = await stat(to);
      if (st.isFile()) {
        console.warn(`Target already exists, skipping move: ${to}`);
        continue;
      }
    } catch {
      /* absent */
    }
    console.log(`MOVE ${basename} → ${category}/ (${dryRun ? "dry-run" : "apply"})`);
    if (dryRun) continue;
    await mkdir(path.dirname(to), { recursive: true });
    await rename(from, to);
  }
}

async function updateDatabase(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<{ updated: number; skipped: number; errored: number }> {
  const rows = await prisma.gedcomMedia.findMany({
    where: {
      fileRef: { startsWith: "/uploads/gedcom-admin/" },
    },
    select: { id: true, fileRef: true },
  });

  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (const row of rows) {
    const ref = row.fileRef;
    if (!ref) {
      skipped++;
      continue;
    }
    const basename = parseLegacyFileRef(ref);
    if (!basename) {
      skipped++;
      continue;
    }
    const category = adminMediaStoreCategoryFromFilename(basename);
    const next = newFileRefForBasename(basename, category);
    if (next === ref) {
      skipped++;
      continue;
    }
    console.log(`DB  ${row.id}  ${ref}  →  ${next}${dryRun ? "  (dry-run)" : ""}`);
    if (!dryRun) {
      try {
        await prisma.gedcomMedia.update({
          where: { id: row.id },
          data: { fileRef: next },
        });
      } catch (e) {
        console.error(`DB update failed for ${row.id}:`, e);
        errored++;
        continue;
      }
    }
    updated++;
  }

  return { updated, skipped, errored };
}

async function main() {
  const { dryRun, sourceParent: sp, destParent: dp } = parseArgs(process.argv.slice(2));
  const sourceParent = path.resolve(sp ?? defaultUploadsParent());
  const destParent = dp ? path.resolve(dp) : sourceParent;

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  console.log(`source-parent: ${sourceParent}`);
  console.log(`dest-parent:   ${destParent}`);
  console.log(`dry-run:       ${dryRun}`);

  if (sourceParent !== destParent) {
    await copyGedcomTree(sourceParent, destParent, dryRun);
    // After a real copy, files live under dest. In --dry-run there is no copy yet, so preview moves on source (same layout).
    await reorganizeFlatFiles(dryRun ? sourceParent : destParent, dryRun);
  } else {
    console.log("No copy (source and dest are the same).");
    await reorganizeFlatFiles(destParent, dryRun);
  }

  const { prisma, pool } = createScriptPrisma();
  try {
    const { updated, skipped, errored } = await updateDatabase(prisma, dryRun);
    console.log(
      `Done. Rows ${dryRun ? "that would be " : ""}updated: ${updated}, skipped: ${skipped}` +
        (errored ? `, errors: ${errored}` : ""),
    );
    if (dryRun) console.log("Re-run without --dry-run to apply.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
