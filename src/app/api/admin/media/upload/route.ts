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
 * POST multipart/form-data with field `file` — streams to disk under
 * `{ADMIN_MEDIA_FILES_ROOT | production /mnt default | dev public/uploads}/gedcom-admin/{images|documents|audio|videos}/`
 * and returns a site-relative path suitable for GedcomMedia.file_ref.
 */
export const POST = withAdminAuth(async (request) => {
  const maxBytes = resolveAdminMediaUploadMaxBytes();
  const result = await streamAdminMediaUpload(request, maxBytes);

  if (!("fileRef" in result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    fileRef: result.fileRef,
    originalName: result.originalName,
    size: result.size,
    mimeType: result.mimeType,
    suggestedForm: result.suggestedForm,
  });
});
