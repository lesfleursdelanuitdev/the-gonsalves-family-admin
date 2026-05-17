import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "user", action: "update", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id, userRoleId } = await ctx.params;

  const row = await prisma.userRole.findUnique({
    where: { id: userRoleId },
    select: { id: true, userId: true },
  });
  if (!row || row.userId !== id) {
    return NextResponse.json({ error: "User role assignment not found" }, { status: 404 });
  }

  await prisma.userRole.delete({ where: { id: userRoleId } });
  return NextResponse.json({ ok: true });
});

