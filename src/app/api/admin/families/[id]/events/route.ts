import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { buildFamilyDetailEvents } from "@/lib/detail/family-detail-events";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const row = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  const { events } = await buildFamilyDetailEvents(prisma, fileUuid, row.id);
  return NextResponse.json({ events });
});
