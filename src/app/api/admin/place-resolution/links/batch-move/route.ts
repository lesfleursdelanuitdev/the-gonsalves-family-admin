import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { batchMovePlaceLinks } from "@/lib/admin/place-resolution-links";

type BatchMoveBody = {
  linkIds: string[];
  targetResolvedPlaceId: string;
};

/** POST /api/admin/place-resolution/links/batch-move */
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

  try {
    const result = await batchMovePlaceLinks({
      fileUuid,
      userId: user.id,
      linkIds: body.linkIds,
      targetResolvedPlaceId: body.targetResolvedPlaceId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 404 || status === 403 || status === 409) return NextResponse.json({ error: msg }, { status });
    throw err;
  }
});
