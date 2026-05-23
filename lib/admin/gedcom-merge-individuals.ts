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
import { newBatchId } from "./changelog";

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

  // Validate both exist in this tree
  const [primary, secondary] = await Promise.all([
    tx.gedcomIndividual.findFirst({ where: { id: primaryId, fileUuid }, select: { id: true, xref: true } }),
    tx.gedcomIndividual.findFirst({ where: { id: secondaryId, fileUuid }, select: { id: true, xref: true } }),
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
    if (primaryEventKeys.has(k)) continue;
    // Retarget the junction row to primary
    await tx.gedcomIndividualEvent.update({
      where: { id: link.id },
      data: { individualId: primaryId },
    });
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
    select: { id: true, noteId: true },
  });
  for (const link of secondaryNoteLinks) {
    if (primaryNoteIds.has(link.noteId)) {
      await tx.gedcomIndividualNote.delete({ where: { id: link.id } });
      continue;
    }
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
    select: { id: true, sourceId: true },
  });
  for (const link of secondarySourceLinks) {
    if (primarySourceIds.has(link.sourceId)) {
      await tx.gedcomIndividualSource.delete({ where: { id: link.id } });
      continue;
    }
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
    select: { id: true, mediaId: true },
  });
  for (const link of secondaryMediaLinks) {
    if (primaryMediaIds.has(link.mediaId)) {
      await tx.gedcomIndividualMedia.delete({ where: { id: link.id } });
      continue;
    }
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
      // Drop duplicate alias type — delete cascades junction rows
      await tx.gedcomIndividualNameForm.delete({ where: { id: nf.id } });
      continue;
    }
    // Move to primary as alias (never replace primary birth name)
    const newType = nf.nameType === "birth" ? "aka" : (nf.nameType ?? "aka");
    await tx.gedcomIndividualNameForm.update({
      where: { id: nf.id },
      data: { individualId: primaryId, nameType: newType, isPrimary: false },
    });
  }

  // ── 6. Update family spouse slots ──────────────────────────────────────────
  const famAsHusband = await tx.gedcomFamily.findMany({
    where: { fileUuid, husbandId: secondaryId },
    select: { id: true },
  });
  for (const fam of famAsHusband) {
    await tx.gedcomFamily.update({ where: { id: fam.id }, data: { husbandId: primaryId } });
    await syncFamilySpouseXrefs(tx, fam.id);
    familiesUpdated++;
  }

  const famAsWife = await tx.gedcomFamily.findMany({
    where: { fileUuid, wifeId: secondaryId },
    select: { id: true },
  });
  for (const fam of famAsWife) {
    await tx.gedcomFamily.update({ where: { id: fam.id }, data: { wifeId: primaryId } });
    await syncFamilySpouseXrefs(tx, fam.id);
    familiesUpdated++;
  }

  // ── 7. Update FamilyChild (child slot) ────────────────────────────────────
  const famAsChild = await tx.gedcomFamilyChild.findMany({
    where: { fileUuid, childId: secondaryId },
    select: { id: true, familyId: true },
  });
  for (const fc of famAsChild) {
    const alreadyChild = await tx.gedcomFamilyChild.findFirst({
      where: { fileUuid, familyId: fc.familyId, childId: primaryId },
    });
    if (alreadyChild) {
      await tx.gedcomFamilyChild.delete({ where: { id: fc.id } });
    } else {
      await tx.gedcomFamilyChild.update({ where: { id: fc.id }, data: { childId: primaryId } });
    }
  }

  // ── 8. Update ParentChild ─────────────────────────────────────────────────
  await tx.gedcomParentChild.updateMany({
    where: { fileUuid, parentId: secondaryId },
    data: { parentId: primaryId },
  });
  // For child rows, skip duplicates (upsert would be ideal but updateMany is safe here
  // because the unique constraint catches conflicts — delete secondary first)
  const pcAsChild = await tx.gedcomParentChild.findMany({
    where: { fileUuid, childId: secondaryId },
    select: { id: true, parentId: true },
  });
  for (const pc of pcAsChild) {
    const exists = await tx.gedcomParentChild.findFirst({
      where: { fileUuid, parentId: pc.parentId, childId: primaryId },
    });
    if (exists) {
      await tx.gedcomParentChild.delete({ where: { id: pc.id } });
    } else {
      await tx.gedcomParentChild.update({ where: { id: pc.id }, data: { childId: primaryId } });
    }
  }

  // ── 9. Update Spouse rows ─────────────────────────────────────────────────
  await tx.gedcomSpouse.updateMany({ where: { fileUuid, individualId: secondaryId }, data: { individualId: primaryId } });
  await tx.gedcomSpouse.updateMany({ where: { fileUuid, spouseId: secondaryId }, data: { spouseId: primaryId } });

  // ── 10. Update Associations ───────────────────────────────────────────────
  const assoAsSubject = await tx.gedcomIndividualAssociation.findMany({
    where: { fileUuid, subjectIndividualId: secondaryId },
    select: { id: true, associateIndividualId: true },
  });
  for (const a of assoAsSubject) {
    const exists = await tx.gedcomIndividualAssociation.findFirst({
      where: { fileUuid, subjectIndividualId: primaryId, associateIndividualId: a.associateIndividualId },
    });
    if (exists) {
      await tx.gedcomIndividualAssociation.delete({ where: { id: a.id } });
    } else {
      await tx.gedcomIndividualAssociation.update({ where: { id: a.id }, data: { subjectIndividualId: primaryId } });
    }
  }
  const assoAsAssociate = await tx.gedcomIndividualAssociation.findMany({
    where: { fileUuid, associateIndividualId: secondaryId },
    select: { id: true, subjectIndividualId: true },
  });
  for (const a of assoAsAssociate) {
    const exists = await tx.gedcomIndividualAssociation.findFirst({
      where: { fileUuid, subjectIndividualId: a.subjectIndividualId, associateIndividualId: primaryId },
    });
    if (exists) {
      await tx.gedcomIndividualAssociation.delete({ where: { id: a.id } });
    } else {
      await tx.gedcomIndividualAssociation.update({ where: { id: a.id }, data: { associateIndividualId: primaryId } });
    }
  }

  // ── 11. Update gedcom_file_objects xref pointer ───────────────────────────
  await tx.gedcomFileObject.updateMany({
    where: { fileUuid, objectUuid: secondaryId, objectType: "INDI" },
    data: { objectUuid: primaryId },
  });

  // ── 12. Delete the secondary individual ───────────────────────────────────
  await tx.gedcomIndividual.delete({ where: { id: secondaryId } });

  // ── 13. Recompute family flags for primary ────────────────────────────────
  await recomputeIndividualFamilyFlags(ctx, primaryId);

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
