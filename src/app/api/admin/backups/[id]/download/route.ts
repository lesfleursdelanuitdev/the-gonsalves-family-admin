import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const { id } = await ctx.params;

  const backup = await prisma.backup.findUnique({
    where: { id },
    select: { status: true, filePath: true },
  });

  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (backup.status !== "COMPLETE" || !backup.filePath) {
    return NextResponse.json({ error: "Backup is not ready for download." }, { status: 409 });
  }

  let fileSize: number;
  try {
    const s = await stat(backup.filePath);
    fileSize = s.size;
  } catch {
    return NextResponse.json({ error: "Backup file not found on disk." }, { status: 404 });
  }

  const filename = backup.filePath.split("/").pop() ?? "backup.zip";
  const nodeStream = createReadStream(backup.filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(fileSize),
      "Cache-Control": "no-store",
    },
  });
});
