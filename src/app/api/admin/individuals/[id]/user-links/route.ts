import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json(
      { error: "Admin tree not configured (ADMIN_TREE_ID)" },
      { status: 500 },
    );
  }

  const fileUuid = await getAdminFileUuid();
  const individual = await prisma.gedcomIndividual.findFirst({
    where: { id, fileUuid },
    select: { id: true, xref: true },
  });
  if (!individual) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  const xref = individual.xref?.trim() ?? "";
  if (!xref) {
    return NextResponse.json({ links: [] });
  }

  const rows = await prisma.userIndividualLink.findMany({
    where: { treeId, individualXref: xref },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      verified: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  const links = rows.map((r) => ({
    linkId: r.id,
    verified: r.verified,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
  }));

  return NextResponse.json({ links });
});
