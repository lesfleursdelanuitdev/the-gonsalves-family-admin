import type { Prisma } from "@ligneous/prisma";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import type { ChangeCtx } from "@/lib/admin/changelog";

type Tx = Prisma.TransactionClient;

async function formatDateDisplay(tx: Tx, dateId: string | null): Promise<string | null> {
  if (!dateId) return null;
  const d = await tx.gedcomDate.findUnique({ where: { id: dateId } });
  if (!d) return null;
  if (d.original?.trim()) return d.original.trim();
  const parts = [d.year, d.month, d.day].filter((x) => x != null).join("-");
  return parts || null;
}

async function formatPlaceDisplay(tx: Tx, placeId: string | null): Promise<string | null> {
  if (!placeId) return null;
  const p = await tx.gedcomPlace.findUnique({ where: { id: placeId } });
  if (!p) return null;
  const name = p.name?.trim() ?? "";
  const orig = p.original?.trim() ?? "";
  return name || orig || null;
}

async function findKeyEventLink(
  ctx: ChangeCtx,
  individualId: string,
  eventType: "BIRT" | "DEAT",
) {
  const { tx, fileUuid } = ctx;
  return tx.gedcomIndividualEvent.findFirst({
    where: {
      fileUuid,
      individualId,
      event: { fileUuid, eventType },
    },
    include: { event: true },
    orderBy: [{ event: { sortOrder: "asc" } }, { event: { id: "asc" } }],
  });
}

async function deleteKeyEventIfExists(
  ctx: ChangeCtx,
  individualId: string,
  eventType: "BIRT" | "DEAT",
) {
  const { tx, fileUuid } = ctx;
  const link = await findKeyEventLink(ctx, individualId, eventType);
  if (!link) return;
  await tx.gedcomIndividualEvent.deleteMany({ where: { id: link.id } });
  await tx.gedcomEvent.deleteMany({ where: { id: link.eventId, fileUuid } });
}

/**
 * Upsert exactly one BIRT or DEAT per individual; sync individual denormalized columns.
 * `dateRaw` / `placeRaw` are JSON fragments (same shape as event API). Null = clear.
 */
export async function upsertIndividualKeyFact(
  ctx: ChangeCtx,
  individualId: string,
  kind: "birth" | "death",
  dateRaw: unknown,
  placeRaw: unknown,
) {
  const { tx, fileUuid } = ctx;
  const eventType = kind === "birth" ? "BIRT" : "DEAT";
  const parsedDate = parseDateInput(dateRaw);
  const parsedPlace = parsePlaceInput(placeRaw);

  const clearIndividual = async () => {
    if (kind === "birth") {
      await tx.gedcomIndividual.update({
        where: { id: individualId },
        data: {
          birthDateId: null,
          birthPlaceId: null,
          birthDateDisplay: null,
          birthPlaceDisplay: null,
          birthYear: null,
        },
      });
    } else {
      await tx.gedcomIndividual.update({
        where: { id: individualId },
        data: {
          deathDateId: null,
          deathPlaceId: null,
          deathDateDisplay: null,
          deathPlaceDisplay: null,
          deathYear: null,
        },
      });
    }
  };

  if (!parsedDate && !parsedPlace) {
    await deleteKeyEventIfExists(ctx, individualId, eventType);
    await clearIndividual();
    return;
  }

  const dateId = parsedDate ? await findOrCreateGedcomDate(tx, fileUuid, parsedDate) : null;
  const placeId = parsedPlace ? await findOrCreateGedcomPlace(tx, fileUuid, parsedPlace) : null;

  const link = await findKeyEventLink(ctx, individualId, eventType);
  if (link) {
    await tx.gedcomEvent.update({
      where: { id: link.eventId },
      data: {
        dateId,
        placeId,
      },
    });
  } else {
    const ev = await tx.gedcomEvent.create({
      data: {
        fileUuid,
        eventType,
        dateId,
        placeId,
        sortOrder: 0,
      },
    });
    await tx.gedcomIndividualEvent.create({
      data: {
        fileUuid,
        individualId,
        eventId: ev.id,
        role: "principal",
      },
    });
  }

  const dateDisplay = await formatDateDisplay(tx, dateId);
  const placeDisplay = await formatPlaceDisplay(tx, placeId);
  const yearFromDate = dateId
    ? (await tx.gedcomDate.findUnique({ where: { id: dateId }, select: { year: true } }))?.year ?? null
    : null;

  if (kind === "birth") {
    await tx.gedcomIndividual.update({
      where: { id: individualId },
      data: {
        birthDateId: dateId,
        birthPlaceId: placeId,
        birthDateDisplay: dateDisplay,
        birthPlaceDisplay: placeDisplay,
        birthYear: yearFromDate,
      },
    });
  } else {
    await tx.gedcomIndividual.update({
      where: { id: individualId },
      data: {
        deathDateId: dateId,
        deathPlaceId: placeId,
        deathDateDisplay: dateDisplay,
        deathPlaceDisplay: placeDisplay,
        deathYear: yearFromDate,
      },
    });
  }
}

