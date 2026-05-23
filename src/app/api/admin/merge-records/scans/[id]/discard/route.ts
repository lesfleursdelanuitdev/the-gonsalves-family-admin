import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

/** POST /api/admin/merge-records/scans/[id]/discard */
export const POST = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const scan = await prisma.internalDuplicateScan.findFirst({ where: { id, fileUuid } });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (scan.status !== "pending") return NextResponse.json({ error: "Only pending scans can be discarded" }, { status: 409 });

  await prisma.internalDuplicateScan.update({ where: { id }, data: { status: "discarded" } });
  return NextResponse.json({ ok: true });
});
