import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import {
  findOrCreateGedcomDate,
  findOrCreateGedcomPlace,
  parseDateInput,
  parseLinkIds,
  parseMediaIds,
  parsePlaceInput,
} from "@/lib/admin/admin-event-create";
import { refreshIndividualKeyFactsDenorm } from "@/lib/admin/admin-individual-key-events";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { refreshFamilyDivorceDenorm, refreshFamilyMarriageDenorm } from "@/lib/admin/admin-family-marriage";
import { ADMIN_EVENT_DETAIL_INCLUDE } from "@/app/api/admin/events/event-admin-detail-include";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const event = await prisma.gedcomEvent.findFirst({
    where: { id, fileUuid },
    include: ADMIN_EVENT_DETAIL_INCLUDE,
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({ event });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.gedcomEvent.findFirst({
    where: { id, fileUuid },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
  if (!eventType) {
    return NextResponse.json({ error: "eventType is required" }, { status: 400 });
  }

  const customType =
    body.customType === null
      ? null
      : typeof body.customType === "string" && body.customType.trim()
        ? body.customType.trim()
        : null;
  const value =
    body.value === null
      ? null
      : typeof body.value === "string" && body.value.trim()
        ? body.value.trim()
        : null;
  const cause =
    body.cause === null
      ? null
      : typeof body.cause === "string" && body.cause.trim()
        ? body.cause.trim()
        : null;
  const agency =
    body.agency === null
      ? null
      : typeof body.agency === "string" && body.agency.trim()
        ? body.agency.trim()
        : null;

  const prevIndividualLinks = await prisma.gedcomIndividualEvent.findMany({
    where: { fileUuid, eventId: id },
    select: { individualId: true },
  });
  const affectedIndividualIds = new Set(prevIndividualLinks.map((r) => r.individualId));
  if ("links" in body) {
    const { individualIds } = parseLinkIds(body as Record<string, unknown>);
    for (const iid of individualIds) affectedIndividualIds.add(iid);
  }
  const oldEventType = existing.eventType;
  const touchesKeyFacts = (t: string) => t === "BIRT" || t === "DEAT";
  const wasKeyFact = touchesKeyFacts(oldEventType);
  const isKeyFact = touchesKeyFacts(eventType);
  const shouldRefreshKeyDenorm =
    ("links" in body && (wasKeyFact || isKeyFact)) ||
    ((wasKeyFact || isKeyFact) &&
      (Boolean("date" in body) || Boolean("place" in body) || eventType !== oldEventType));

  const prevFamilyLinks = await prisma.gedcomFamilyEvent.findMany({
    where: { fileUuid, eventId: id },
    select: { familyId: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
      let dateId: string | null = existing.dateId;
      if ("date" in body) {
        if (body.date === null) {
          dateId = null;
        } else {
          const parsed = parseDateInput(body.date);
          dateId = parsed ? await findOrCreateGedcomDate(tx, fileUuid, parsed) : null;
        }
      }

      let placeId: string | null = existing.placeId;
      if ("place" in body) {
        if (body.place === null) {
          placeId = null;
        } else {
          const parsed = parsePlaceInput(body.place);
          placeId = parsed ? await findOrCreateGedcomPlace(tx, fileUuid, parsed) : null;
        }
      }

      if ("links" in body) {
        const { individualIds, familyIds } = parseLinkIds({
          links: body.links,
        } as Record<string, unknown>);

        for (const iid of individualIds) {
          const ok = await tx.gedcomIndividual.findFirst({
            where: { id: iid, fileUuid },
            select: { id: true },
          });
          if (!ok) throw new Error(`INVALID_INDIVIDUAL:${iid}`);
        }
        for (const fid of familyIds) {
          const ok = await tx.gedcomFamily.findFirst({
            where: { id: fid, fileUuid },
            select: { id: true },
          });
          if (!ok) throw new Error(`INVALID_FAMILY:${fid}`);
        }

        await tx.gedcomIndividualEvent.deleteMany({ where: { eventId: id } });
        await tx.gedcomFamilyEvent.deleteMany({ where: { eventId: id } });

        for (const iid of individualIds) {
          await tx.gedcomIndividualEvent.create({
            data: {
              fileUuid,
              individualId: iid,
              eventId: id,
              role: "principal",
            },
          });
        }
        for (const fid of familyIds) {
          await tx.gedcomFamilyEvent.create({
            data: {
              fileUuid,
              familyId: fid,
              eventId: id,
            },
          });
        }
      }

      if ("mediaIds" in body) {
        const mediaIds = parseMediaIds(body);
        for (const mid of mediaIds) {
          const ok = await tx.gedcomMedia.findFirst({
            where: { id: mid, fileUuid },
            select: { id: true },
          });
          if (!ok) throw new Error(`INVALID_MEDIA:${mid}`);
        }
        await tx.gedcomEventMedia.deleteMany({ where: { eventId: id } });
        for (const mid of mediaIds) {
          await tx.gedcomEventMedia.create({
            data: { fileUuid, eventId: id, mediaId: mid },
          });
        }
      }

      await tx.gedcomEvent.update({
        where: { id },
        data: {
          eventType,
          customType,
          value,
          cause,
          agency,
          dateId,
          placeId,
        },
      });

      if (shouldRefreshKeyDenorm) {
        for (const individualId of affectedIndividualIds) {
          await refreshIndividualKeyFactsDenorm(changeCtx, individualId);
        }
      }

      // Re-sync family marriage_* / divorce denorm for any family ever linked to this event
      // (prev ∪ post) so date/place/type/value edits always update gedcom_families_v2, and
      // unlinking a family still refreshes that family's snapshot.
      const postFamilyLinks = await tx.gedcomFamilyEvent.findMany({
        where: { fileUuid, eventId: id },
        select: { familyId: true },
      });
      const affectedFamilyIds = new Set<string>();
      for (const r of prevFamilyLinks) affectedFamilyIds.add(r.familyId);
      for (const r of postFamilyLinks) affectedFamilyIds.add(r.familyId);
      for (const fid of affectedFamilyIds) {
        await refreshFamilyMarriageDenorm(changeCtx, fid);
        await refreshFamilyDivorceDenorm(changeCtx, fid);
      }
    });

    const event = await prisma.gedcomEvent.findFirst({
      where: { id, fileUuid },
      include: ADMIN_EVENT_DETAIL_INCLUDE,
    });

    return NextResponse.json({ event });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("INVALID_INDIVIDUAL:")) {
      return NextResponse.json({ error: "One or more individuals are not in this tree." }, { status: 400 });
    }
    if (msg.startsWith("INVALID_FAMILY:")) {
      return NextResponse.json({ error: "One or more families are not in this tree." }, { status: 400 });
    }
    if (msg.startsWith("INVALID_MEDIA:")) {
      return NextResponse.json({ error: "One or more media IDs are not in this tree." }, { status: 400 });
    }
    throw e;
  }
});

export const DELETE = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomEvent.findFirst({
    where: { id, fileUuid },
    select: {
      id: true,
      eventType: true,
      dateId: true,
      placeId: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const linkedBeforeDelete = await prisma.gedcomIndividualEvent.findMany({
    where: { fileUuid, eventId: id },
    select: { individualId: true },
  });
  const familyIdsBeforeDelete = await prisma.gedcomFamilyEvent.findMany({
    where: { fileUuid, eventId: id },
    select: { familyId: true },
  });
  const deletedType = existing.eventType;
  const wasKeyFactDelete = deletedType === "BIRT" || deletedType === "DEAT";
  const wasMarrDelete = deletedType === "MARR";
  const wasDivDelete = deletedType === "DIV";
  const dateId = existing.dateId;
  const placeId = existing.placeId;

  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
    await tx.gedcomIndividualEvent.deleteMany({ where: { eventId: id } });
    await tx.gedcomFamilyEvent.deleteMany({ where: { eventId: id } });
    await tx.gedcomEventNote.deleteMany({ where: { eventId: id } });
    await tx.gedcomEventSource.deleteMany({ where: { eventId: id } });
    await tx.gedcomEvent.delete({ where: { id } });

    await tx.gedcomFileObject.deleteMany({ where: { fileUuid, objectUuid: id } });

    if (dateId) {
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
    if (placeId) {
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

    if (wasKeyFactDelete) {
      for (const row of linkedBeforeDelete) {
        await refreshIndividualKeyFactsDenorm(changeCtx, row.individualId);
      }
    }
    if (wasMarrDelete) {
      for (const row of familyIdsBeforeDelete) {
        await refreshFamilyMarriageDenorm(changeCtx, row.familyId);
      }
    }
    if (wasDivDelete) {
      for (const row of familyIdsBeforeDelete) {
        await refreshFamilyDivorceDenorm(changeCtx, row.familyId);
      }
    }
  });

  return NextResponse.json({ success: true });
});