/**
 * Recompute `birth_*` / `death_*` denormalized columns on the individual from the linked
 * BIRT and DEAT events. Call after generic event PATCH/POST/DELETE so public tree APIs
 * (which read `birth_date_display`, etc.) stay in sync with `gedcom_events_v2`.
 */
export async function refreshIndividualKeyFactsDenorm(
  ctx: ChangeCtx,
  individualId: string,
): Promise<void> {
  const { tx, fileUuid } = ctx;
  for (const [kind, eventType] of [
    ["birth", "BIRT"],
    ["death", "DEAT"],
  ] as const) {
    const link = await findKeyEventLink(ctx, individualId, eventType);
    if (!link) {
      if (kind === "birth") {
        await tx.gedcomIndividual.update({
          where: { id: individualId },
          data: {
            birthDateId: null,
            birthPlaceId: null,
            birthDateDisplay: null,
            birthPlaceDisplay: null,
            birthYear: null,
          },
        });
      } else {
        await tx.gedcomIndividual.update({
          where: { id: individualId },
          data: {
            deathDateId: null,
            deathPlaceId: null,
            deathDateDisplay: null,
            deathPlaceDisplay: null,
            deathYear: null,
          },
        });
      }
      continue;
    }
    const dateId = link.event.dateId;
    const placeId = link.event.placeId;
    const dateDisplay = await formatDateDisplay(tx, dateId);
    const placeDisplay = await formatPlaceDisplay(tx, placeId);
    const yearFromDate = dateId
      ? (await tx.gedcomDate.findUnique({ where: { id: dateId }, select: { year: true } }))?.year ?? null
      : null;
    if (kind === "birth") {
      await tx.gedcomIndividual.update({
        where: { id: individualId },
        data: {
          birthDateId: dateId,
          birthPlaceId: placeId,
          birthDateDisplay: dateDisplay,
          birthPlaceDisplay: placeDisplay,
          birthYear: yearFromDate,
        },
      });
    } else {
      await tx.gedcomIndividual.update({
        where: { id: individualId },
        data: {
          deathDateId: dateId,
          deathPlaceId: placeId,
          deathDateDisplay: dateDisplay,
          deathPlaceDisplay: placeDisplay,
          deathYear: yearFromDate,
        },
      });
    }
  }
}

/**
 * Re-sync denorm from canonical BIRT/DEAT (same as {@link refreshIndividualKeyFactsDenorm}).
 * Kept for existing call sites (e.g. admin individual GET, editor apply).
 */
export async function repairIndividualKeyFactDenormFromEvents(
  ctx: ChangeCtx,
  individualId: string,
): Promise<void> {
  await refreshIndividualKeyFactsDenorm(ctx, individualId);
}

export async function loadBirthYmd(
  tx: Tx,
  birthDateId: string | null | undefined,
): Promise<{ y: number | null; m: number | null; d: number | null }> {
  if (!birthDateId) return { y: null, m: null, d: null };
  const d = await tx.gedcomDate.findUnique({
    where: { id: birthDateId },
    select: { year: true, month: true, day: true },
  });
  return {
    y: d?.year ?? null,
    m: d?.month ?? null,
    d: d?.day ?? null,
  };
}
