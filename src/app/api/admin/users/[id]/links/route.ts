import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const POST = withAdminAuth(async (req, _user, ctx) => {
  const { id: userId } = await ctx.params;
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json(
      { error: "Admin tree not configured (ADMIN_TREE_ID)" },
      { status: 500 },
    );
  }

  const body = await req.json();
  const { individualXref, verified } = body as { individualXref?: string; verified?: boolean };
  const xref = typeof individualXref === "string" ? individualXref.trim() : "";
  if (!xref) {
    return NextResponse.json(
      { error: "individualXref is required" },
      { status: 400 },
    );
  }

  const fileUuid = await getAdminFileUuid();
  const individual = await prisma.gedcomIndividual.findFirst({
    where: { fileUuid, xref },
    select: { id: true },
  });
  if (!individual) {
    return NextResponse.json(
      { error: `No individual found with xref "${xref}" in this tree` },
      { status: 400 },
    );
  }

  const existing = await prisma.userIndividualLink.findUnique({
    where: {
      userId_treeId_individualXref: { userId, treeId, individualXref: xref },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already linked to this individual" },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const link = await prisma.userIndividualLink.create({
    data: {
      userId,
      treeId,
      individualXref: xref,
      verified: verified === true,
    },
  });

  return NextResponse.json({ link }, { status: 201 });
});
