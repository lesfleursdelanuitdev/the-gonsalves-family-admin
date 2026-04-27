import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ExportBundleManifestFile = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

export type ExportBundleManifest = {
  manifestVersion: string;
  exportedAt: string;
  treeId: string;
  appVersion: string;
  schemaVersion: string;
  counts: {
    individuals: number;
    families: number;
    media: number;
    notes: number;
  };
  files: ExportBundleManifestFile[];
};

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function sha256File(absPath: string): Promise<{ sha256: string; sizeBytes: number }> {
  const hash = createHash("sha256");
  let sizeBytes = 0;
  const stream = createReadStream(absPath);
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    sizeBytes += buf.length;
    hash.update(buf);
  }
  return { sha256: hash.digest("hex"), sizeBytes };
}

function arrayLen(enriched: Record<string, unknown>, key: string): number {
  const raw = enriched[key];
  return Array.isArray(raw) ? raw.length : 0;
}

export type BuildExportBundleManifestInput = {
  enriched: Record<string, unknown>;
  basename: string;
  treeId: string;
  exportedAtIso: string;
  readmeUtf8: string;
  gedPortableUtf8: string;
  jsonBytes: ArrayBuffer;
  csvBytes: ArrayBuffer;
  mediaFiles: { zipPath: string; diskPath: string }[];
  /** Semantic version of this manifest shape (bump when fields change). */
  manifestVersion?: string;
  /** Product / deploy version string (e.g. from package.json). */
  appVersion: string;
  /** Interchange / DB contract hint (Prisma or export pipeline generation). */
  schemaVersion: string;
};

/**
 * Builds manifest.json payload for a tree export ZIP: checksums, counts, and provenance.
 */
export async function buildExportBundleManifest(
  input: BuildExportBundleManifestInput,
): Promise<{ json: string; manifest: ExportBundleManifest }> {
  const {
    enriched,
    basename,
    treeId,
    exportedAtIso,
    readmeUtf8,
    gedPortableUtf8,
    jsonBytes,
    csvBytes,
    mediaFiles,
    manifestVersion = "1.0",
    appVersion,
    schemaVersion,
  } = input;

  const readmeBuf = Buffer.from(readmeUtf8, "utf-8");
  const gedBuf = Buffer.from(gedPortableUtf8, "utf-8");
  const jsonBuf = Buffer.from(jsonBytes);
  const csvBuf = Buffer.from(csvBytes);

  const files: ExportBundleManifestFile[] = [
    { path: "README.txt", sha256: sha256Buffer(readmeBuf), sizeBytes: readmeBuf.length },
    { path: `${basename}.ged`, sha256: sha256Buffer(gedBuf), sizeBytes: gedBuf.length },
    { path: `${basename}.json`, sha256: sha256Buffer(jsonBuf), sizeBytes: jsonBuf.length },
    { path: `${basename}.csv`, sha256: sha256Buffer(csvBuf), sizeBytes: csvBuf.length },
  ];

  for (const { zipPath, diskPath } of mediaFiles) {
    const { sha256, sizeBytes } = await sha256File(diskPath);
    files.push({ path: zipPath, sha256, sizeBytes });
  }

  const manifest: ExportBundleManifest = {
    manifestVersion,
    exportedAt: exportedAtIso,
    treeId,
    appVersion,
    schemaVersion,
    counts: {
      individuals: arrayLen(enriched, "Individuals"),
      families: arrayLen(enriched, "Families"),
      media: arrayLen(enriched, "Media"),
      notes: arrayLen(enriched, "Notes"),
    },
    files,
  };

  return { json: JSON.stringify(manifest, null, 2) + "\n", manifest };
}

/** `version` from `package.json` at `cwd` (defaults to `process.cwd()`). */
export async function readAdminPackageVersion(cwd: string = process.cwd()): Promise<string> {
  try {
    const raw = await readFile(join(cwd, "package.json"), "utf-8");
    const v = JSON.parse(raw) as { version?: string };
    const ver = typeof v.version === "string" ? v.version.trim() : "";
    return ver || "unknown";
  } catch {
    return "unknown";
  }
}
