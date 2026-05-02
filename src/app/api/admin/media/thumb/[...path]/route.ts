import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  resolveGedcomAdminDiskPath,
  resolveSiteMediaDiskPath,
  resolveUserMediaDiskPath,
} from "@/lib/admin/media-upload-storage";
import { getCurrentUser } from "@/lib/infra/auth";

/**
 * On-demand thumbnail endpoint for media list views.
 *
 * - **GEDCOM uploads:** path segments match `/uploads/gedcom-admin/[...path]` (category + file).
 * - **Site assets:** prefix `site-media/` then the same segment layout as `/uploads/site-media/...`.
 * - **User uploads:** prefix `user-media/<userId>/` then category + file (same layout as the
 *   authenticated `/uploads/user-media/...` route).
 * - `?w=<width>` selects the long-edge target (clamped). `?fmt=` reserved for future use.
 * - Encoded result is cached on disk under `<dir>/.thumbs/<basename>_w<w>.jpg`. Re-emits when the
 *   source file mtime is newer than the cache (so re-uploads invalidate cleanly).
 * - Falls through to the original via 302 if Sharp can't decode the source (e.g. exotic formats).
 *
 * Auth: gedcom-admin and site-media thumbs are readable without auth (same exposure model as using
 * the full image URL in `<img>`). **User-media** thumbs require a session whose user id matches the
 * `user-media/<userId>/` segment, mirroring `GET /uploads/user-media/...`.
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

function resolveThumbSourceDiskPath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  const [head, ...tail] = segments;
  if (head === "site-media") {
    return resolveSiteMediaDiskPath(tail);
  }
  if (head === "user-media") {
    const userId = tail[0];
    if (!userId) return null;
    return resolveUserMediaDiskPath(userId, tail.slice(1));
  }
  return resolveGedcomAdminDiskPath(segments);
}

function fallbackUploadsPath(segments: string[]): string {
  if (segments[0] === "site-media" || segments[0] === "user-media") {
    return `/uploads/${segments.join("/")}`;
  }
  return `/uploads/gedcom-admin/${segments.join("/")}`;
}

async function streamFile(diskPath: string, privateCache: boolean): Promise<NextResponse> {
  const stream = createReadStream(diskPath);
  const cacheControl = privateCache
    ? "private, max-age=3600"
    : "public, max-age=31536000, immutable";
  return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cacheControl,
    },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path?: string | string[] }> },
) {
  const { path: raw } = await ctx.params;
  const segments = normalizePathSegments(raw);
  const isUserMediaThumb = segments[0] === "user-media";
  if (isUserMediaThumb) {
    const pathUserId = segments[1];
    if (!pathUserId) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const user = await getCurrentUser();
    if (!user || user.id !== pathUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const sourceDiskPath = resolveThumbSourceDiskPath(segments);
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
      return await streamFile(cachePath, isUserMediaThumb);
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
    return await streamFile(cachePath, isUserMediaThumb);
  } catch (err) {
    console.warn("[media thumb] generation failed, falling back to original:", err);
    const fallbackUrl = new URL(fallbackUploadsPath(segments), url.origin);
    return NextResponse.redirect(fallbackUrl, 302);
  }
}
