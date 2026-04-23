/**
 * Client-side helpers for showing GEDCOM media as raster previews via next/image
 * (display size only — no generated thumbnail files).
 */

import { normalizeSiteMediaPath } from "@/lib/admin/normalize-site-media-path";

export { normalizeSiteMediaPath };

/** Whether we should treat this media as a previewable raster image. */
const VIDEO_FILE_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i;

/**
 * Whether this media is probably video (GEDCOM form and/or common video extensions).
 * Used for inline `<video>` and grid “peek” frames (no generated poster files).
 */
export function isLikelyVideoFile(fileRef: string, formStr: string | null | undefined): boolean {
  const fm = (formStr ?? "").toLowerCase();
  if (fm.includes("video") || fm === "video") return true;
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  return VIDEO_FILE_EXT.test(f);
}

/** Paths the admin app can load in a `<video src>` (same-origin uploads or absolute http(s)). */
export function isPlayableVideoRef(fileRef: string): boolean {
  const t = normalizeSiteMediaPath(fileRef).trim();
  if (!t) return false;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  return t.startsWith("/uploads/");
}

export function isLikelyRasterImage(
  fileRef: string,
  formStr: string,
  mimeHint: string | null,
): boolean {
  if (mimeHint && mimeHint.startsWith("image/") && !mimeHint.includes("svg")) return true;
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(f)) return true;
  const fm = (formStr || "").toLowerCase();
  if (/\b(jpe?g|png|gif|webp|avif|bmp)\b/.test(fm)) return true;
  return false;
}

/** `src` for next/image when file_ref is already an absolute site path or http(s) URL. */
export function resolveMediaImageSrc(fileRef: string): string | null {
  const t = normalizeSiteMediaPath(fileRef.trim());
  if (!t) return null;
  if (t.startsWith("/") || t.startsWith("http://") || t.startsWith("https://")) return t;
  return null;
}

export function mediaImageUnoptimized(src: string): boolean {
  if (src.startsWith("http://") || src.startsWith("https://")) return true;
  // User uploads under /uploads/ — bypass the image optimizer so previews work behind nginx/PM2
  // (the optimizer’s internal fetch often misbehaves for same-origin files in production).
  if (src.startsWith("/uploads/")) return true;
  return false;
}
