import { unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ backup: { ...backup, fileSize: backup.fileSize?.toString() ?? null } });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { id } = await ctx.params;

  const backup = await prisma.backup.findUnique({ where: { id }, select: { filePath: true } });
  if (!backup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (backup.filePath) {
    await unlink(backup.filePath).catch(() => {});
  }
  await prisma.backup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
