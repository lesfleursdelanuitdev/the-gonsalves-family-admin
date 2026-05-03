import { Prisma } from "@ligneous/prisma";
import type { ChangeCtx } from "@/lib/admin/changelog";
import { commitMediaJunctionLink } from "@/lib/admin/media-junction-changelog";

type Tx = Prisma.TransactionClient;

const dateSelect = {
  id: true,
  original: true,
  dateType: true,
  year: true,
  month: true,
  day: true,
  endYear: true,
  endMonth: true,
  endDay: true,
} as const;

const placeSelect = {
  id: true,
  original: true,
  name: true,
  county: true,
  state: true,
  country: true,
} as const;

/**
 * When media is linked to an event, copy the event’s canonical date and place onto the media
 * (GedcomMediaDate / GedcomMediaPlace) if the event has `dateId` / `placeId` set. Skips links that
 * already exist. Intended to run inside the caller’s Prisma transaction alongside the event–media link.
 */
export async function ensureMediaDatePlaceFromEventIds(
  tx: Tx,
  ctx: ChangeCtx,
  opts: { mediaId: string; fileUuid: string; dateId: string | null; placeId: string | null },
): Promise<void> {
  const { mediaId, fileUuid, dateId, placeId } = opts;

  if (dateId) {
    const dateRow = await tx.gedcomDate.findFirst({
      where: { id: dateId, fileUuid },
      select: { id: true },
    });
    if (dateRow) {
      const exists = await tx.gedcomMediaDate.findFirst({
        where: { fileUuid, mediaId, dateId },
        select: { id: true },
      });
      if (!exists) {
        const created = await tx.gedcomMediaDate.create({
          data: { fileUuid, dateId, mediaId },
          include: { date: { select: dateSelect } },
        });
        await commitMediaJunctionLink(
          ctx,
          "media_date",
          created,
          `Linked media to date from event (${created.date.original?.trim() || dateId})`,
        );
      }
    }
  }

  if (placeId) {
    const placeRow = await tx.gedcomPlace.findFirst({
      where: { id: placeId, fileUuid },
      select: { id: true },
    });
    if (placeRow) {
      const exists = await tx.gedcomMediaPlace.findFirst({
        where: { fileUuid, mediaId, placeId },
        select: { id: true },
      });
      if (!exists) {
        const created = await tx.gedcomMediaPlace.create({
          data: { fileUuid, placeId, mediaId },
          include: { place: { select: placeSelect } },
        });
        await commitMediaJunctionLink(
          ctx,
          "media_place",
          created,
          `Linked media to place from event (${created.place.original?.trim() || placeId})`,
        );
      }
    }
  }
}

/**
 * Loads the event’s `dateId` / `placeId` from the DB and applies {@link ensureMediaDatePlaceFromEventIds}.
 */
export async function ensureMediaDatePlaceFromLinkedEvent(
  tx: Tx,
  ctx: ChangeCtx,
  opts: { mediaId: string; fileUuid: string; eventId: string },
): Promise<void> {
  const event = await tx.gedcomEvent.findFirst({
    where: { id: opts.eventId, fileUuid: opts.fileUuid },
    select: { dateId: true, placeId: true },
  });
  if (!event) return;
  await ensureMediaDatePlaceFromEventIds(tx, ctx, {
    mediaId: opts.mediaId,
    fileUuid: opts.fileUuid,
    dateId: event.dateId,
    placeId: event.placeId,
  });
}
