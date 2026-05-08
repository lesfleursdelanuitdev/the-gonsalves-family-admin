import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { attachTimelineEventPreviewMedia } from "@/lib/detail/timeline-event-preview-media";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { sortEventsChronologically } from "@/lib/timeline/timeline-chronology";
import type { TimelineSubject } from "@/lib/timeline/timeline-friendly-description";

function mapEventToIndividualDetailRow(
  event: {
    id: string;
    eventType: string;
    customType: string | null;
    eventLabel: string | null;
    value: string | null;
    cause: string | null;
    sortOrder: number | null;
    date: {
      original: string | null;
      dateType: string | null;
      year: number | null;
      month: number | null;
      day: number | null;
    } | null;
    place: { original: string | null; name: string | null } | null;
  },
): IndividualDetailEvent {
  const d = event.date;
  const p = event.place;
  return {
    eventId: event.id,
    eventType: event.eventType,
    customType: event.customType,
    eventLabel: event.eventLabel ?? null,
    value: event.value,
    cause: event.cause,
    dateOriginal: d?.original ?? null,
    dateType: d?.dateType ?? null,
    year: d?.year ?? null,
    month: d?.month ?? null,
    day: d?.day ?? null,
    placeOriginal: p?.original ?? null,
    placeName: p?.name ?? null,
    sortOrder: event.sortOrder ?? 0,
    source: "note",
    familyId: null,
    childXref: null,
  };
}

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id: noteId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const note = await prisma.gedcomNote.findFirst({
    where: { id: noteId, fileUuid },
    select: { id: true },
  });
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const links = await prisma.gedcomEventNote.findMany({
    where: { noteId, fileUuid },
    include: {
      event: {
        include: {
          date: true,
          place: true,
        },
      },
    },
  });

  const events = sortEventsChronologically(
    links
      .map((l) => l.event)
      .filter(Boolean)
      .map((ev) => mapEventToIndividualDetailRow(ev)),
  );

  // Event-linked media only (same rule as family timeline — no person fallback).
  await attachTimelineEventPreviewMedia(prisma, fileUuid, events, { mode: "family" });

  const timelineSubject: TimelineSubject = { kind: "none" };

  return NextResponse.json({ events, timelineSubject });
});
