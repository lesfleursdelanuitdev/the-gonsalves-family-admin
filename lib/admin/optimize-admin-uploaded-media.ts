import { spawn } from "node:child_process";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type { AdminMediaStoreCategory } from "@/lib/admin/media-upload-storage";
import { adminMediaUploadsParentDir, guessContentType } from "@/lib/admin/media-upload-storage";

/** Served under `gedcom-admin/<category>/originals/` — keeps uploaded bytes when we produce a derivative. */
export const ADMIN_MEDIA_ORIGINALS_SUBDIR = "originals";

const IMAGE_MAX_EDGE = 2560;
const IMAGE_JPEG_QUALITY = 82;
const IMAGE_WEBP_QUALITY = 86;
/** Re-encode raster images larger than this (bytes) even if format is already web-friendly. */
const IMAGE_ALWAYS_OPTIMIZE_IF_LARGER_THAN_BYTES = 1_800_000;
const VIDEO_FFMPEG_TIMEOUT_MS = 900_000;
const VIDEO_MAX_WIDTH = 1920;
const VIDEO_CRF = "28";

const UUID_FILENAME_PREFIX =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_/i;

function extractLeadingUuid(filename: string): string | null {
  const m = UUID_FILENAME_PREFIX.exec(filename);
  return m?.[1] ?? null;
}

function stemFromUploadFilename(filename: string): string {
  const id = extractLeadingUuid(filename);
  const rest = id ? filename.slice(id.length + 1) : filename;
  return path.parse(rest).name || "image";
}

