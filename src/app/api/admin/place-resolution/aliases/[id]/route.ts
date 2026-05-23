import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

/** DELETE /api/admin/place-resolution/aliases/[id] */
export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const alias = await prisma.resolvedPlaceAlias.findUnique({
    where: { id },
    include: { resolvedPlace: { select: { fileUuid: true } } },
  });
  if (!alias) return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  if (alias.resolvedPlace.fileUuid !== fileUuid) {
    return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  }

  await prisma.resolvedPlaceAlias.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
