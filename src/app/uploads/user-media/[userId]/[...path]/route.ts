import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { guessContentType, resolveUserMediaDiskPath } from "@/lib/admin/media-upload-storage";
import { getCurrentUser } from "@/lib/infra/auth";

function normalizePathSegments(pathParam: string | string[] | undefined): string[] {
  if (pathParam == null) return [];
  return Array.isArray(pathParam) ? pathParam : [pathParam];
}

/**
 * Serves bytes for `/uploads/user-media/<userId>/…` only when the requester is that user
 * (same session as admin). Prevents guessing another account’s UUID prefix to read files.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string; path?: string | string[] }> }) {
  const { userId, path: raw } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const segments = normalizePathSegments(raw);
  const diskPath = resolveUserMediaDiskPath(userId, segments);
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
      "Cache-Control": "private, max-age=3600",
    },
  });
}