/** Build `/uploads/.../basename` from the on-disk category directory (gedcom-admin, site-media, user-media/…). */
function fileRefForPublicMediaDir(publicDir: string, basename: string): string {
  const base = path.resolve(adminMediaUploadsParentDir());
  const dir = path.resolve(publicDir);
  const rel = path.relative(base, dir);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Could not derive upload URL path from publicDir (${publicDir}) relative to uploads root.`);
  }
  const parts = ["uploads", ...rel.split(path.sep).filter(Boolean)];
  return `/${parts.join("/")}/${basename}`;
}

function extLower(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function isRasterImageExtension(ext: string): boolean {
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".avif", ".heic", ".heif"].includes(
    ext,
  );
}

function shouldTranscodeVideo(mime: string, ext: string, sizeBytes: number): boolean {
  const m = mime.toLowerCase();
  const e = extLower(ext);
  if (!m.startsWith("video/") && e !== ".mov" && e !== ".qt") return false;
  const nonMp4 = [".mov", ".webm", ".mkv", ".avi", ".mpeg", ".mpg", ".3gp", ".3g2", ".m4v", ".qt"];
  if (nonMp4.includes(e)) return true;
  if (m === "video/quicktime") return true;
  if (e === ".mp4" && sizeBytes >= 12_000_000) return true;
  return false;
}

function shouldOptimizeRasterImage(mime: string, ext: string, sizeBytes: number): boolean {
  const m = mime.toLowerCase();
  const e = extLower(ext);
  if (m === "image/svg+xml" || e === ".svg") return false;
  if (!m.startsWith("image/") && !isRasterImageExtension(e)) return false;
  if (e === ".heic" || e === ".heif" || m.includes("heic") || m.includes("heif")) return true;
  if (e === ".tif" || e === ".tiff" || e === ".bmp" || e === ".avif") return true;
  if (sizeBytes >= IMAGE_ALWAYS_OPTIMIZE_IF_LARGER_THAN_BYTES) return true;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(e);
}

async function imageNeedsResizeForDimensions(src: string): Promise<boolean> {
  try {
    const meta = await sharp(src).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    return w > IMAGE_MAX_EDGE || h > IMAGE_MAX_EDGE;
  } catch {
    return true;
  }
}

async function writeOptimizedRasterToFile(
  src: string,
  dest: string,
): Promise<{ mime: string; form: string }> {
  const meta = await sharp(src).metadata();
  const useWebp = Boolean(meta.hasAlpha);
  const img = sharp(src).rotate().resize({
    width: IMAGE_MAX_EDGE,
    height: IMAGE_MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (useWebp) {
    await img.webp({ quality: IMAGE_WEBP_QUALITY }).toFile(dest);
    return { mime: "image/webp", form: "webp" };
  }
  await img.jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true }).toFile(dest);
  return { mime: "image/jpeg", form: "jpeg" };
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    const t = setTimeout(() => {
      ff.kill("SIGKILL");
      reject(new Error("ffmpeg exceeded timeout"));
    }, timeoutMs);
    ff.on("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
    ff.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function transcodeVideoToMp4(src: string, dest: string): Promise<void> {
  const scale = `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`;
  const argsWithAudio: string[] = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    src,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    VIDEO_CRF,
    "-vf",
    scale,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    dest,
  ];
  try {
    await runFfmpeg(argsWithAudio, VIDEO_FFMPEG_TIMEOUT_MS);
  } catch {
    const argsNoAudio = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      src,
      "-map",
      "0:v:0",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      VIDEO_CRF,
      "-vf",
      scale,
      "-an",
      "-movflags",
      "+faststart",
      dest,
    ];
    await runFfmpeg(argsNoAudio, VIDEO_FFMPEG_TIMEOUT_MS);
  }
}

export type PostProcessAdminMediaUploadResult = {
  diskPath: string;
  fileRef: string;
  size: number;
  mimeType: string;
  suggestedForm: string | null;
};

/**
 * After a multipart upload is fully written to `diskPath`, optionally move the upload to
 * `originals/` and replace the main file with a smaller web-friendly derivative (JPEG/WebP or MP4).
 */
export async function postProcessAdminMediaUpload(args: {
  diskPath: string;
  filename: string;
  mimeType: string;
  publicDir: string;
  category: AdminMediaStoreCategory;
}): Promise<PostProcessAdminMediaUploadResult | { error: string }> {
  const { diskPath, filename, mimeType, publicDir, category } = args;
  const ext = extLower(filename);
  const st = await stat(diskPath);
  const sizeBytes = st.size;

  if (category === "images") {
    const mime = mimeType.toLowerCase().trim() || guessContentType(filename).toLowerCase();
    if (!shouldOptimizeRasterImage(mime, ext, sizeBytes)) {
      const needsDim = await imageNeedsResizeForDimensions(diskPath).catch(() => false);
      if (!needsDim && sizeBytes < IMAGE_ALWAYS_OPTIMIZE_IF_LARGER_THAN_BYTES) {
        return {
          diskPath,
          fileRef: fileRefForPublicMediaDir(publicDir, filename),
          size: sizeBytes,
          mimeType: mimeType.trim() || guessContentType(filename),
          suggestedForm: mime.split("/")[1] ?? "jpeg",
        };
      }
    }

    const id = extractLeadingUuid(filename);
    if (!id) {
      return { error: "Internal upload name must start with a UUID prefix." };
    }
    const stem = stemFromUploadFilename(filename);
    const originalsDir = path.join(publicDir, ADMIN_MEDIA_ORIGINALS_SUBDIR);
    await mkdir(originalsDir, { recursive: true });
    const originalDest = path.join(originalsDir, filename);

    const tmpOptimized = path.join(publicDir, `${filename}.opt.tmp`);
    try {
      const { mime, form } = await writeOptimizedRasterToFile(diskPath, tmpOptimized);
      const outBasename = `${id}_${stem}.${form}`;
      const finalPath = path.join(publicDir, outBasename);
      await rename(diskPath, originalDest);
      try {
        await rename(tmpOptimized, finalPath);
      } catch (e2) {
        await rename(originalDest, diskPath).catch(() => {});
        await unlink(tmpOptimized).catch(() => {});
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        return { error: `Image optimization failed (${msg2}).` };
      }
      const outSt = await stat(finalPath);
      return {
        diskPath: finalPath,
        fileRef: fileRefForPublicMediaDir(publicDir, outBasename),
        size: outSt.size,
        mimeType: mime,
        suggestedForm: form,
      };
    } catch (e) {
      await unlink(tmpOptimized).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      return {
        error: `Image optimization failed (${msg}). For HEIC, ensure sharp/libvips was built with HEIF support.`,
      };
    }
  }

  if (category === "videos") {
    const mime = mimeType.toLowerCase().trim() || guessContentType(filename).toLowerCase();
    if (!shouldTranscodeVideo(mime, ext, sizeBytes)) {
      return {
        diskPath,
        fileRef: fileRefForPublicMediaDir(publicDir, filename),
        size: sizeBytes,
        mimeType: mimeType.trim() || guessContentType(filename),
        suggestedForm: "video",
      };
    }

    const id = extractLeadingUuid(filename);
    if (!id) {
      return { error: "Internal upload name must start with a UUID prefix." };
    }
    const stem = stemFromUploadFilename(filename);
    const originalsDir = path.join(publicDir, ADMIN_MEDIA_ORIGINALS_SUBDIR);
    await mkdir(originalsDir, { recursive: true });
    const originalDest = path.join(originalsDir, filename);
    const tmpOut = path.join(publicDir, `${id}_${stem}.work.mp4`);
    const outBasename = `${id}_${stem}.mp4`;
    const finalPath = path.join(publicDir, outBasename);

    try {
      await transcodeVideoToMp4(diskPath, tmpOut);
      await rename(diskPath, originalDest);
      await rename(tmpOut, finalPath);
      const outSt = await stat(finalPath);
      return {
        diskPath: finalPath,
        fileRef: fileRefForPublicMediaDir(publicDir, outBasename),
        size: outSt.size,
        mimeType: "video/mp4",
        suggestedForm: "video",
      };
    } catch (e) {
      await unlink(tmpOut).catch(() => {});
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[media upload] video transcode skipped, keeping original:", msg);
      return {
        diskPath,
        fileRef: fileRefForPublicMediaDir(publicDir, filename),
        size: sizeBytes,
        mimeType: mimeType.trim() || guessContentType(filename),
        suggestedForm: "video",
      };
    }
  }

  return {
    diskPath,
    fileRef: fileRefForPublicMediaDir(publicDir, filename),
    size: sizeBytes,
    mimeType: mimeType.trim() || guessContentType(filename),
    suggestedForm: null,
  };
}

/**
 * Re-optimize a file already on disk (same layout as uploads). Used by maintenance scripts.
 * When `dryRun` is true, reports the planned action without writing.
 */
export async function optimizeExistingAdminMediaFile(args: {
  diskPath: string;
  category: AdminMediaStoreCategory;
  dryRun: boolean;
}): Promise<
  | { changed: false; reason: string }
  | { changed: true; newDiskPath: string; newFileRef: string; newForm: string | null; newSize: number; dryRun: true }
  | { changed: true; newDiskPath: string; newFileRef: string; newForm: string | null; newSize: number; dryRun: false }
> {
  const { diskPath, category, dryRun } = args;
  const filename = path.basename(diskPath);
  const publicDir = path.dirname(diskPath);
  const mimeType = guessContentType(filename);
  const st = await stat(diskPath);

  if (category === "images") {
    const ext = extLower(filename);
    const mime = mimeType.toLowerCase();
    if (!shouldOptimizeRasterImage(mime, ext, st.size)) {
      const needsDim = await imageNeedsResizeForDimensions(diskPath).catch(() => false);
      if (!needsDim && st.size < IMAGE_ALWAYS_OPTIMIZE_IF_LARGER_THAN_BYTES) {
        return { changed: false, reason: "Image already within size/dimension targets." };
      }
    }
  } else if (category === "videos") {
    const ext = extLower(filename);
    const mime = mimeType.toLowerCase();
    if (!shouldTranscodeVideo(mime, ext, st.size)) {
      return { changed: false, reason: "Video already MP4 within size threshold." };
    }
  } else {
    return { changed: false, reason: "Category not supported for optimization." };
  }

  if (dryRun) {
    const id = extractLeadingUuid(filename);
    if (!id) {
      return { changed: false, reason: "Filename must start with UUID_ for optimization." };
    }
    const stem = stemFromUploadFilename(filename);
    if (category === "images") {
      const meta = await sharp(diskPath).metadata();
      const form = meta.hasAlpha ? "webp" : "jpeg";
      const outBasename = `${id}_${stem}.${form}`;
      const newDiskPath = path.join(publicDir, outBasename);
      return {
        changed: true,
        newDiskPath,
        newFileRef: fileRefForPublicMediaDir(publicDir, outBasename),
        newForm: form,
        newSize: 0,
        dryRun: true,
      };
    }
    const outBasename = `${id}_${stem}.mp4`;
    const newDiskPath = path.join(publicDir, outBasename);
    return {
      changed: true,
      newDiskPath,
      newFileRef: fileRefForPublicMediaDir(publicDir, outBasename),
      newForm: "video",
      newSize: 0,
      dryRun: true,
    };
  }

  const done = await postProcessAdminMediaUpload({
    diskPath,
    filename,
    mimeType,
    publicDir,
    category,
  });
  if ("error" in done) {
    return { changed: false, reason: done.error };
  }

  return {
    changed: true,
    newDiskPath: done.diskPath,
    newFileRef: done.fileRef,
    newForm: done.suggestedForm,
    newSize: done.size,
    dryRun: false,
  };
}
