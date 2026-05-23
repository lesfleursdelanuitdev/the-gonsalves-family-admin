import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { syncSuggestionStatus } from "@/lib/admin/place-resolution-sync";

/** DELETE /api/admin/place-resolution/links/[id] */
export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const link = await prisma.resolvedPlaceLink.findUnique({
    where: { id },
    include: { gedcomPlace: { select: { fileUuid: true } } },
  });
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (link.gedcomPlace.fileUuid !== fileUuid) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const { gedcomPlaceId } = link;
  await prisma.resolvedPlaceLink.delete({ where: { id } });
  await syncSuggestionStatus(gedcomPlaceId);

  return NextResponse.json({ ok: true });
});
