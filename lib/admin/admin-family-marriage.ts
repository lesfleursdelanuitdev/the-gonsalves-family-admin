import type { Prisma } from "@ligneous/prisma";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import type { ChangeCtx } from "@/lib/admin/changelog";
import { formatGedcomDateDisplayLabel } from "@/lib/gedcom/format-gedcom-date-display";

type Tx = Prisma.TransactionClient;

async function formatDateDisplay(tx: Tx, dateId: string | null): Promise<string | null> {
  if (!dateId) return null;
  const d = await tx.gedcomDate.findUnique({ where: { id: dateId } });
  if (!d) return null;
  const label = formatGedcomDateDisplayLabel({
    original: d.original,
    dateType: d.dateType,
    year: d.year,
    month: d.month,
    day: d.day,
    endYear: d.endYear,
    endMonth: d.endMonth,
    endDay: d.endDay,
  });
  return label.trim() ? label : null;
}

async function formatPlaceDisplay(tx: Tx, placeId: string | null): Promise<string | null> {
  if (!placeId) return null;
  const p = await tx.gedcomPlace.findUnique({ where: { id: placeId } });
  if (!p) return null;
  const name = p.name?.trim() ?? "";
  const orig = p.original?.trim() ?? "";
  return name || orig || null;
}

export async function findFamilyMarrLink(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  return tx.gedcomFamilyEvent.findFirst({
    where: {
      familyId,
      fileUuid,
      event: { fileUuid, eventType: "MARR" },
    },
    include: { event: true },
    orderBy: [{ event: { sortOrder: "asc" } }, { event: { id: "asc" } }],
  });
}

async function deleteMarrEventForFamily(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const link = await findFamilyMarrLink(ctx, familyId);
  if (!link) return;
  const eventId = link.eventId;
  await tx.gedcomFamilyEvent.deleteMany({ where: { id: link.id } });
  const famLeft = await tx.gedcomFamilyEvent.count({ where: { eventId } });
  const indLeft = await tx.gedcomIndividualEvent.count({ where: { eventId } });
  if (famLeft === 0 && indLeft === 0) {
    await tx.gedcomEvent.deleteMany({ where: { id: eventId, fileUuid } });
  }
}

/**
 * Sync `gedcom_families_v2` marriage_* denorm from the linked MARR event (or clear when absent).
 */
export async function refreshFamilyMarriageDenorm(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const link = await findFamilyMarrLink(ctx, familyId);
  if (!link) {
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        marriageDateId: null,
        marriagePlaceId: null,
        marriageDateDisplay: null,
        marriagePlaceDisplay: null,
        marriageYear: null,
        updatedAt: new Date(),
      },
    });
    return;
  }
  const dateId = link.event.dateId;
  const placeId = link.event.placeId;
  const dateDisplay = await formatDateDisplay(tx, dateId);
  const placeDisplay = await formatPlaceDisplay(tx, placeId);
  const yearFromDate = dateId
    ? (await tx.gedcomDate.findUnique({ where: { id: dateId }, select: { year: true } }))?.year ?? null
    : null;
  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: {
      marriageDateId: dateId,
      marriagePlaceId: placeId,
      marriageDateDisplay: dateDisplay,
      marriagePlaceDisplay: placeDisplay,
      marriageYear: yearFromDate,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert one MARR event per family (via `gedcom_family_events_v2`), sync date/place on `gedcom_events_v2`,
 * and mirror to family denormalized columns. `marriagePayload`: `null` clears; else `{ date?, place? }` like key facts.
 */
export async function upsertFamilyMarriageFact(
  ctx: ChangeCtx,
  familyId: string,
  marriagePayload: unknown,
) {
  const { tx, fileUuid } = ctx;
  if (marriagePayload === null) {
    await deleteMarrEventForFamily(ctx, familyId);
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        marriageDateId: null,
        marriagePlaceId: null,
        marriageDateDisplay: null,
        marriagePlaceDisplay: null,
        marriageYear: null,
        updatedAt: new Date(),
      },
    });
    return;
  }

  if (typeof marriagePayload !== "object" || marriagePayload === null) {
    throw new Error("marriage must be null or an object with optional date and place");
  }

  const m = marriagePayload as Record<string, unknown>;
  const dateRaw = "date" in m ? m.date : undefined;
  const placeRaw = "place" in m ? m.place : undefined;
  const parsedDate = parseDateInput(dateRaw);
  const parsedPlace = parsePlaceInput(placeRaw);

  if (!parsedDate && !parsedPlace) {
    await deleteMarrEventForFamily(ctx, familyId);
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        marriageDateId: null,
        marriagePlaceId: null,
        marriageDateDisplay: null,
        marriagePlaceDisplay: null,
        marriageYear: null,
        updatedAt: new Date(),
      },
    });
    return;
  }

  const dateId = parsedDate ? await findOrCreateGedcomDate(ctx.tx, ctx.fileUuid, parsedDate) : null;
  const placeId = parsedPlace ? await findOrCreateGedcomPlace(ctx.tx, ctx.fileUuid, parsedPlace) : null;

  const link = await findFamilyMarrLink(ctx, familyId);
  if (link) {
    await tx.gedcomEvent.update({
      where: { id: link.eventId },
      data: { dateId, placeId },
    });
  } else {
    const ev = await tx.gedcomEvent.create({
      data: {
        fileUuid,
        eventType: "MARR",
        dateId,
        placeId,
        sortOrder: 0,
      },
    });
    await tx.gedcomFamilyEvent.create({
      data: { fileUuid, familyId, eventId: ev.id },
    });
  }

  const dateDisplay = await formatDateDisplay(tx, dateId);
  const placeDisplay = await formatPlaceDisplay(tx, placeId);
  const yearFromDate = dateId
    ? (await tx.gedcomDate.findUnique({ where: { id: dateId }, select: { year: true } }))?.year ?? null
    : null;

  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: {
      marriageDateId: dateId,
      marriagePlaceId: placeId,
      marriageDateDisplay: dateDisplay,
      marriagePlaceDisplay: placeDisplay,
      marriageYear: yearFromDate,
      updatedAt: new Date(),
    },
  });
}

