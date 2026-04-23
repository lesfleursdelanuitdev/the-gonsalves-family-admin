import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { buildIndividualDetailEvents } from "@/lib/detail/individual-detail-events";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;

  const row = await prisma.gedcomIndividual.findUnique({
    where: { id },
    select: { id: true, fileUuid: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  const { events } = await buildIndividualDetailEvents(prisma, row.fileUuid, row.id);
  return NextResponse.json({ events });
});
