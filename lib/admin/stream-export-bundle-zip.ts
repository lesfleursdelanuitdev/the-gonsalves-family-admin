import { createReadStream } from "node:fs";
import { access, constants } from "node:fs/promises";
import archiver from "archiver";
import { PassThrough } from "node:stream";

import {
  buildExportBundleManifest,
  readAdminPackageVersion,
} from "@/lib/admin/build-export-bundle-manifest";
import { buildExportBundleReadme, type BundleMediaLine } from "@/lib/admin/build-export-bundle-readme";
import { postLibApiExport } from "@/lib/admin/lib-api-export";
import {
  resolveFileRefToGedcomAdminDiskPath,
  zipEntryNameForMedia,
} from "@/lib/admin/resolve-file-ref-to-gedcom-disk-path";

export type EnrichedForBundle = Record<string, unknown>;

async function fileReadable(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rewrites `n FILE …` lines so bundled site paths point at `media/…` zip entries.
 */
function rewriteGedcomFileLinesForBundle(gedText: string, fileRefToZipPath: Map<string, string>): string {
  if (fileRefToZipPath.size === 0) return gedText;
  const lines = gedText.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const m = /^(\d+) FILE (.*)$/.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const level = m[1];
    const trimmed = m[2].trim();
    const rel = fileRefToZipPath.get(trimmed);
    if (rel) {
      out.push(`${level} FILE ${rel}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function getMediaRows(enriched: EnrichedForBundle): Array<{ file?: string; xref?: string }> {
  const raw = enriched.Media;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is Record<string, unknown> => x != null && typeof x === "object") as Array<{
    file?: string;
    xref?: string;
  }>;
}

/** Default interchange label for `manifest.schemaVersion` (bump if enriched JSON shape changes). */
export const EXPORT_BUNDLE_SCHEMA_VERSION = "enriched-export@1";

/**
 * Starts building a ZIP on `pass` (piped from internal archiver). Errors destroy `pass`.
 * Layout: README.txt, manifest.json, `<basename>.{ged,json,csv}`, then `media/*` for resolved uploads.
 */
export function startExportBundleZipStream(opts: {
  enriched: EnrichedForBundle;
  basename: string;
  /** Gedcom file UUID (admin “tree” key) for provenance in manifest.json. */
  treeId: string;
  appVersion?: string;
  schemaVersion?: string;
}): PassThrough {
  const { enriched, basename, treeId, appVersion: appVersionOpt, schemaVersion: schemaVersionOpt } = opts;
  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err: Error) => {
    pass.destroy(err);
  });

  archive.pipe(pass);

  void (async () => {
    try {
      const [ged, json, csv] = await Promise.all([
        postLibApiExport(enriched, "gedcom", basename),
        postLibApiExport(enriched, "json", basename),
        postLibApiExport(enriched, "csv", basename),
      ]);

      const mediaRows = getMediaRows(enriched);
      const mediaLines: BundleMediaLine[] = [];
      const mediaStreams: { disk: string; zipPath: string }[] = [];
      /** Map exact DB `file_ref` → `media/…` entry for portable GEDCOM inside the zip. */
      const fileRefToZipPath = new Map<string, string>();
      let mediaZipIndex = 0;

      for (const row of mediaRows) {
        const ref = (row.file ?? "").trim();
        const xref = (row.xref ?? "").trim();
        if (!ref) continue;
        if (ref.startsWith("http://") || ref.startsWith("https://")) {
          mediaLines.push({ kind: "external", fileRef: ref, xref });
          continue;
        }
        const disk = resolveFileRefToGedcomAdminDiskPath(ref);
        if (!disk) {
          mediaLines.push({ kind: "unresolved", fileRef: ref, xref });
          continue;
        }
        const ok = await fileReadable(disk);
        if (!ok) {
          mediaLines.push({ kind: "missing", fileRef: ref, xref });
          continue;
        }
        const zipName = zipEntryNameForMedia(mediaZipIndex, ref, xref);
        mediaZipIndex += 1;
        const zipPath = `media/${zipName}`;
        mediaLines.push({ kind: "included", zipPath, fileRef: ref, xref });
        mediaStreams.push({ disk, zipPath });
        fileRefToZipPath.set(ref, zipPath);
      }

      const generatedAtIso = new Date().toISOString();
      const readme = buildExportBundleReadme({
        basename,
        mediaLines,
        generatedAtIso,
      });

      archive.append(readme, { name: "README.txt" });
      const gedText = new TextDecoder("utf-8").decode(ged);
      const gedPortable = rewriteGedcomFileLinesForBundle(gedText, fileRefToZipPath);
      const gedBuf = Buffer.from(gedPortable, "utf-8");
      archive.append(gedBuf, { name: `${basename}.ged` });
      archive.append(Buffer.from(json), { name: `${basename}.json` });
      archive.append(Buffer.from(csv), { name: `${basename}.csv` });

      const appVersion = appVersionOpt ?? (await readAdminPackageVersion());
      const schemaVersion = schemaVersionOpt ?? EXPORT_BUNDLE_SCHEMA_VERSION;
      const { json: manifestJson } = await buildExportBundleManifest({
        enriched,
        basename,
        treeId,
        exportedAtIso: generatedAtIso,
        readmeUtf8: readme,
        gedPortableUtf8: gedPortable,
        jsonBytes: json,
        csvBytes: csv,
        mediaFiles: mediaStreams.map(({ disk, zipPath }) => ({ diskPath: disk, zipPath })),
        appVersion,
        schemaVersion,
      });
      archive.append(Buffer.from(manifestJson, "utf-8"), { name: "manifest.json" });

      for (const { disk, zipPath } of mediaStreams) {
        archive.append(createReadStream(disk), { name: zipPath });
      }

      await new Promise<void>((resolve, reject) => {
        archive.once("error", reject);
        archive.once("end", () => resolve());
        void archive.finalize();
      });
    } catch (e) {
      try {
        archive.abort();
      } catch {
        /* ignore */
      }
      pass.destroy(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return pass;
}
