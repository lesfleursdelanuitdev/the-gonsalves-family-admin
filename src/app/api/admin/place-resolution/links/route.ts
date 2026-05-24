import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { createPlaceLink } from "@/lib/admin/place-resolution-links";

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

  try {
    const link = await createPlaceLink({
      fileUuid,
      userId: user.id,
      gedcomPlaceId: body.gedcomPlaceId,
      resolvedPlaceId: body.resolvedPlaceId,
      matchMethod: body.matchMethod,
      confidence: body.confidence,
      notes: body.notes,
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 404 || status === 409) return NextResponse.json({ error: msg }, { status });
    throw err;
  }
});
