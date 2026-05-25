/**
 * Merges two existing individuals within the same tree.
 * The "secondary" individual's data is additively merged into the "primary",
 * then the secondary is deleted. All DB references (families, events, notes,
 * sources, media, associations) are transferred to the primary first.
 */
import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@ligneous/prisma";
import { recomputeIndividualFamilyFlags, syncFamilySpouseXrefs } from "./admin-individual-families";
import type { ChangeCtx } from "./changelog";
import { logDelete, logUpdate, newBatchId, setBatchSummary } from "./changelog";

type Tx = Prisma.TransactionClient;

// ── Event dedup key ───────────────────────────────────────────────────────────

function eventKey(eventType: string, dateId: string | null, placeId: string | null): string {
  return `${eventType}|${dateId ?? ""}|${placeId ?? ""}`;
}

// ── Main merge function ───────────────────────────────────────────────────────

export type MergeTwoIndividualsResult = {
  primaryId: string;
  secondaryId: string;
  eventsTransferred: number;
  notesTransferred: number;
  sourcesTransferred: number;
  familiesUpdated: number;
};

async function mergeInTx(
  tx: Tx,
  fileUuid: string,
  userId: string,
  primaryId: string,
  secondaryId: string,
): Promise<MergeTwoIndividualsResult> {
  const ctx: ChangeCtx = { tx, fileUuid, userId, batchId: newBatchId() };

  if (primaryId === secondaryId) throw new Error("Primary and secondary must be different individuals");

  // Validate both exist in this tree; fetch names for the batch summary.
  const [primary, secondary] = await Promise.all([
    tx.gedcomIndividual.findFirst({ where: { id: primaryId, fileUuid }, select: { id: true, xref: true, fullName: true } }),
    tx.gedcomIndividual.findFirst({ where: { id: secondaryId, fileUuid }, select: { id: true, xref: true, fullName: true } }),
  ]);
  if (!primary) throw new Error(`Primary individual ${primaryId} not found in this tree`);
  if (!secondary) throw new Error(`Secondary individual ${secondaryId} not found in this tree`);

  let eventsTransferred = 0;
  let notesTransferred = 0;
  let sourcesTransferred = 0;
  let familiesUpdated = 0;

  // ── 1. Transfer events (additive, skip duplicates) ─────────────────────────
  const primaryEvents = await tx.gedcomIndividualEvent.findMany({
    where: { fileUuid, individualId: primaryId },
    include: { event: { select: { eventType: true, dateId: true, placeId: true } } },
  });
  const primaryEventKeys = new Set(
    primaryEvents.map((e) => eventKey(e.event.eventType, e.event.dateId, e.event.placeId)),
  );

  const secondaryEventLinks = await tx.gedcomIndividualEvent.findMany({
    where: { fileUuid, individualId: secondaryId },
    include: { event: { select: { eventType: true, dateId: true, placeId: true } } },
  });

  for (const link of secondaryEventLinks) {
    const k = eventKey(link.event.eventType, link.event.dateId, link.event.placeId);
    if (primaryEventKeys.has(k)) continue; // duplicate — will be swept before secondary deletion
    await logUpdate(ctx, "individual_event", link.id, null,
      { individualId: secondaryId }, { individualId: primaryId });
    await tx.gedcomIndividualEvent.update({ where: { id: link.id }, data: { individualId: primaryId } });
    primaryEventKeys.add(k);
    eventsTransferred++;
  }

  // ── 2. Transfer notes ──────────────────────────────────────────────────────
  const primaryNoteIds = new Set(
    (await tx.gedcomIndividualNote.findMany({ where: { fileUuid, individualId: primaryId }, select: { noteId: true } }))
      .map((n) => n.noteId),
  );

  const secondaryNoteLinks = await tx.gedcomIndividualNote.findMany({
    where: { fileUuid, individualId: secondaryId },
  });
  for (const link of secondaryNoteLinks) {
    if (primaryNoteIds.has(link.noteId)) {
      await logDelete(ctx, "individual_note", link.id, null, link as Record<string, unknown>);
      await tx.gedcomIndividualNote.delete({ where: { id: link.id } });
      continue;
    }
    await logUpdate(ctx, "individual_note", link.id, null,
      { individualId: secondaryId }, { individualId: primaryId });
    await tx.gedcomIndividualNote.update({ where: { id: link.id }, data: { individualId: primaryId } });
    primaryNoteIds.add(link.noteId);
    notesTransferred++;
  }

  // ── 3. Transfer source citations ───────────────────────────────────────────
  const primarySourceIds = new Set(
    (await tx.gedcomIndividualSource.findMany({ where: { fileUuid, individualId: primaryId }, select: { sourceId: true } }))
      .map((s) => s.sourceId),
  );

  const secondarySourceLinks = await tx.gedcomIndividualSource.findMany({
    where: { fileUuid, individualId: secondaryId },
  });
  for (const link of secondarySourceLinks) {
    if (primarySourceIds.has(link.sourceId)) {
      await logDelete(ctx, "individual_source", link.id, null, link as Record<string, unknown>);
      await tx.gedcomIndividualSource.delete({ where: { id: link.id } });
      continue;
    }
    await logUpdate(ctx, "individual_source", link.id, null,
      { individualId: secondaryId }, { individualId: primaryId });
    await tx.gedcomIndividualSource.update({ where: { id: link.id }, data: { individualId: primaryId } });
    primarySourceIds.add(link.sourceId);
    sourcesTransferred++;
  }

  // ── 4. Transfer media links ────────────────────────────────────────────────
  const primaryMediaIds = new Set(
    (await tx.gedcomIndividualMedia.findMany({ where: { fileUuid, individualId: primaryId }, select: { mediaId: true } }))
      .map((m) => m.mediaId),
  );

  const secondaryMediaLinks = await tx.gedcomIndividualMedia.findMany({
    where: { fileUuid, individualId: secondaryId },
  });
  for (const link of secondaryMediaLinks) {
    if (primaryMediaIds.has(link.mediaId)) {
      await logDelete(ctx, "individual_media", link.id, null, link as Record<string, unknown>);
      await tx.gedcomIndividualMedia.delete({ where: { id: link.id } });
      continue;
    }
    await logUpdate(ctx, "individual_media", link.id, null,
      { individualId: secondaryId }, { individualId: primaryId });
    await tx.gedcomIndividualMedia.update({ where: { id: link.id }, data: { individualId: primaryId } });
    primaryMediaIds.add(link.mediaId);
  }

  // ── 5. Transfer name forms (keep primary's, only add truly new aliases) ────
  const primaryNameTypes = new Set(
    (await tx.gedcomIndividualNameForm.findMany({ where: { fileUuid, individualId: primaryId }, select: { nameType: true } }))
      .map((n) => n.nameType),
  );
  const secondaryNameForms = await tx.gedcomIndividualNameForm.findMany({
    where: { fileUuid, individualId: secondaryId },
  });
  for (const nf of secondaryNameForms) {
    if (nf.nameType && primaryNameTypes.has(nf.nameType) && nf.nameType !== "birth") {
      await logDelete(ctx, "individual_name_form", nf.id, null, nf as Record<string, unknown>);
      await tx.gedcomIndividualNameForm.delete({ where: { id: nf.id } });
      continue;
    }
    const newType = nf.nameType === "birth" ? "aka" : (nf.nameType ?? "aka");
    await logUpdate(ctx, "individual_name_form", nf.id, null,
      { individualId: secondaryId, nameType: nf.nameType, isPrimary: nf.isPrimary },
      { individualId: primaryId, nameType: newType, isPrimary: false });
    await tx.gedcomIndividualNameForm.update({
      where: { id: nf.id },
      data: { individualId: primaryId, nameType: newType, isPrimary: false },
    });
  }

  // ── 6. Update family spouse slots ──────────────────────────────────────────
  const famAsHusband = await tx.gedcomFamily.findMany({
    where: { fileUuid, husbandId: secondaryId },
    select: { id: true, xref: true },
  });
  for (const fam of famAsHusband) {
    await logUpdate(ctx, "family", fam.id, fam.xref,
      { husbandId: secondaryId }, { husbandId: primaryId });
    await tx.gedcomFamily.update({ where: { id: fam.id }, data: { husbandId: primaryId } });
    await syncFamilySpouseXrefs(tx, fam.id);
    familiesUpdated++;
  }

  const famAsWife = await tx.gedcomFamily.findMany({
    where: { fileUuid, wifeId: secondaryId },
    select: { id: true, xref: true },
  });
  for (const fam of famAsWife) {
    await logUpdate(ctx, "family", fam.id, fam.xref,
      { wifeId: secondaryId }, { wifeId: primaryId });
    await tx.gedcomFamily.update({ where: { id: fam.id }, data: { wifeId: primaryId } });
    await syncFamilySpouseXrefs(tx, fam.id);
    familiesUpdated++;
  }

  // ── 7. Update FamilyChild (child slot) ────────────────────────────────────
  const famAsChild = await tx.gedcomFamilyChild.findMany({
    where: { fileUuid, childId: secondaryId },
  });
  for (const fc of famAsChild) {
    const alreadyChild = await tx.gedcomFamilyChild.findFirst({
      where: { fileUuid, familyId: fc.familyId, childId: primaryId },
    });
    if (alreadyChild) {
      await logDelete(ctx, "family_child", fc.id, null, fc as Record<string, unknown>);
      await tx.gedcomFamilyChild.delete({ where: { id: fc.id } });
    } else {
      await logUpdate(ctx, "family_child", fc.id, null,
        { childId: secondaryId }, { childId: primaryId });
      await tx.gedcomFamilyChild.update({ where: { id: fc.id }, data: { childId: primaryId } });
    }
  }

  // ── 8. Update ParentChild ─────────────────────────────────────────────────
  const pcAsParent = await tx.gedcomParentChild.findMany({
    where: { fileUuid, parentId: secondaryId },
    select: { id: true },
  });
  for (const pc of pcAsParent) {
    await logUpdate(ctx, "parent_child", pc.id, null,
      { parentId: secondaryId }, { parentId: primaryId });
    await tx.gedcomParentChild.update({ where: { id: pc.id }, data: { parentId: primaryId } });
  }

  const pcAsChild = await tx.gedcomParentChild.findMany({
    where: { fileUuid, childId: secondaryId },
  });
  for (const pc of pcAsChild) {
    const exists = await tx.gedcomParentChild.findFirst({
      where: { fileUuid, parentId: pc.parentId, childId: primaryId },
    });
    if (exists) {
      await logDelete(ctx, "parent_child", pc.id, null, pc as Record<string, unknown>);
      await tx.gedcomParentChild.delete({ where: { id: pc.id } });
    } else {
      await logUpdate(ctx, "parent_child", pc.id, null,
        { childId: secondaryId }, { childId: primaryId });
      await tx.gedcomParentChild.update({ where: { id: pc.id }, data: { childId: primaryId } });
    }
  }

  // ── 9. Update Spouse rows ─────────────────────────────────────────────────
  const spouseAsIndividual = await tx.gedcomSpouse.findMany({
    where: { fileUuid, individualId: secondaryId },
    select: { id: true },
  });
  for (const s of spouseAsIndividual) {
    await logUpdate(ctx, "spouse", s.id, null,
      { individualId: secondaryId }, { individualId: primaryId });
    await tx.gedcomSpouse.update({ where: { id: s.id }, data: { individualId: primaryId } });
  }

  const spouseAsSpouse = await tx.gedcomSpouse.findMany({
    where: { fileUuid, spouseId: secondaryId },
    select: { id: true },
  });
  for (const s of spouseAsSpouse) {
    await logUpdate(ctx, "spouse", s.id, null,
      { spouseId: secondaryId }, { spouseId: primaryId });
    await tx.gedcomSpouse.update({ where: { id: s.id }, data: { spouseId: primaryId } });
  }

  // ── 11. Update gedcom_file_objects xref pointer ───────────────────────────
  const fileObjects = await tx.gedcomFileObject.findMany({
    where: { fileUuid, objectUuid: secondaryId, objectType: "INDI" },
    select: { id: true },
  });
  for (const fo of fileObjects) {
    await logUpdate(ctx, "file_object", fo.id, null,
      { objectUuid: secondaryId }, { objectUuid: primaryId });
    await tx.gedcomFileObject.update({ where: { id: fo.id }, data: { objectUuid: primaryId } });
  }

  // ── 12. Sweep cascade victims: event junctions that were skipped as ────────
  //        duplicates still point to secondary and will be lost on deletion.
  const remainingEventLinks = await tx.gedcomIndividualEvent.findMany({
    where: { fileUuid, individualId: secondaryId },
    select: { id: true, fileUuid: true, individualId: true, eventId: true },
  });
  for (const link of remainingEventLinks) {
    await logDelete(ctx, "individual_event", link.id, null, link as Record<string, unknown>);
  }

  // ── 13. Snapshot + delete the secondary individual (must be last) ──────────
  const secondarySnapshot = await tx.gedcomIndividual.findUniqueOrThrow({ where: { id: secondaryId } });
  await logDelete(ctx, "individual", secondaryId, secondary.xref, secondarySnapshot as Record<string, unknown>);
  await tx.gedcomIndividual.delete({ where: { id: secondaryId } });

  // ── 14. Recompute family flags for primary ────────────────────────────────
  await recomputeIndividualFamilyFlags(ctx, primaryId);

  const primaryName = primary.fullName?.replace(/\//g, "").trim() ?? primary.xref ?? primaryId;
  const secondaryName = secondary.fullName?.replace(/\//g, "").trim() ?? secondary.xref ?? secondaryId;
  await setBatchSummary(ctx, `Merge ${secondaryName} into ${primaryName}`);

  return { primaryId, secondaryId, eventsTransferred, notesTransferred, sourcesTransferred, familiesUpdated };
}

export async function mergeTwoIndividuals(
  fileUuid: string,
  userId: string,
  primaryId: string,
  secondaryId: string,
): Promise<MergeTwoIndividualsResult> {
  return prisma.$transaction(
    (tx) => mergeInTx(tx, fileUuid, userId, primaryId, secondaryId),
    { timeout: 60_000 },
  );
}
