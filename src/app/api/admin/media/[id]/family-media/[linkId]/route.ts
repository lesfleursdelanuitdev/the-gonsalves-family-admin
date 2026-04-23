import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id: mediaId, linkId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const res = await prisma.gedcomFamilyMedia.deleteMany({
    where: { id: linkId, mediaId, fileUuid },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
});
