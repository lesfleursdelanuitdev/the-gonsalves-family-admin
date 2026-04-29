import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { resolveGedcomAdminDiskPath } from "@/lib/admin/media-upload-storage";

/**
 * On-demand thumbnail endpoint for media list views.
 *
 * - Accepts the same path layout as `/uploads/gedcom-admin/[...path]` so callers can derive a
 *   thumb URL from a `fileRef` by replacing the prefix.
 * - `?w=<width>` selects the long-edge target (clamped). `?fmt=` reserved for future use.
 * - Encoded result is cached on disk under `<dir>/.thumbs/<basename>_w<w>.jpg`. Re-emits when the
 *   source file mtime is newer than the cache (so re-uploads invalidate cleanly).
 * - Falls through to the original via 302 if Sharp can't decode the source (e.g. exotic formats).
 *
 * Auth: this endpoint is intentionally readable without admin auth so `<img>` tags can use it.
 * The path is constrained by `resolveGedcomAdminDiskPath`, which only resolves files the public
 * `/uploads/...` route already serves; no new exposure is introduced.
 */

const ALLOWED_WIDTHS = [120, 240, 360, 480, 720, 960, 1280] as const;
const DEFAULT_WIDTH = 480;
const THUMBS_SUBDIR = ".thumbs";
const THUMB_QUALITY = 78;

function pickWidth(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  let chosen: number = ALLOWED_WIDTHS[0];
  for (const candidate of ALLOWED_WIDTHS) {
    if (candidate <= n) chosen = candidate;
  }
  if (n >= ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]) {
    chosen = ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
  }
  return chosen;
}

function normalizePathSegments(pathParam: string | string[] | undefined): string[] {
  if (pathParam == null) return [];
  return Array.isArray(pathParam) ? pathParam : [pathParam];
}

function thumbCachePath(sourceDiskPath: string, width: number): string {
  const dir = path.dirname(sourceDiskPath);
  const base = path.basename(sourceDiskPath, path.extname(sourceDiskPath));
  return path.join(dir, THUMBS_SUBDIR, `${base}_w${width}.jpg`);
}

async function streamFile(diskPath: string): Promise<NextResponse> {
  const stream = createReadStream(diskPath);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path?: string | string[] }> },
) {
  const { path: raw } = await ctx.params;
  const segments = normalizePathSegments(raw);
  const sourceDiskPath = resolveGedcomAdminDiskPath(segments);
  if (!sourceDiskPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let sourceStat;
  try {
    sourceStat = await stat(sourceDiskPath);
    if (!sourceStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const width = pickWidth(url.searchParams.get("w"));
  const cachePath = thumbCachePath(sourceDiskPath, width);

  try {
    const cacheStat = await stat(cachePath);
    if (cacheStat.isFile() && cacheStat.mtimeMs >= sourceStat.mtimeMs) {
      return await streamFile(cachePath);
    }
  } catch {
    // Cache miss; fall through to generation.
  }

  try {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await sharp(sourceDiskPath)
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
      .toFile(cachePath);
    return await streamFile(cachePath);
  } catch (err) {
    console.warn("[media thumb] generation failed, falling back to original:", err);
    const fallbackUrl = new URL(`/uploads/gedcom-admin/${segments.join("/")}`, url.origin);
    return NextResponse.redirect(fallbackUrl, 302);
  }
}
