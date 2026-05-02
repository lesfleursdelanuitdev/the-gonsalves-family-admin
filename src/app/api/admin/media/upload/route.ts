import { NextResponse } from "next/server";
import { ADMIN_MEDIA_UPLOAD_MAX_BYTES } from "@/constants/admin";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { streamAdminMediaUpload } from "@/lib/admin/stream-admin-media-upload";

export const runtime = "nodejs";

function resolveAdminMediaUploadMaxBytes(): number {
  const raw = process.env.ADMIN_MEDIA_UPLOAD_MAX_BYTES?.trim();
  if (!raw) return ADMIN_MEDIA_UPLOAD_MAX_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_048_576) {
    return ADMIN_MEDIA_UPLOAD_MAX_BYTES;
  }
  return parsed;
}

/**
 * POST multipart/form-data with field `file` — streams to disk.
 *
 * Query `scope`:
 * - omitted / `family-tree` → `gedcom-admin/…` (GEDCOM-exportable tree media)
 * - `site-assets` → `site-media/…`
 * - `my-media` → `user-media/<your-user-id>/…`
 */
export const POST = withAdminAuth(async (request, user) => {
  const maxBytes = resolveAdminMediaUploadMaxBytes();
  const scope = request.nextUrl.searchParams.get("scope")?.trim();
  const target =
    scope === "site-assets" ? ("site" as const) : scope === "my-media" ? ("user" as const) : ("gedcom" as const);
  const result = await streamAdminMediaUpload(request, maxBytes, {
    target,
    userId: target === "user" ? user.id : undefined,
  });

  if (!("fileRef" in result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    fileRef: result.fileRef,
    storageKey: result.fileRef,
    originalName: result.originalName,
    size: result.size,
    mimeType: result.mimeType,
    suggestedForm: result.suggestedForm,
  });
});
