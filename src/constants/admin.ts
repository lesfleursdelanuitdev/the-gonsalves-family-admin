/**
 * Max records returned by admin list APIs when loading "all" data (single request, no pagination).
 * Used by admin list pages so the UI fetches the full dataset in one request.
 */
export const ADMIN_LIST_MAX_LIMIT = 10_000;

/**
 * Default max bytes per file for `POST /api/admin/media/upload`.
 * Override at runtime with `ADMIN_MEDIA_UPLOAD_MAX_BYTES` (integer, bytes).
 */
/** Default ~2 GiB for streamed uploads (video-friendly); override with `ADMIN_MEDIA_UPLOAD_MAX_BYTES`. */
export const ADMIN_MEDIA_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** Whole megabytes for UI copy (matches {@link ADMIN_MEDIA_UPLOAD_MAX_BYTES} unless the constant changes). */
export function adminMediaUploadMaxMbForUi(): number {
  return Math.round(ADMIN_MEDIA_UPLOAD_MAX_BYTES / (1024 * 1024));
}

/** Client-side pagination on the admin individual detail page */
export const INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE = 5;
export const INDIVIDUAL_DETAIL_FAMILY_CHILDREN_PAGE_SIZE = 5;

/** Client-side pagination on the admin family detail page */
export const FAMILY_DETAIL_EVENTS_PAGE_SIZE = 5;
export const FAMILY_DETAIL_CHILDREN_PAGE_SIZE = 5;
