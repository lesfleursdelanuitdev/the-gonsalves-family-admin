import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  findOrCreateGedcomPlace,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const placeSelect = {
  id: true,
  original: true,
  name: true,
  county: true,
  state: true,
  country: true,
} as const;

export const POST = withAdminAuth(async (request, _user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const placeIdDirect = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const placeRaw = body.place;

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  let placeId = placeIdDirect;
  if (!placeId) {
    if (!placeRaw || typeof placeRaw !== "object") {
      return NextResponse.json({ error: "placeId or place payload is required" }, { status: 400 });
    }
    const parsed = parsePlaceInput(placeRaw);
    if (!parsed) {
      return NextResponse.json({ error: "place payload is empty" }, { status: 400 });
    }
    placeId = await findOrCreateGedcomPlace(prisma, fileUuid, parsed);
  }

  const place = await prisma.gedcomPlace.findFirst({
    where: { id: placeId, fileUuid },
    select: { id: true },
  });
  if (!place) {
    return NextResponse.json({ error: "Place not found in this tree" }, { status: 404 });
  }

  try {
    const row = await prisma.gedcomMediaPlace.create({
      data: { fileUuid, placeId, mediaId },
      include: { place: { select: placeSelect } },
    });
    return NextResponse.json({ placeMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that place" }, { status: 409 });
  }
});
