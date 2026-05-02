import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { ADMIN_INDIVIDUAL_DETAIL_INCLUDE } from "@/app/api/admin/individuals/individual-detail-include";

export const PUT = withAdminAuth(async (req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as { mediaId?: unknown };
  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const [entity, media] = await Promise.all([
    prisma.gedcomIndividual.findFirst({ where: { id, fileUuid }, select: { id: true } }),
    prisma.gedcomMedia.findFirst({ where: { id: mediaId, fileUuid }, select: { id: true } }),
  ]);
  if (!entity) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media not found in this tree" }, { status: 404 });
  }

  await prisma.gedcomIndividualProfileMedia.upsert({
    where: { individualId: id },
    create: { individualId: id, mediaId, fileUuid },
    update: { mediaId, fileUuid },
  });

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });
  return NextResponse.json({ individual });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const entity = await prisma.gedcomIndividual.findFirst({ where: { id, fileUuid }, select: { id: true } });
  if (!entity) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  await prisma.gedcomIndividualProfileMedia.deleteMany({ where: { individualId: id } });

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });
  return NextResponse.json({ individual });
});
