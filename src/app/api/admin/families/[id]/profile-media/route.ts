import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { mergeFamilyChildrenForApi } from "@/lib/admin/admin-family-children-merge";
import { ADMIN_FAMILY_DETAIL_INCLUDE } from "@/app/api/admin/families/family-admin-detail-include";

export const PUT = withAdminAuth(async (req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as { mediaId?: unknown };
  const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  }

  const [entity, media] = await Promise.all([
    prisma.gedcomFamily.findFirst({ where: { id, fileUuid }, select: { id: true } }),
    prisma.gedcomMedia.findFirst({ where: { id: mediaId, fileUuid }, select: { id: true } }),
  ]);
  if (!entity) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media not found in this tree" }, { status: 404 });
  }

  await prisma.gedcomFamilyProfileMedia.upsert({
    where: { familyId: id },
    create: { familyId: id, mediaId, fileUuid },
    update: { mediaId, fileUuid },
  });

  const family = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    include: ADMIN_FAMILY_DETAIL_INCLUDE,
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  const merged = await mergeFamilyChildrenForApi(prisma, fileUuid, family);
  return NextResponse.json({ family: merged });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const entity = await prisma.gedcomFamily.findFirst({ where: { id, fileUuid }, select: { id: true } });
  if (!entity) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  await prisma.gedcomFamilyProfileMedia.deleteMany({ where: { familyId: id } });

  const family = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    include: ADMIN_FAMILY_DETAIL_INCLUDE,
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }
  const merged = await mergeFamilyChildrenForApi(prisma, fileUuid, family);
  return NextResponse.json({ family: merged });
});
