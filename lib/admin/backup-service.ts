import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, stat, readdir, unlink, access, constants } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import archiver from "archiver";
import { prisma } from "../database/prisma.ts";
import { buildEnrichedDocumentForExport } from "./build-enriched-document-for-export.ts";
import { buildBackupExtras } from "./backup-extras.ts";
import { postLibApiExport } from "./lib-api-export.ts";
import {
  resolveFileRefToGedcomAdminDiskPath,
  zipEntryNameForMedia,
} from "./resolve-file-ref-to-gedcom-disk-path.ts";
import { getAdminFileUuid, getAdminTreeId } from "../infra/admin-tree.ts";

/** Number of completed backups to retain on disk; older ones are deleted. */
const BACKUP_RETENTION = parseInt(process.env.BACKUP_RETENTION_COUNT ?? "10", 10);

export function getBackupsDir(): string {
  return process.env.BACKUPS_DIR ?? join(process.cwd(), "backups");
}

async function ensureBackupsDir(): Promise<void> {
  await mkdir(getBackupsDir(), { recursive: true });
}

/** Run pg_dump and return the dump as a Buffer. */
async function runPgDump(): Promise<Buffer> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set — cannot run pg_dump.");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn("pg_dump", [
      "--no-password",
      "--format=custom",
      "--dbname", dbUrl,
    ]);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.trim()) console.warn("[backup] pg_dump:", msg.trimEnd());
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`pg_dump exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`pg_dump failed to start: ${err.message}. Ensure pg_dump is installed.`));
    });
  });
}

/** Resolve the last applied migration name from _prisma_migrations. */
async function getSchemaVersion(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    return rows[0]?.migration_name ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Check whether a path is readable. */
async function isReadable(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** Delete backups beyond the retention window (keeps the N most recent COMPLETE ones). */
export async function applyRetentionPolicy(keepBackupId: string): Promise<void> {
  const old = await prisma.backup.findMany({
    where: {
      status: "COMPLETE",
      id: { not: keepBackupId },
      filePath: { not: null },
    },
    orderBy: { createdAt: "desc" },
    skip: BACKUP_RETENTION - 1,
    select: { id: true, filePath: true },
  });

  for (const row of old) {
    if (row.filePath) {
      await unlink(row.filePath).catch(() => {});
    }
    await prisma.backup.delete({ where: { id: row.id } }).catch(() => {});
  }
}

/**
 * Core backup runner. Creates a ZIP at `backups/<timestamp>-backup.zip` containing:
 *   database/dump.pgdump  — pg_dump custom-format dump
 *   tree/tree.ged         — GEDCOM export
 *   tree/tree.json        — enriched JSON export (Go lib)
 *   tree/extras.json      — non-GEDCOM site data
 *   media/*               — all resolvable media files
 *   manifest.json         — provenance metadata
 *
 * Updates the Backup record in the DB as it progresses. Throws on failure.
 */
export async function runBackup(backupId: string): Promise<void> {
  await prisma.backup.update({ where: { id: backupId }, data: { status: "RUNNING" } });

  try {
    await ensureBackupsDir();

    const fileUuid = await getAdminFileUuid();
    const treeId = await getAdminTreeId().catch(() => fileUuid);
    const schemaVersion = await getSchemaVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const zipPath = join(getBackupsDir(), `${timestamp}-backup.zip`);

    // Gather all data concurrently where possible
    const [pgDumpBuf, enriched, schemaVer] = await Promise.all([
      runPgDump(),
      buildEnrichedDocumentForExport(fileUuid),
      Promise.resolve(schemaVersion),
    ]);

    const [gedBuf, jsonBuf, extras] = await Promise.all([
      postLibApiExport(enriched, "gedcom", "tree"),
      postLibApiExport(enriched, "json", "tree"),
      buildBackupExtras(fileUuid, treeId),
    ]);

    // Resolve media files
    type MediaRow = { file?: string; xref?: string };
    const mediaRows: MediaRow[] = Array.isArray(enriched.Media)
      ? (enriched.Media as MediaRow[]).filter(Boolean)
      : [];

    const mediaEntries: { disk: string; zipPath: string }[] = [];
    let mediaIdx = 0;
    for (const row of mediaRows) {
      const ref = (row.file ?? "").trim();
      if (!ref || ref.startsWith("http://") || ref.startsWith("https://")) continue;
      const disk = resolveFileRefToGedcomAdminDiskPath(ref);
      if (!disk || !(await isReadable(disk))) continue;
      const zipName = zipEntryNameForMedia(mediaIdx++, ref, row.xref ?? "");
      mediaEntries.push({ disk, zipPath: `media/${zipName}` });
    }

    const manifest = {
      backupId,
      createdAt: new Date().toISOString(),
      schemaVersion: schemaVer,
      fileUuid,
      treeId,
      mediaFileCount: mediaEntries.length,
      pgDumpBytes: pgDumpBuf.length,
      gedBytes: gedBuf.byteLength,
      jsonBytes: jsonBuf.byteLength,
    };

    // Assemble ZIP to disk
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 6 } });

      archive.on("error", reject);
      output.on("error", reject);
      output.on("close", resolve);
      archive.pipe(output);

      archive.append(Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"), { name: "manifest.json" });
      archive.append(pgDumpBuf, { name: "database/dump.pgdump" });
      archive.append(Buffer.from(gedBuf), { name: "tree/tree.ged" });
      archive.append(Buffer.from(jsonBuf), { name: "tree/tree.json" });
      archive.append(Buffer.from(JSON.stringify(extras, null, 2), "utf-8"), { name: "tree/extras.json" });

      for (const { disk, zipPath: entryName } of mediaEntries) {
        archive.append(createReadStream(disk), { name: entryName });
      }

      void archive.finalize();
    });

    const { size } = await stat(zipPath);

    await prisma.backup.update({
      where: { id: backupId },
      data: {
        status: "COMPLETE",
        completedAt: new Date(),
        filePath: zipPath,
        fileSize: BigInt(size),
        schemaVersion: schemaVer,
        manifest: manifest as object,
      },
    });

    await applyRetentionPolicy(backupId);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.backup.update({
      where: { id: backupId },
      data: { status: "FAILED", errorMessage: msg.slice(0, 5000) },
    }).catch(() => {});
    throw err;
  }
}
