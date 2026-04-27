import { createReadStream } from "node:fs";
import { access, constants, stat } from "node:fs/promises";
import archiver from "archiver";
import { PassThrough } from "node:stream";

import { buildAlbumExportManifest } from "@/lib/admin/build-album-export-manifest";
import { buildAlbumExportReadme, type AlbumReadmeMediaLine } from "@/lib/admin/build-album-export-readme";
import type { AlbumExportManifestMedia } from "@/lib/admin/build-album-export-manifest";
import {
  resolveFileRefToGedcomAdminDiskPath,
  zipEntryNameForMedia,
} from "@/lib/admin/resolve-file-ref-to-gedcom-disk-path";

export type AlbumZipMediaInput = {
  id: string;
  fileRef: string | null;
  form: string | null;
  title: string | null;
  xref: string | null;
  role: "album_member" | "cover_only";
};

export type AlbumZipAlbumInput = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverMediaId: string | null;
};

async function fileReadable(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Streams a ZIP: README.txt, manifest.json, then `media/*` for resolvable gedcom-admin uploads.
 */
export function startAlbumZipStream(opts: {
  album: AlbumZipAlbumInput;
  media: AlbumZipMediaInput[];
  treeFileUuid: string;
}): PassThrough {
  const { album, media, treeFileUuid } = opts;
  const pass = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err: Error) => {
    pass.destroy(err);
  });

  archive.pipe(pass);

  void (async () => {
    const generatedAtIso = new Date().toISOString();
    const readmeLines: AlbumReadmeMediaLine[] = [];
    const manifestMedia: AlbumExportManifestMedia[] = [];
    let zipIndex = 0;

    for (const row of media) {
      const ref = (row.fileRef ?? "").trim();
      const xref = (row.xref ?? "").trim();
      const title = (row.title ?? "").trim() || row.id;

      if (!ref) {
        manifestMedia.push({
          gedcomMediaId: row.id,
          zipPath: null,
          title: row.title,
          fileRef: row.fileRef,
          form: row.form,
          xref: row.xref,
          role: row.role,
          bundleStatus: "unresolved_path",
        });
        readmeLines.push({ kind: "unresolved", title, fileRef: "(empty)" });
        continue;
      }

      if (ref.startsWith("http://") || ref.startsWith("https://")) {
        manifestMedia.push({
          gedcomMediaId: row.id,
          zipPath: null,
          title: row.title,
          fileRef: row.fileRef,
          form: row.form,
          xref: row.xref,
          role: row.role,
          bundleStatus: "external_url",
        });
        readmeLines.push({ kind: "external", title, fileRef: ref });
        continue;
      }

      const disk = resolveFileRefToGedcomAdminDiskPath(ref);
      if (!disk) {
        manifestMedia.push({
          gedcomMediaId: row.id,
          zipPath: null,
          title: row.title,
          fileRef: row.fileRef,
          form: row.form,
          xref: row.xref,
          role: row.role,
          bundleStatus: "unresolved_path",
        });
        readmeLines.push({ kind: "unresolved", title, fileRef: ref });
        continue;
      }

      const ok = await fileReadable(disk);
      if (!ok) {
        manifestMedia.push({
          gedcomMediaId: row.id,
          zipPath: null,
          title: row.title,
          fileRef: row.fileRef,
          form: row.form,
          xref: row.xref,
          role: row.role,
          bundleStatus: "missing_on_disk",
        });
        readmeLines.push({ kind: "missing", title, fileRef: ref });
        continue;
      }

      const zipName = zipEntryNameForMedia(zipIndex, ref, xref);
      zipIndex += 1;
      const zipPath = `media/${zipName}`;
      let sizeBytes: number | undefined;
      try {
        const st = await stat(disk);
        sizeBytes = st.size;
      } catch {
        /* ignore */
      }

      manifestMedia.push({
        gedcomMediaId: row.id,
        zipPath,
        title: row.title,
        fileRef: row.fileRef,
        form: row.form,
        xref: row.xref,
        role: row.role,
        bundleStatus: "included",
        sizeBytes,
      });
      readmeLines.push({ kind: "included", zipPath, title, fileRef: ref });
    }

    const readme = buildAlbumExportReadme({
      albumName: album.name,
      generatedAtIso,
      mediaLines: readmeLines,
    });

    const { json: manifestJson } = await buildAlbumExportManifest({
      exportedAtIso: generatedAtIso,
      treeFileUuid,
      album: {
        id: album.id,
        name: album.name,
        description: album.description,
        isPublic: album.isPublic,
        coverMediaId: album.coverMediaId,
      },
      media: manifestMedia,
    });

    archive.append(Buffer.from(readme, "utf-8"), { name: "README.txt" });
    archive.append(Buffer.from(manifestJson, "utf-8"), { name: "manifest.json" });

    for (const m of manifestMedia) {
      if (m.bundleStatus !== "included" || !m.zipPath) continue;
      const disk = resolveFileRefToGedcomAdminDiskPath(m.fileRef ?? "");
      if (!disk) continue;
      const ok = await fileReadable(disk);
      if (!ok) continue;
      archive.append(createReadStream(disk), { name: m.zipPath });
    }

    await new Promise<void>((resolve, reject) => {
      archive.once("error", reject);
      archive.once("end", () => resolve());
      void archive.finalize();
    });
  })().catch((e) => {
    try {
      archive.abort();
    } catch {
      /* ignore */
    }
    pass.destroy(e instanceof Error ? e : new Error(String(e)));
  });

  return pass;
}
