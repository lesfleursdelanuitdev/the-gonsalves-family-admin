import type { Prisma } from "@ligneous/prisma";
import type { ChangeCtx } from "@/lib/admin/changelog";

type Tx = Prisma.TransactionClient;

export type FamilyRowForDelete = {
  id: string;
  marriageDateId: string | null;
  marriagePlaceId: string | null;
  divorceDateId: string | null;
  divorcePlaceId: string | null;
};

/**
 * Deletes gedcom_events_v2 rows that are no longer linked via individual, family, or event-media
 * junctions, plus event notes/sources, unused dates/places, and XREF file objects for those events.
 */
async function deleteOrphanedGedcomEvents(
  ctx: ChangeCtx,
  candidateEventIds: string[],
): Promise<void> {
  const { tx, fileUuid } = ctx;
  if (candidateEventIds.length === 0) return;
  const unique = [...new Set(candidateEventIds)];

  const stillLinkedByIndi = await tx.gedcomIndividualEvent.findMany({
    where: { eventId: { in: unique } },
    select: { eventId: true },
  });
  const stillLinkedByFam = await tx.gedcomFamilyEvent.findMany({
    where: { eventId: { in: unique } },
    select: { eventId: true },
  });
  const stillLinkedByMedia = await tx.gedcomEventMedia.findMany({
    where: { eventId: { in: unique } },
    select: { eventId: true },
  });
  const stillLinked = new Set([
    ...stillLinkedByIndi.map((r) => r.eventId),
    ...stillLinkedByFam.map((r) => r.eventId),
    ...stillLinkedByMedia.map((r) => r.eventId),
  ]);
  const orphanedEventIds = unique.filter((eid) => !stillLinked.has(eid));
  if (orphanedEventIds.length === 0) return;

  const orphanedEvents = await tx.gedcomEvent.findMany({
    where: { id: { in: orphanedEventIds } },
    select: { id: true, dateId: true, placeId: true },
  });
  const dateIds = orphanedEvents.map((e) => e.dateId).filter((d): d is string => d != null);
  const placeIds = orphanedEvents.map((e) => e.placeId).filter((p): p is string => p != null);

  await tx.gedcomFileObject.deleteMany({
    where: { fileUuid, objectUuid: { in: orphanedEventIds } },
  });
  await tx.gedcomEventNote.deleteMany({ where: { eventId: { in: orphanedEventIds } } });
  await tx.gedcomEventSource.deleteMany({ where: { eventId: { in: orphanedEventIds } } });
  await tx.gedcomEvent.deleteMany({ where: { id: { in: orphanedEventIds } } });

  if (dateIds.length > 0) {
    const datesStillUsed = await tx.gedcomEvent.findMany({
      where: { dateId: { in: dateIds } },
      select: { dateId: true },
    });
    const usedDateIds = new Set(datesStillUsed.map((r) => r.dateId));
    const orphanedDateIds = dateIds.filter((d) => !usedDateIds.has(d));
    if (orphanedDateIds.length > 0) {
      await tx.gedcomDate.deleteMany({ where: { id: { in: orphanedDateIds } } });
    }
  }

  if (placeIds.length > 0) {
    const placesStillUsed = await tx.gedcomEvent.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true },
    });
    const usedPlaceIds = new Set(placesStillUsed.map((r) => r.placeId));
    const orphanedPlaceIds = placeIds.filter((p) => !usedPlaceIds.has(p));
    if (orphanedPlaceIds.length > 0) {
      await tx.gedcomPlace.deleteMany({ where: { id: { in: orphanedPlaceIds } } });
    }
  }
}

async function maybeDeleteDateIfOrphaned(tx: Tx, dateId: string | null): Promise<void> {
  if (!dateId) return;
  const nEv = await tx.gedcomEvent.count({ where: { dateId } });
  const nIndi = await tx.gedcomIndividual.count({
    where: { OR: [{ birthDateId: dateId }, { deathDateId: dateId }] },
  });
  const nFam = await tx.gedcomFamily.count({
    where: { OR: [{ marriageDateId: dateId }, { divorceDateId: dateId }] },
  });
  if (nEv + nIndi + nFam === 0) {
    await tx.gedcomDate.deleteMany({ where: { id: dateId } });
  }
}

async function maybeDeletePlaceIfOrphaned(tx: Tx, placeId: string | null): Promise<void> {
  if (!placeId) return;
  const nEv = await tx.gedcomEvent.count({ where: { placeId } });
  const nIndi = await tx.gedcomIndividual.count({
    where: { OR: [{ birthPlaceId: placeId }, { deathPlaceId: placeId }] },
  });
  const nFam = await tx.gedcomFamily.count({
    where: { OR: [{ marriagePlaceId: placeId }, { divorcePlaceId: placeId }] },
  });
  if (nEv + nIndi + nFam === 0) {
    await tx.gedcomPlace.deleteMany({ where: { id: placeId } });
  }
}

/**
 * Removes a family and dependent rows: junctions, spouse/parent-child edges for this FAM,
 * orphan family-only events, XREF mapping, then the family row and unused marriage/divorce date/place rows.
 */
export async function deleteGedcomFamilyWithCleanup(
  ctx: ChangeCtx,
  family: FamilyRowForDelete,
): Promise<void> {
  const { tx, fileUuid } = ctx;
  const { id: familyId } = family;

  const famEventLinks = await tx.gedcomFamilyEvent.findMany({
    where: { familyId },
    select: { eventId: true },
  });
  const eventIds = famEventLinks.map((r) => r.eventId);

  await tx.gedcomFamilyEvent.deleteMany({ where: { familyId } });
  await deleteOrphanedGedcomEvents(ctx, eventIds);

  await tx.gedcomFamilyNote.deleteMany({ where: { familyId } });
  await tx.gedcomFamilySource.deleteMany({ where: { familyId } });
  await tx.gedcomFamilySurname.deleteMany({ where: { familyId } });
  await tx.gedcomFamilyMedia.deleteMany({ where: { familyId } });
  await tx.gedcomFamilyChild.deleteMany({ where: { familyId } });
  await tx.gedcomParentChild.deleteMany({ where: { familyId } });
  await tx.gedcomSpouse.deleteMany({ where: { familyId } });

  await tx.gedcomFileObject.deleteMany({ where: { fileUuid, objectUuid: familyId } });

  await tx.gedcomFamily.delete({ where: { id: familyId } });

  await maybeDeleteDateIfOrphaned(tx, family.marriageDateId);
  await maybeDeleteDateIfOrphaned(tx, family.divorceDateId);
  await maybeDeletePlaceIfOrphaned(tx, family.marriagePlaceId);
  await maybeDeletePlaceIfOrphaned(tx, family.divorcePlaceId);
}
