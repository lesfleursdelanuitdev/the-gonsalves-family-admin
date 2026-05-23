import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

/** POST /api/admin/place-resolution/resolved/[id]/aliases */
export const POST = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const resolved = await prisma.resolvedPlace.findFirst({ where: { id, fileUuid } });
  if (!resolved) return NextResponse.json({ error: "ResolvedPlace not found" }, { status: 404 });

  const body = await req.json() as { alias?: string; aliasType?: string; notes?: string };
  if (!body.alias?.trim()) return NextResponse.json({ error: "alias is required" }, { status: 400 });

  const alias = await prisma.resolvedPlaceAlias.create({
    data: {
      resolvedPlaceId: id,
      alias: body.alias.trim(),
      aliasType: body.aliasType ?? "historical",
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ alias }, { status: 201 });
});
