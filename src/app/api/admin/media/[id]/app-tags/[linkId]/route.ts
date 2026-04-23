import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_request, user, ctx) => {
  const { id: mediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const row = await prisma.gedcomMediaAppTag.findFirst({
    where: { id: linkId, gedcomMediaId: mediaId, taggedBy: user.id },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Tag link not found" }, { status: 404 });
  }

  await prisma.gedcomMediaAppTag.delete({ where: { id: linkId } });
  return NextResponse.json({ success: true });
});
