import { isLikelyAudioFile, isLikelyVideoFile } from "@/lib/admin/mediaPreview";

/** UI / API bucket for media list filtering and badges (aligned with `admin-media-filter` SQL). */
export type AdminMediaCategory = "photo" | "document" | "video" | "audio";

/**
 * Classify a media row for admin UI and `mediaCategory` query param.
 * Order: video → document → audio → default photo.
 */
export function inferAdminMediaCategory(
  form: string | null | undefined,
  fileRef: string | null | undefined,
): AdminMediaCategory {
  const ref = (fileRef ?? "").trim();
  const fm = (form ?? "").toLowerCase();
  if (isLikelyVideoFile(ref, form ?? null)) return "video";
  if (fm.includes("doc") || fm === "document") return "document";
  if (isLikelyAudioFile(ref, form ?? null)) return "audio";
  return "photo";
}
