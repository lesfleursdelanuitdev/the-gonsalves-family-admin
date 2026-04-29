import path from "node:path";

import { normalizeSiteMediaPath } from "@/lib/admin/normalize-site-media-path";

/**
 * Parent directory for the `gedcom-admin` upload folder (matches URL `/uploads/gedcom-admin/...`).
 *
 * - **Development** (non-production): default `{cwd}/public/uploads` unless `ADMIN_MEDIA_FILES_ROOT` is set.
 * - **Production** (`NODE_ENV === "production"`): uploads must live under **`/mnt/`**:
 *   - If `ADMIN_MEDIA_FILES_ROOT` is set, it must resolve to a path starting with `/mnt/`.
 *   - If unset, defaults to `/mnt/storage/uploads` so deploys never silently write into the repo tree.
 *
 * New uploads are placed under `gedcom-admin/images|documents|audio|videos/`; legacy files may still sit
 * directly under `gedcom-admin/` (single path segment in the URL).
 */
const PRODUCTION_DEFAULT_UPLOADS_PARENT = "/mnt/storage/uploads";

export function adminMediaUploadsParentDir(): string {
  const fromEnv = process.env.ADMIN_MEDIA_FILES_ROOT?.trim();
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (process.env.NODE_ENV === "production" && !resolved.startsWith("/mnt/")) {
      throw new Error(
        `ADMIN_MEDIA_FILES_ROOT must resolve under /mnt/ in production (got: ${resolved}). Example: /mnt/storage/uploads`,
      );
    }
    return resolved;
  }
  if (process.env.NODE_ENV === "production") {
    return path.resolve(PRODUCTION_DEFAULT_UPLOADS_PARENT);
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function adminMediaGedcomAdminDir(): string {
  return path.join(adminMediaUploadsParentDir(), "gedcom-admin");
}

/** URL path prefix (no trailing slash on base segment). */
export const ADMIN_MEDIA_URL_PREFIX = "/uploads/gedcom-admin";

export { normalizeSiteMediaPath };

/** Coerce API JSON `file_ref` to a normalized DB string or null. */
export function normalizeStoredMediaFileRef(fileRef: unknown): string | null {
  if (fileRef == null) return null;
  if (typeof fileRef !== "string") return null;
  const n = normalizeSiteMediaPath(fileRef).trim();
  return n === "" ? null : n;
}

/** Subdirectory names for new uploads (matches on-disk layout under `gedcom-admin/`). */
export const ADMIN_MEDIA_STORE_CATEGORIES = ["images", "documents", "audio", "videos"] as const;
export type AdminMediaStoreCategory = (typeof ADMIN_MEDIA_STORE_CATEGORIES)[number];

export function isAdminMediaStoreCategory(s: string): s is AdminMediaStoreCategory {
  return (ADMIN_MEDIA_STORE_CATEGORIES as readonly string[]).includes(s);
}

/** Pick a store folder from the client-provided MIME type (upload route). */
export function adminMediaStoreCategoryFromMime(mime: string): AdminMediaStoreCategory {
  const m = mime.toLowerCase().trim();
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "videos";
  return "documents";
}

/**
 * Category for an on-disk filename (migration + upload fallbacks). Uses extension → Content-Type → category.
 */
export function adminMediaStoreCategoryFromFilename(filename: string): AdminMediaStoreCategory {
  return adminMediaStoreCategoryFromMime(guessContentType(filename));
}

export function isSafeGedcomAdminFilename(name: string): boolean {
  if (!name || name.length > 300) return false;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
  return /^[\w.\-+() ]+$/.test(name);
}

export function resolveGedcomAdminDiskPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (!isSafeGedcomAdminFilename(seg)) return null;
  }
  if (segments.length === 1) {
    return path.join(adminMediaGedcomAdminDir(), segments[0]!);
  }
  if (segments.length === 2) {
    const [category, filename] = segments;
    if (!category || !filename || !isAdminMediaStoreCategory(category)) return null;
    return path.join(adminMediaGedcomAdminDir(), category, filename);
  }
  if (segments.length === 3) {
    const [category, originals, filename] = segments;
    if (originals !== "originals") return null;
    if (!category || !filename || !isAdminMediaStoreCategory(category)) return null;
    return path.join(adminMediaGedcomAdminDir(), category, originals, filename);
  }
  return null;
}

export function guessContentType(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".avif")) return "image/avif";
  if (n.endsWith(".bmp")) return "image/bmp";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov") || n.endsWith(".qt")) return "video/quicktime";
  if (n.endsWith(".3gp") || n.endsWith(".3g2")) return "video/3gpp";
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".ogg") || n.endsWith(".oga")) return "audio/ogg";
  if (n.endsWith(".m4a") || n.endsWith(".aac")) return "audio/mp4";
  if (n.endsWith(".flac")) return "audio/flac";
  if (n.endsWith(".opus")) return "audio/opus";
  return "application/octet-stream";
}
