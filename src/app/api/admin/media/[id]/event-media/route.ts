import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

/** Nested under `event` — matches admin events list enough for descriptive labels in the media editor. */
const eventIncludeForMediaLink = {
  date: true,
  place: true,
  individualEvents: {
    include: {
      individual: {
        select: {
          id: true,
          fullName: true,
          individualNameForms: {
            where: { isPrimary: true },
            take: 1,
            select: {
              givenNames: {
                orderBy: { position: "asc" as const },
                select: { givenName: { select: { givenName: true } } },
              },
              surnames: {
                orderBy: { position: "asc" as const },
                select: { surname: { select: { surname: true } } },
              },
            },
          },
        },
      },
    },
  },
  familyEvents: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { id: true, fullName: true } },
          wife: { select: { id: true, fullName: true } },
        },
      },
    },
  },
} as const;

export const POST = withAdminAuth(async (request, _user, ctx) => {
  const { id: mediaId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await request.json()) as Record<string, unknown>;
  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const media = await prisma.gedcomMedia.findFirst({
    where: { id: mediaId, fileUuid },
    select: { id: true },
  });
  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const event = await prisma.gedcomEvent.findFirst({
    where: { id: eventId, fileUuid },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found in this tree" }, { status: 404 });
  }

  try {
    const row = await prisma.gedcomEventMedia.create({
      data: { fileUuid, eventId, mediaId },
      include: { event: { include: eventIncludeForMediaLink } },
    });
    return NextResponse.json({ eventMedia: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This media is already linked to that event" }, { status: 409 });
  }
});
