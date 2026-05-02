import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { applyIndividualEditorPayload } from "@/lib/admin/admin-individual-editor-apply";
import { newBatchId, type ChangeCtx } from "@/lib/admin/changelog";
import { repairIndividualKeyFactDenormFromEvents } from "@/lib/admin/admin-individual-key-events";
import { bodyHasIndividualEditorPayload, parseIndividualEditorPayload } from "@/lib/forms/individual-editor-payload";
import { ADMIN_INDIVIDUAL_DETAIL_INCLUDE } from "@/app/api/admin/individuals/individual-detail-include";

export const GET = withAdminAuth(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const inTree = await prisma.gedcomIndividual.findFirst({
    where: { id, fileUuid },
    select: { id: true },
  });
  if (!inTree) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction((tx) => {
      const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: "" };
      return repairIndividualKeyFactDenormFromEvents(changeCtx, id);
    });
  } catch (e) {
    console.error("GET /api/admin/individuals/[id] key-fact denorm repair failed (continuing)", e);
  }

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });

  if (!individual) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  return NextResponse.json({ individual });
});

const ALLOWED_LEGACY_PATCH_FIELDS = new Set([
  "fullName",
  "fullNameLower",
  "sex",
  "birthYear",
  "deathYear",
  "isLiving",
  "occupation",
  "religion",
  "nationality",
]);

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomIndividual.findFirst({
    where: { id, fileUuid },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (bodyHasIndividualEditorPayload(body)) {
    const payload = parseIndividualEditorPayload(body);
    try {
      await prisma.$transaction(async (tx) => {
        const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId: newBatchId() };
        await applyIndividualEditorPayload(changeCtx, id, payload);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const individual = await prisma.gedcomIndividual.findUnique({
      where: { id },
      include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
    });
    return NextResponse.json({ individual });
  }

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_LEGACY_PATCH_FIELDS.has(key)) {
      data[key] = value;
    }
  }

  if ("fullName" in data && !("fullNameLower" in data)) {
    data.fullNameLower = String(data.fullName ?? "").toLowerCase();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  data.updatedAt = new Date();

  await prisma.gedcomIndividual.update({
    where: { id },
    data,
  });

  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id },
    include: ADMIN_INDIVIDUAL_DETAIL_INCLUDE,
  });

  return NextResponse.json({ individual });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const existing = await prisma.gedcomIndividual.findFirst({
    where: { id, fileUuid },
    select: { id: true, xref: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Individual not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Null out husband/wife references on families (and their denormalized xref columns)
    await tx.gedcomFamily.updateMany({
      where: { husbandId: id },
      data: { husbandId: null, husbandXref: null },
    });
    await tx.gedcomFamily.updateMany({
      where: { wifeId: id },
      data: { wifeId: null, wifeXref: null },
    });

    // 2. Remove spouse relationship rows
    await tx.gedcomSpouse.deleteMany({
      where: { OR: [{ individualId: id }, { spouseId: id }] },
    });

    // 3. Remove family-child links
    await tx.gedcomFamilyChild.deleteMany({ where: { childId: id } });

    // 4. Remove parent-child links
    await tx.gedcomParentChild.deleteMany({
      where: { OR: [{ parentId: id }, { childId: id }] },
    });

    // 5. Collect event IDs, then remove join rows and orphaned events/dates/places
    const eventLinks = await tx.gedcomIndividualEvent.findMany({
      where: { individualId: id },
      select: { eventId: true },
    });
    const eventIds = eventLinks.map((e) => e.eventId);

    await tx.gedcomIndividualEvent.deleteMany({ where: { individualId: id } });

    if (eventIds.length > 0) {
      // Find which events are now orphaned (not linked to any other individual or family)
      const stillLinkedByIndi = await tx.gedcomIndividualEvent.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      });
      const stillLinkedByFam = await tx.gedcomFamilyEvent.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      });
      const stillLinkedByMedia = await tx.gedcomEventMedia.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      });
      const stillLinked = new Set([
        ...stillLinkedByIndi.map((r) => r.eventId),
        ...stillLinkedByFam.map((r) => r.eventId),
        ...stillLinkedByMedia.map((r) => r.eventId),
      ]);
      const orphanedEventIds = eventIds.filter((eid) => !stillLinked.has(eid));

      if (orphanedEventIds.length > 0) {
        const orphanedEvents = await tx.gedcomEvent.findMany({
          where: { id: { in: orphanedEventIds } },
          select: { id: true, dateId: true, placeId: true },
        });
        const dateIds = orphanedEvents.map((e) => e.dateId).filter((d): d is string => d != null);
        const placeIds = orphanedEvents.map((e) => e.placeId).filter((p): p is string => p != null);

        // Delete sub-relations on events (notes, sources) before deleting the events
        await tx.gedcomEventNote.deleteMany({ where: { eventId: { in: orphanedEventIds } } });
        await tx.gedcomEventSource.deleteMany({ where: { eventId: { in: orphanedEventIds } } });
        await tx.gedcomEvent.deleteMany({ where: { id: { in: orphanedEventIds } } });

        // Clean up exclusively-referenced dates
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

        // Clean up exclusively-referenced places
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
    }

    // 6. Remove other individual junction rows
    await tx.gedcomIndividualNote.deleteMany({ where: { individualId: id } });
    await tx.gedcomIndividualSource.deleteMany({ where: { individualId: id } });
    await tx.gedcomIndividualMedia.deleteMany({ where: { individualId: id } });
    await tx.gedcomIndividualOccupation.deleteMany({ where: { individualId: id } });
    await tx.gedcomIndividualNationality.deleteMany({ where: { individualId: id } });

    // 7. Remove name forms and their sub-parts
    const nameForms = await tx.gedcomIndividualNameForm.findMany({
      where: { individualId: id },
      select: { id: true },
    });
    if (nameForms.length > 0) {
      const nfIds = nameForms.map((nf) => nf.id);
      await tx.gedcomNameFormGivenName.deleteMany({ where: { nameFormId: { in: nfIds } } });
      await tx.gedcomNameFormSurname.deleteMany({ where: { nameFormId: { in: nfIds } } });
      await tx.gedcomIndividualNameForm.deleteMany({ where: { individualId: id } });
    }

    // 8. Remove file object (XREF mapping)
    await tx.gedcomFileObject.deleteMany({ where: { objectUuid: id } });

    // 9. Remove user-individual links referencing this person's XREF
    if (existing.xref) {
      await tx.userIndividualLink.deleteMany({ where: { individualXref: existing.xref } });
    }

    // 10. Delete the individual
    await tx.gedcomIndividual.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
});
