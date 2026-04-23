import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const date = await prisma.gedcomDate.findFirst({
    where: { id, fileUuid },
    include: {
      _count: {
        select: {
          events: true,
          individualBirthDates: true,
          individualDeathDates: true,
          familyMarriageDates: true,
          familyDivorceDates: true,
        },
      },
    },
  });

  if (!date) {
    return NextResponse.json({ error: "Date not found" }, { status: 404 });
  }

  return NextResponse.json({ date });
});
