import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { id } = await ctx.params;

  const existing = await prisma.siteHealthSuppression.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.siteHealthSuppression.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
});
