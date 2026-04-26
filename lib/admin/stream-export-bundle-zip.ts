import { createReadStream } from "node:fs";
import { access, constants } from "node:fs/promises";
import archiver from "archiver";
import { PassThrough } from "node:stream";

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

function getMediaRows(enriched: EnrichedForBundle): Array<{ file?: string; xref?: string }> {
  const raw = enriched.Media;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is Record<string, unknown> => x != null && typeof x === "object") as Array<{
    file?: string;
    xref?: string;
  }>;
}

/**
 * Starts building a ZIP on `pass` (piped from internal archiver). Errors destroy `pass`.
 * Layout: README.txt, then `<basename>.{ged,json,csv}`, then `media/*` for resolved uploads.
 */
export function startExportBundleZipStream(opts: {
  enriched: EnrichedForBundle;
  basename: string;
}): PassThrough {
  const { enriched, basename } = opts;
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
      }

      const readme = buildExportBundleReadme({
        basename,
        mediaLines,
        generatedAtIso: new Date().toISOString(),
      });

      archive.append(readme, { name: "README.txt" });
      archive.append(Buffer.from(ged), { name: `${basename}.ged` });
      archive.append(Buffer.from(json), { name: `${basename}.json` });
      archive.append(Buffer.from(csv), { name: `${basename}.csv` });

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
