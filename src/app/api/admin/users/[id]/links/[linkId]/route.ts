import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id: userId, linkId } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json(
      { error: "Admin tree not configured (ADMIN_TREE_ID)" },
      { status: 500 },
    );
  }

  const link = await prisma.userIndividualLink.findFirst({
    where: { id: linkId, userId, treeId },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.userIndividualLink.delete({ where: { id: linkId } });
  return new NextResponse(null, { status: 204 });
});
