import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const place = await prisma.gedcomPlace.findFirst({
    where: { id, fileUuid },
    include: {
      _count: {
        select: {
          events: true,
          individualBirthPlaces: true,
          individualDeathPlaces: true,
          familyMarriagePlaces: true,
          familyDivorcePlaces: true,
        },
      },
    },
  });

  if (!place) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  return NextResponse.json({ place });
});
