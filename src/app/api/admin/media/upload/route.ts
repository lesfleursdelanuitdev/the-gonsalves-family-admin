import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import {
  adminMediaGedcomAdminDir,
  adminMediaStoreCategoryFromMime,
} from "@/lib/admin/media-upload-storage";

function sanitizeBasename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-()+ ]/g, "_");
  return base.slice(0, 200) || "upload.bin";
}

function mimeToForm(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return m.split("/")[1] ?? "jpeg";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("audio/")) return m.split("/")[1] ?? "audio";
  return null;
}

/**
 * POST multipart/form-data with field `file` — stores under
 * `{ADMIN_MEDIA_FILES_ROOT or public/uploads}/gedcom-admin/{images|documents|audio}/`
 * and returns a site-relative path suitable for GedcomMedia.file_ref.
 */
export const POST = withAdminAuth(async (request) => {
  const formData = await request.formData();
  const entry = formData.get("file");
  if (!entry || typeof entry === "string") {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const file = entry as File;
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const maxBytes = 80 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large (max 80MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safe = sanitizeBasename(file.name);
  const id = randomUUID();
  const category = adminMediaStoreCategoryFromMime(file.type || "application/octet-stream");
  const filename = `${id}_${safe}`;
  const gedcomDir = adminMediaGedcomAdminDir();
  const publicDir = path.join(gedcomDir, category);
  await mkdir(publicDir, { recursive: true });
  const diskPath = path.join(publicDir, filename);
  const relativeDir = path.join("uploads", "gedcom-admin", category);
  try {
    await writeFile(diskPath, buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[media upload] writeFile failed:", diskPath, msg);
    return NextResponse.json(
      { error: `Could not save file (${msg}). Check disk space and permissions on the upload directory.` },
      { status: 500 },
    );
  }

  const fileRef = `/${relativeDir.replace(/\\/g, "/")}/${filename}`;
  const suggestedForm = mimeToForm(file.type || "application/octet-stream");

  return NextResponse.json({
    fileRef,
    originalName: file.name,
    size: file.size,
    mimeType: file.type || null,
    suggestedForm,
  });
});
