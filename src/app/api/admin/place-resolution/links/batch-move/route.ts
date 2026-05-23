import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { syncSuggestionStatus } from "@/lib/admin/place-resolution-sync";

type BatchMoveBody = {
  linkIds: string[];
  targetResolvedPlaceId: string;
};

/** POST /api/admin/place-resolution/links/batch-move
 *  Re-assigns a set of existing ResolvedPlaceLinks to a different ResolvedPlace.
 */
export const POST = withAdminAuth(async (req, user) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as BatchMoveBody;

  if (!Array.isArray(body.linkIds) || body.linkIds.length === 0) {
    return NextResponse.json({ error: "linkIds must be a non-empty array" }, { status: 400 });
  }
  if (!body.targetResolvedPlaceId) {
    return NextResponse.json({ error: "targetResolvedPlaceId is required" }, { status: 400 });
  }

  // Fetch and validate the links, ensuring they all belong to this file.
  const links = await prisma.resolvedPlaceLink.findMany({
    where: { id: { in: body.linkIds } },
    include: { gedcomPlace: { select: { id: true, fileUuid: true } } },
  });

  if (links.length !== body.linkIds.length) {
    return NextResponse.json({ error: "One or more links not found" }, { status: 404 });
  }
  if (links.some((l) => l.gedcomPlace.fileUuid !== fileUuid)) {
    return NextResponse.json({ error: "One or more links belong to a different file" }, { status: 403 });
  }

  // Validate the target resolved place belongs to this file.
  const target = await prisma.resolvedPlace.findFirst({
    where: { id: body.targetResolvedPlaceId, fileUuid },
  });
  if (!target) {
    return NextResponse.json({ error: "Target ResolvedPlace not found" }, { status: 404 });
  }

  // Prevent moving to the same place they're already on.
  if (links.some((l) => l.resolvedPlaceId === body.targetResolvedPlaceId)) {
    return NextResponse.json(
      { error: "One or more links are already assigned to the target place" },
      { status: 409 },
    );
  }

  const gedcomPlaceIds = links.map((l) => l.gedcomPlace.id);

  await prisma.$transaction(async (tx) => {
    await tx.resolvedPlaceLink.deleteMany({ where: { id: { in: body.linkIds } } });
    await tx.resolvedPlaceLink.createMany({
      data: gedcomPlaceIds.map((gedcomPlaceId) => ({
        gedcomPlaceId,
        resolvedPlaceId: body.targetResolvedPlaceId,
        matchMethod: "manual",
        confidence: 100,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      })),
    });
  });

  for (const gedcomPlaceId of gedcomPlaceIds) {
    await syncSuggestionStatus(gedcomPlaceId);
  }

  return NextResponse.json({ moved: gedcomPlaceIds.length });
});
