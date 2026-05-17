import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const POST = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const row = await prisma.pendingGedcomImport.findFirst({ where: { id, fileUuid } });
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (row.status === "applied") {
    return NextResponse.json({ error: "Cannot discard an applied import" }, { status: 409 });
  }
  const updated = await prisma.pendingGedcomImport.update({
    where: { id: row.id },
    data: { status: "discarded", discardedAt: new Date() },
  });
  return NextResponse.json({ import: updated });
});
