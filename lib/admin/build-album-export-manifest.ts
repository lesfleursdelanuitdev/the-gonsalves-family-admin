import { readAdminPackageVersion } from "@/lib/admin/build-export-bundle-manifest";

export const ALBUM_EXPORT_MANIFEST_KIND = "ligneous-admin-album-export" as const;
export const ALBUM_EXPORT_MANIFEST_VERSION = "1" as const;

export type AlbumExportManifestMedia = {
  gedcomMediaId: string;
  /** Path inside the ZIP, e.g. `media/0001-…jpg`, or null when not bundled. */
  zipPath: string | null;
  title: string | null;
  fileRef: string | null;
  form: string | null;
  xref: string | null;
  role: "album_member" | "cover_only";
  bundleStatus: "included" | "external_url" | "missing_on_disk" | "unresolved_path";
  sizeBytes?: number;
};

export type AlbumExportManifest = {
  kind: typeof ALBUM_EXPORT_MANIFEST_KIND;
  manifestVersion: typeof ALBUM_EXPORT_MANIFEST_VERSION;
  /** ISO-8601 UTC timestamp when the ZIP was built. */
  exportedAt: string;
  /** Admin app package version when available. */
  appVersion: string;
  /**
   * Human-oriented summary: this ZIP is a single-album export from the admin app,
   * not a full tree interchange package.
   */
  about: string;
  treeFileUuid: string;
  album: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    coverMediaId: string | null;
  };
  media: AlbumExportManifestMedia[];
};

export async function buildAlbumExportManifest(opts: {
  exportedAtIso: string;
  treeFileUuid: string;
  album: AlbumExportManifest["album"];
  media: AlbumExportManifestMedia[];
}): Promise<{ json: string; manifest: AlbumExportManifest }> {
  const appVersion = await readAdminPackageVersion();
  const manifest: AlbumExportManifest = {
    kind: ALBUM_EXPORT_MANIFEST_KIND,
    manifestVersion: ALBUM_EXPORT_MANIFEST_VERSION,
    exportedAt: opts.exportedAtIso,
    appVersion,
    about:
      "Single-album export from The Gonsalves Family Admin (genealogical media archive). " +
      "Contains README.txt, this manifest.json, and a media/ folder with OBJE files that were stored " +
      "under /uploads/gedcom-admin/ on the server and found on disk. External URLs and missing files " +
      "are listed here only—not copied into the ZIP. This is not a full GEDCOM tree export.",
    treeFileUuid: opts.treeFileUuid,
    album: opts.album,
    media: opts.media,
  };
  return { manifest, json: `${JSON.stringify(manifest, null, 2)}\n` };
}
