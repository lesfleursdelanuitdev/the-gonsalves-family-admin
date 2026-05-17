import { NextResponse } from "next/server";
import { deleteEmptyFamiliesForFile } from "@/lib/admin/admin-empty-families-cleanup";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { prisma } from "@/lib/database/prisma";
import { requireCan } from "@/lib/authz/routeGuards";

export const runtime = "nodejs";

/** POST — removes DB-empty families for the configured admin tree (validator EMPTY_FAMILY shape). */
export const POST = withAdminAuth(async (_req, user, _ctx) => {
  await requireCan({ entity: "gedcom", action: "validate_tree", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  try {
    const result = await deleteEmptyFamiliesForFile(prisma, fileUuid, user.id);
    return NextResponse.json({ fileUuid, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
