import path from "node:path";
import { normalizeSiteMediaPath } from "@/lib/admin/normalize-site-media-path";
import { resolveGedcomAdminDiskPath } from "@/lib/admin/media-upload-storage";

const GEDCOM_ADMIN_URL_PREFIX = "/uploads/gedcom-admin/";

/**
 * Maps a DB `file_ref` (site path) to an absolute file under the gedcom-admin upload root.
 * Returns null for empty values, http(s) URLs, or paths outside `/uploads/gedcom-admin/…`.
 */
export function resolveFileRefToGedcomAdminDiskPath(fileRef: string | null | undefined): string | null {
  if (fileRef == null) return null;
  let p = normalizeSiteMediaPath(String(fileRef)).trim();
  if (!p) return null;
  if (p.startsWith("http://") || p.startsWith("https://")) return null;
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.startsWith(GEDCOM_ADMIN_URL_PREFIX)) return null;
  const tail = p.slice(GEDCOM_ADMIN_URL_PREFIX.length);
  const segments = tail.split("/").filter(Boolean);
  return resolveGedcomAdminDiskPath(segments);
}

/** Safe filename for a zip entry under `media/` (no path segments). */
export function zipEntryNameForMedia(index: number, fileRef: string, xref: string): string {
  const base = path.basename(fileRef.trim()) || "file";
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  const n = String(index + 1).padStart(4, "0");
  const x = (xref || "").replace(/@/g, "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 24);
  return x ? `${n}-${x}-${safe}` : `${n}-${safe}`;
}
