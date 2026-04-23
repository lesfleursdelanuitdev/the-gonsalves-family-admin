import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const individualSelect = {
  id: true,
  fullName: true,
  xref: true,
} as const;

export const POST = withAdminAuth(async (request, _user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const individualId = typeof body.individualId === "string" ? body.individualId.trim() : "";
  if (!individualId) {
    return NextResponse.json({ error: "individualId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const individual = await prisma.gedcomIndividual.findFirst({
    where: { id: individualId, fileUuid },
    select: { id: true },
  });
  if (!individual) {
    return NextResponse.json({ error: "Individual not found in this tree" }, { status: 404 });
  }

  try {
    const row = await prisma.gedcomIndividualMedia.create({
      data: { fileUuid, individualId, mediaId },
      include: { individual: { select: individualSelect } },
    });
    return NextResponse.json({ individualMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that individual" }, { status: 409 });
  }
});
