import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

  const existing = await prisma.siteHealthSuppression.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.siteHealthSuppression.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
});
