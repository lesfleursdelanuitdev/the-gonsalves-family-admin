import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { guessContentType, resolveSiteMediaDiskPath } from "@/lib/admin/media-upload-storage";

function normalizePathSegments(pathParam: string | string[] | undefined): string[] {
  if (pathParam == null) return [];
  return Array.isArray(pathParam) ? pathParam : [pathParam];
}

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string | string[] }> }) {
  const { path: raw } = await ctx.params;
  const segments = normalizePathSegments(raw);
  const diskPath = resolveSiteMediaDiskPath(segments);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const st = await stat(diskPath);
    if (!st.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const basename = segments[segments.length - 1] ?? "file";
  const contentType = guessContentType(basename);
  const stream = createReadStream(diskPath);

  return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
