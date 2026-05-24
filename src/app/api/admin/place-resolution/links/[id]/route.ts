import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { deletePlaceLink } from "@/lib/admin/place-resolution-links";

/** DELETE /api/admin/place-resolution/links/[id] */
export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  try {
    await deletePlaceLink(id, fileUuid, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 404) return NextResponse.json({ error: msg }, { status });
    throw err;
  }
});
