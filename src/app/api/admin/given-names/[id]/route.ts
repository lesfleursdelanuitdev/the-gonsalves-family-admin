import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const givenName = await prisma.gedcomGivenName.findFirst({
    where: { id, fileUuid },
    include: {
      _count: {
        select: {
          nameFormGivenNames: true,
        },
      },
    },
  });

  if (!givenName) {
    return NextResponse.json({ error: "Given name not found" }, { status: 404 });
  }

  return NextResponse.json({ givenName });
});
