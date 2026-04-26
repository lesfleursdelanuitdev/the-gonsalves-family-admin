import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import {
  findOrCreateGedcomPlace,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";
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

export const POST = withAdminAuth(async (request, user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const placeIdDirect = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const placeRaw = body.place;

  const batchId = newBatchId();
  try {
    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.gedcomMedia.findFirst({
        where: { id: mediaId, fileUuid },
        select: { id: true },
      });
      if (!media) {
        const e = new Error("MEDIA_NOT_FOUND");
        throw e;
      }

      let placeId = placeIdDirect;
      if (!placeId) {
        if (!placeRaw || typeof placeRaw !== "object") {
          const e = new Error("PLACE_PAYLOAD_REQUIRED");
          throw e;
        }
        const parsed = parsePlaceInput(placeRaw);
        if (!parsed) {
          const e = new Error("PLACE_PAYLOAD_EMPTY");
          throw e;
        }
        placeId = await findOrCreateGedcomPlace(tx, fileUuid, parsed);
      }

      const place = await tx.gedcomPlace.findFirst({
        where: { id: placeId, fileUuid },
        select: { id: true },
      });
      if (!place) {
        const e = new Error("PLACE_NOT_FOUND");
        throw e;
      }

      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
      const created = await tx.gedcomMediaPlace.create({
        data: { fileUuid, placeId, mediaId },
        include: { place: { select: placeSelect } },
      });
      await commitMediaJunctionLink(
        changeCtx,
        "media_place",
        created,
        `Linked media to place ${created.place.original || placeId}`,
      );
      return created;
    });
    return NextResponse.json({ placeMedia: row }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "MEDIA_NOT_FOUND") {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    if (msg === "PLACE_PAYLOAD_REQUIRED") {
      return NextResponse.json({ error: "placeId or place payload is required" }, { status: 400 });
    }
    if (msg === "PLACE_PAYLOAD_EMPTY") {
      return NextResponse.json({ error: "place payload is empty" }, { status: 400 });
    }
    if (msg === "PLACE_NOT_FOUND") {
      return NextResponse.json({ error: "Place not found in this tree" }, { status: 404 });
    }
    return NextResponse.json({ error: "This media is already linked to that place" }, { status: 409 });
  }
});
