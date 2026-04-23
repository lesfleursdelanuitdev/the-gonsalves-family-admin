import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const familySelect = {
  id: true,
  xref: true,
  husband: { select: { id: true, fullName: true } },
  wife: { select: { id: true, fullName: true } },
} as const;

export const POST = withAdminAuth(async (request, _user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const familyId = typeof body.familyId === "string" ? body.familyId.trim() : "";
  if (!familyId) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const family = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true },
  });
  if (!family) {
    return NextResponse.json({ error: "Family not found in this tree" }, { status: 404 });
  }

  try {
    const row = await prisma.gedcomFamilyMedia.create({
      data: { fileUuid, familyId, mediaId },
      include: { family: { select: familySelect } },
    });
    return NextResponse.json({ familyMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that family" }, { status: 409 });
  }
});
