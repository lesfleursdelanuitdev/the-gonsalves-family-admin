import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { syncSuggestionStatus } from "@/lib/admin/place-resolution-sync";

type CreateLinkBody = {
  gedcomPlaceId: string;
  resolvedPlaceId: string;
  matchMethod: string;
  confidence?: number;
  notes?: string | null;
};

/** POST /api/admin/place-resolution/links */
export const POST = withAdminAuth(async (req, user) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const body = await req.json() as CreateLinkBody;

  if (!body.gedcomPlaceId || !body.resolvedPlaceId || !body.matchMethod) {
    return NextResponse.json(
      { error: "gedcomPlaceId, resolvedPlaceId, and matchMethod are required" },
      { status: 400 },
    );
  }

  const [gedcomPlace, resolvedPlace] = await Promise.all([
    prisma.gedcomPlace.findFirst({ where: { id: body.gedcomPlaceId, fileUuid } }),
    prisma.resolvedPlace.findFirst({ where: { id: body.resolvedPlaceId, fileUuid } }),
  ]);
  if (!gedcomPlace) return NextResponse.json({ error: "GedcomPlace not found" }, { status: 404 });
  if (!resolvedPlace) return NextResponse.json({ error: "ResolvedPlace not found" }, { status: 404 });

  const existing = await prisma.resolvedPlaceLink.findUnique({
    where: { gedcomPlaceId: body.gedcomPlaceId },
  });
  if (existing) {
    return NextResponse.json(
      { error: "GedcomPlace is already linked to a ResolvedPlace" },
      { status: 409 },
    );
  }

  const link = await prisma.resolvedPlaceLink.create({
    data: {
      gedcomPlaceId: body.gedcomPlaceId,
      resolvedPlaceId: body.resolvedPlaceId,
      matchMethod: body.matchMethod,
      confidence: body.confidence ?? 100,
      notes: body.notes ?? null,
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    },
  });

  await syncSuggestionStatus(body.gedcomPlaceId);

  return NextResponse.json({ link }, { status: 201 });
});