export async function findFamilyDivLink(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  return tx.gedcomFamilyEvent.findFirst({
    where: {
      familyId,
      fileUuid,
      event: { fileUuid, eventType: "DIV" },
    },
    include: { event: true },
    orderBy: [{ event: { sortOrder: "asc" } }, { event: { id: "asc" } }],
  });
}

async function deleteDivEventForFamily(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const link = await findFamilyDivLink(ctx, familyId);
  if (!link) return;
  const eventId = link.eventId;
  await tx.gedcomFamilyEvent.deleteMany({ where: { id: link.id } });
  const famLeft = await tx.gedcomFamilyEvent.count({ where: { eventId } });
  const indLeft = await tx.gedcomIndividualEvent.count({ where: { eventId } });
  if (famLeft === 0 && indLeft === 0) {
    await tx.gedcomEvent.deleteMany({ where: { id: eventId, fileUuid } });
  }
}

/** Sync `gedcom_families_v2` divorce date/place ids from the linked DIV event (or clear when absent). */
export async function refreshFamilyDivorceDenorm(ctx: ChangeCtx, familyId: string) {
  const { tx, fileUuid } = ctx;
  const link = await findFamilyDivLink(ctx, familyId);
  if (!link) {
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        divorceDateId: null,
        divorcePlaceId: null,
        updatedAt: new Date(),
      },
    });
    return;
  }
  const dateId = link.event.dateId;
  const placeId = link.event.placeId;
  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: {
      divorceDateId: dateId,
      divorcePlaceId: placeId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert one DIV event per family and mirror `divorceDateId` / `divorcePlaceId` on the family row.
 * Does not change `isDivorced` (handled via PATCH). `divorcePayload`: `null` clears; else `{ date?, place? }`.
 */
export async function upsertFamilyDivorceFact(
  ctx: ChangeCtx,
  familyId: string,
  divorcePayload: unknown,
) {
  const { tx, fileUuid } = ctx;
  if (divorcePayload === null) {
    await deleteDivEventForFamily(ctx, familyId);
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        divorceDateId: null,
        divorcePlaceId: null,
        updatedAt: new Date(),
      },
    });
    return;
  }

  if (typeof divorcePayload !== "object" || divorcePayload === null) {
    throw new Error("divorce must be null or an object with optional date and place");
  }

  const m = divorcePayload as Record<string, unknown>;
  const dateRaw = "date" in m ? m.date : undefined;
  const placeRaw = "place" in m ? m.place : undefined;
  const parsedDate = parseDateInput(dateRaw);
  const parsedPlace = parsePlaceInput(placeRaw);

  if (!parsedDate && !parsedPlace) {
    await deleteDivEventForFamily(ctx, familyId);
    await tx.gedcomFamily.update({
      where: { id: familyId },
      data: {
        divorceDateId: null,
        divorcePlaceId: null,
        updatedAt: new Date(),
      },
    });
    return;
  }

  const dateId = parsedDate ? await findOrCreateGedcomDate(ctx.tx, ctx.fileUuid, parsedDate) : null;
  const placeId = parsedPlace ? await findOrCreateGedcomPlace(ctx.tx, ctx.fileUuid, parsedPlace) : null;

  const link = await findFamilyDivLink(ctx, familyId);
  if (link) {
    await tx.gedcomEvent.update({
      where: { id: link.eventId },
      data: { dateId, placeId },
    });
  } else {
    const ev = await tx.gedcomEvent.create({
      data: {
        fileUuid,
        eventType: "DIV",
        dateId,
        placeId,
        sortOrder: 1,
      },
    });
    await tx.gedcomFamilyEvent.create({
      data: { fileUuid, familyId, eventId: ev.id },
    });
  }

  await tx.gedcomFamily.update({
    where: { id: familyId },
    data: {
      divorceDateId: dateId,
      divorcePlaceId: placeId,
      updatedAt: new Date(),
    },
  });
}
