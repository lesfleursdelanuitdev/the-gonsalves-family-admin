/**
 * Client-side helpers for showing GEDCOM media as raster previews via next/image
 * (display size only — no generated thumbnail files).
 */

import { normalizeSiteMediaPath } from "@/lib/admin/normalize-site-media-path";

export { normalizeSiteMediaPath };

/** Whether we should treat this media as a previewable raster image. */
const VIDEO_FILE_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv|mpg|mpeg|3gp|3g2)(\?|#|$)/i;
const AUDIO_FILE_EXT = /\.(mp3|m4a|wav|ogg|oga|aac|flac|opus)(\?|#|$)/i;

/**
 * Whether this media is probably video (GEDCOM form and/or common video extensions).
 * Used for inline `<video>` and grid “peek” frames (no generated poster files).
 */
export function isLikelyVideoFile(fileRef: string, formStr: string | null | undefined): boolean {
  const fm = (formStr ?? "").toLowerCase();
  if (fm.includes("video") || fm === "video") return true;
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  if (f.includes("/gedcom-admin/videos/")) return true;
  return VIDEO_FILE_EXT.test(f);
}

const AUDIO_FORM_HINTS = new Set([
  "mp3",
  "mpeg",
  "wav",
  "ogg",
  "oga",
  "aac",
  "m4a",
  "flac",
  "opus",
  "x-m4a",
  "mp4a", // audio/mp4
]);

/**
 * Whether this media is probably audio (GEDCOM `form`, MIME-ish hints, path, or common extensions).
 * Kept in sync with list SQL in `admin-media-filter.ts`.
 */
export function isLikelyAudioFile(fileRef: string, formStr: string | null | undefined): boolean {
  const fm = (formStr ?? "").toLowerCase().trim();
  if (fm.startsWith("audio/")) return true;
  if (fm.includes("audio")) return true;
  if (AUDIO_FORM_HINTS.has(fm)) return true;
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  if (f.includes("/gedcom-admin/audio/")) return true;
  return AUDIO_FILE_EXT.test(f);
}

/** Paths the admin app can load in a `<video src>` (same-origin uploads or absolute http(s)). */
export function isPlayableVideoRef(fileRef: string): boolean {
  const t = normalizeSiteMediaPath(fileRef).trim();
  if (!t) return false;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  return t.startsWith("/uploads/");
}

/** Paths the admin app can load in an `<audio src>` (same-origin uploads or absolute http(s)). */
export function isPlayableAudioRef(fileRef: string): boolean {
  return isPlayableVideoRef(fileRef);
}

export function isLikelyRasterImage(
  fileRef: string,
  formStr: string,
  mimeHint: string | null,
): boolean {
  if (mimeHint && mimeHint.startsWith("image/") && !mimeHint.includes("svg")) return true;
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|bmp|heic|heif)(\?|$)/i.test(f)) return true;
  const fm = (formStr || "").toLowerCase();
  if (/\b(jpe?g|png|gif|webp|avif|bmp|heic|heif)\b/.test(fm)) return true;
  return false;
}

/**
 * iPhone (HEIC/HEIF) and some RAW-like rasters decode reliably in native `<img>` in Safari; Next/Image and
 * Chromium often omit HEIC support. Use a plain img for these paths so we at least match browser capability.
 */
export function preferNativeRasterImgPreview(fileRef: string, formStr: string | null | undefined): boolean {
  const f = normalizeSiteMediaPath(fileRef).trim().toLowerCase();
  if (/\.(heic|heif)(\?|#|$)/i.test(f)) return true;
  const fm = (formStr ?? "").toLowerCase();
  if (fm.includes("heic") || fm.includes("heif")) return true;
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
