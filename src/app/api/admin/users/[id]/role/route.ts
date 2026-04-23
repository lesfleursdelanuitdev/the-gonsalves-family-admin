import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";

type RoleValue = "owner" | "maintainer" | "contributor" | "none";

export const POST = withAdminAuth(async (req, user, ctx) => {
  const { id: userId } = await ctx.params;
  const body = await req.json();
  const { role } = body as { role: RoleValue };
  const treeId = process.env.ADMIN_TREE_ID!;

  if (!["owner", "maintainer", "contributor", "none"].includes(role)) {
    return NextResponse.json(
      { error: "role must be one of: owner, maintainer, contributor, none" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.treeOwner.deleteMany({ where: { treeId, userId } });
    await tx.treeMaintainer.deleteMany({ where: { treeId, userId } });
    await tx.treeContributor.deleteMany({ where: { treeId, userId } });

    if (role === "owner") {
      await tx.treeOwner.create({
        data: { treeId, userId, addedBy: user.id },
      });
    } else if (role === "maintainer") {
      await tx.treeMaintainer.create({
        data: { treeId, userId, addedBy: user.id },
      });
    } else if (role === "contributor") {
      await tx.treeContributor.create({
        data: { treeId, userId, addedBy: user.id },
      });
    }
  });

  return NextResponse.json({ userId, treeId, role });
});
