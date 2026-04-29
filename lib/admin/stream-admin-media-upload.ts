import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, type Readable as NodeReadable } from "node:stream";
import busboy from "busboy";

import {
  adminMediaGedcomAdminDir,
  adminMediaStoreCategoryFromMime,
} from "@/lib/admin/media-upload-storage";
import { postProcessAdminMediaUpload } from "@/lib/admin/optimize-admin-uploaded-media";

export type StreamAdminMediaUploadSuccess = {
  fileRef: string;
  originalName: string;
  size: number;
  mimeType: string | null;
  suggestedForm: string | null;
};

export type StreamAdminMediaUploadError = {
  status: number;
  error: string;
};

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

function headersForBusboy(headers: Headers): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    const prev = out[k];
    if (prev === undefined) {
      out[k] = value;
    } else if (Array.isArray(prev)) {
      prev.push(value);
    } else {
      out[k] = [prev, value];
    }
  });
  return out;
}

async function saveUploadStreamToDisk(
  fileStream: NodeReadable & { truncated?: boolean },
  info: { filename?: string; mimeType?: string },
  maxBytes: number,
): Promise<StreamAdminMediaUploadSuccess | StreamAdminMediaUploadError> {
  const mimeType = (info.mimeType || "application/octet-stream").trim() || "application/octet-stream";
  const originalName = info.filename?.trim() || "upload.bin";

  let truncated = false;
  fileStream.on("limit", () => {
    truncated = true;
  });

  const safe = sanitizeBasename(originalName);
  const id = randomUUID();
  const category = adminMediaStoreCategoryFromMime(mimeType);
  const filename = `${id}_${safe}`;
  const gedcomDir = adminMediaGedcomAdminDir();
  const publicDir = path.join(gedcomDir, category);
  await mkdir(publicDir, { recursive: true });
  const diskPath = path.join(publicDir, filename);
  const writeStream = createWriteStream(diskPath);

  try {
    await pipeline(fileStream, writeStream);
  } catch (e) {
    await unlink(diskPath).catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[media upload] pipeline failed:", diskPath, msg);
    return {
      status: 500,
      error: `Could not save file (${msg}). Check disk space and permissions on the upload directory.`,
    };
  }

  if (truncated || fileStream.truncated) {
    await unlink(diskPath).catch(() => {});
    const maxMbStr = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
    return {
      status: 413,
      error: `File too large (max ${maxMbStr} MB). Set ADMIN_MEDIA_UPLOAD_MAX_BYTES to raise the limit.`,
    };
  }

  let size: number;
  try {
    const st = await stat(diskPath);
    size = st.size;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, error: `Could not stat saved file (${msg}).` };
  }

  if (size <= 0) {
    await unlink(diskPath).catch(() => {});
    return { status: 400, error: "Empty file" };
  }

  const relativeDir = path.join("uploads", "gedcom-admin", category);
  let fileRef = `/${relativeDir.replace(/\\/g, "/")}/${filename}`;
  let outMime = info.mimeType?.trim() ? info.mimeType : null;
  let suggestedForm = mimeToForm(mimeType);
  let outSize = size;

  if (category === "images" || category === "videos") {
    const processed = await postProcessAdminMediaUpload({
      diskPath,
      filename,
      mimeType,
      publicDir,
      category,
    });
    if ("error" in processed) {
      await unlink(diskPath).catch(() => {});
      return { status: 500, error: processed.error };
    }
    fileRef = processed.fileRef;
    outSize = processed.size;
    outMime = processed.mimeType;
    suggestedForm = processed.suggestedForm ?? suggestedForm;
  }

  return {
    fileRef,
    originalName,
    size: outSize,
    mimeType: outMime,
    suggestedForm,
  };
}

/**
 * Parse multipart `file` from a Web {@link Request} and stream bytes to disk (no full-body buffer).
 */
export function streamAdminMediaUpload(
  request: Request,
  maxBytes: number,
): Promise<StreamAdminMediaUploadSuccess | StreamAdminMediaUploadError> {
  return new Promise((resolve) => {
    let settled = false;
    const resolveOnce = (r: StreamAdminMediaUploadSuccess | StreamAdminMediaUploadError) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
      resolveOnce({ status: 400, error: "Expected multipart/form-data" });
      return;
    }

    const body = request.body;
    if (!body) {
      resolveOnce({ status: 400, error: "Missing request body" });
      return;
    }

    let fileWork: Promise<StreamAdminMediaUploadSuccess | StreamAdminMediaUploadError> | null = null;

    const bb = busboy({
      headers: headersForBusboy(request.headers),
      defParamCharset: "utf8",
      limits: {
        fileSize: maxBytes,
        files: 4,
        fields: 32,
        parts: 40,
      },
    });

    bb.on("file", (name, stream, info) => {
      if (name !== "file") {
        stream.resume();
        return;
      }
      if (fileWork) {
        stream.resume();
        return;
      }
      fileWork = saveUploadStreamToDisk(stream, info, maxBytes);
    });

    bb.on("error", (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      resolveOnce({ status: 400, error: msg });
    });

    bb.on("close", () => {
      void (async () => {
        if (!fileWork) {
          resolveOnce({ status: 400, error: "Missing file field" });
          return;
        }
        resolveOnce(await fileWork);
      })();
    });

    const nodeIn = Readable.fromWeb(
      body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    );
    nodeIn.on("error", (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      resolveOnce({ status: 400, error: msg });
    });
    nodeIn.pipe(bb);
  });
}
