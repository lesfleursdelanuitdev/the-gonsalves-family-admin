import type { Prisma } from "@ligneous/prisma";
import {
  canonicalSpouseSlotsForPair,
  findExistingCoupleFamilyId,
  normalizeChildRelationshipType,
  recomputeIndividualFamilyFlags,
  rebuildSpouseRowsForFamily,
  syncFamilySpouseXrefs,
  syncIndividualChildFamilies,
  syncIndividualSpouseFamilies,
} from "@/lib/admin/admin-individual-families";
import {
  loadBirthYmd,
  repairIndividualKeyFactDenormFromEvents,
  upsertIndividualKeyFact,
} from "@/lib/admin/admin-individual-key-events";
import { computeIsLiving, deathKnownFromIndividualSnapshot, type LivingMode } from "@/lib/admin/admin-individual-living";
import type { SurnamePayloadRow } from "@/lib/forms/individual-editor-form";
import {
  composeFullNameFromParts,
  syncIndividualNameForms,
  type NameFormSyncInput,
} from "@/lib/admin/admin-individual-names";
import { addChildToFamily } from "@/lib/admin/admin-family-membership";
import type { ChangeCtx } from "@/lib/admin/changelog";

type Tx = Prisma.TransactionClient;

function parseGedcomSex(raw: string | null | undefined): "M" | "F" | "U" | "X" | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).toUpperCase();
  if (s === "M" || s === "F" || s === "U" || s === "X") return s;
  return null;
}

/** Create a new `gedcom_families_v2` row linking the subject individual and a partner (existing or stub). */
export type NewSpouseFamilyPayload =
  | { kind: "existing"; partnerIndividualId: string }
  | { kind: "new"; givenNames: string[]; surname: string };

/** Two minimal new parents; sex is used with `canonicalSpouseSlotsForPair` for HUSB/WIFE. */
export type NewChildFamilyParentPayload = {
  givenNames: string[];
  surname: string;
  sex: "M" | "F" | "U" | "X";
  /** Child’s relationship to this parent (mapped to HUSB/WIFE slots after the family is created). */
  relationshipType: string;
};

export type NewChildFamilyFromNewParentsPayload = {
  parent1: NewChildFamilyParentPayload;
  parent2: NewChildFamilyParentPayload;
  pedigree?: string | null;
  birthOrder?: number | null;
};

/** Link an existing individual as a child of a family where the edited person is a spouse. */
export type AddExistingChildToSpouseFamilyPayload = {
  kind: "existing";
  familyId: string;
  childIndividualId: string;
  relationshipType: string;
  birthOrder?: number | null;
};

/** Create a minimal new individual and link as child of a family where the edited person is a spouse. */
export type AddNewChildToSpouseFamilyPayload = {
  kind: "new";
  familyId: string;
  givenNames: string[];
  surname: string;
  sex: "M" | "F" | "U" | "X";
  relationshipType: string;
  birthOrder?: number | null;
};

export type AddChildToSpouseFamilyPayload =
  | AddExistingChildToSpouseFamilyPayload
  | AddNewChildToSpouseFamilyPayload;

export type IndividualEditorPayload = {
  sex?: string | null;
  nameForms?: NameFormSyncInput[];
  /** @deprecated Prefer `nameForms`; still applied as a single primary form when `nameForms` is absent. */
  names?: { givenNames: string[]; surnames: SurnamePayloadRow[] };
  /** Omit to leave unchanged; `null` clears birth fact (event + individual columns). */
  birth?: { date: unknown; place: unknown } | null;
  death?: { date: unknown; place: unknown } | null;
  livingMode?: LivingMode;
  /** Family ids only; husband vs wife slot follows individual sex (M → husband, F → wife). */
  familiesAsSpouse?: { familyId: string }[];
  /**
   * New families to create and attach: processed before `familiesAsSpouse` sync so created ids are included.
   * When `familiesAsSpouse` is omitted but this is present, existing spouse-family links are preserved and merged.
   */
  newSpouseFamilies?: NewSpouseFamilyPayload[];
  familiesAsChild?: {
    familyId: string;
    relationshipType: string;
    pedigree?: string | null;
    birthOrder?: number | null;
    relationshipToHusband?: string | null;
    relationshipToWife?: string | null;
  }[];
  /** New parental families: two new individuals + FAM, then link this person as child. */
  newChildFamiliesFromNewParents?: NewChildFamilyFromNewParentsPayload[];
  /**
   * Add children to families where this individual is husband or wife. Server verifies spouse membership.
   * Processed after spouse-family sync so only applies to families that already exist in this request.
   */
  addChildrenToSpouseFamilies?: AddChildToSpouseFamilyPayload[];
};

async function loadCurrentSpouseFamilyIds(
  tx: Tx,
  fileUuid: string,
  individualId: string,
): Promise<{ familyId: string }[]> {
  const rows = await tx.gedcomFamily.findMany({
    where: { fileUuid, OR: [{ husbandId: individualId }, { wifeId: individualId }] },
    select: { id: true },
  });
  return rows.map((r) => ({ familyId: r.id }));
}

async function loadCurrentChildFamilyRows(
  tx: Tx,
  fileUuid: string,
  individualId: string,
): Promise<
  {
    familyId: string;
    relationshipType: string;
    pedigree: string | null;
    birthOrder: number | null;
  }[]
> {
  const fcRows = await tx.gedcomFamilyChild.findMany({
    where: { fileUuid, childId: individualId },
    select: { familyId: true, birthOrder: true },
  });
  const pcRows = await tx.gedcomParentChild.findMany({
    where: { fileUuid, childId: individualId },
    select: { familyId: true, relationshipType: true, pedigree: true },
  });
  const relByFamily = new Map<string, { relationshipType: string; pedigree: string | null }>();
  for (const r of pcRows) {
    const fid = r.familyId;
    if (!fid) continue;
    if (!relByFamily.has(fid)) {
      relByFamily.set(fid, {
        relationshipType: (r.relationshipType ?? "biological").trim() || "biological",
        pedigree: r.pedigree?.trim() ? r.pedigree.trim() : null,
      });
    }
  }
  return fcRows
    .filter((r): r is typeof r & { familyId: string } => Boolean(r.familyId))
    .map((r) => {
      const rel = relByFamily.get(r.familyId);
      return {
        familyId: r.familyId,
        relationshipType: rel?.relationshipType ?? "biological",
        pedigree: rel?.pedigree ?? null,
        birthOrder: r.birthOrder,
      };
    });
}

/**
 * Minimal new individual: primary birth name from given tokens + one surname.
 */
export async function createMinimalNamedIndividual(
  ctx: ChangeCtx,
  givenNames: string[],
  surname: string,
  sex: "M" | "F" | "U" | "X" | null,
): Promise<string> {
  const { tx, fileUuid } = ctx;
  const gClean = givenNames.map((s) => s.trim()).filter(Boolean);
  const sur = surname.trim();
  if (gClean.length === 0) throw new Error("At least one given name is required");
  if (!sur) throw new Error("Surname is required");

  const xref = await allocateNewIndividualXref(tx, fileUuid);
  const fullName = composeFullNameFromParts(gClean, [{ text: sur, pieceType: null }]);
  const ind = await tx.gedcomIndividual.create({
    data: {
      fileUuid,
      xref,
      fullName,
      fullNameLower: fullName.toLowerCase(),
      sex,
      isLiving: true,
    },
  });
  await registerXrefInFileObjects(tx, fileUuid, xref, "INDI", ind.id);
  await syncIndividualNameForms(ctx, ind.id, [
    { role: "primary", givenNames: gClean, surnames: [{ text: sur, pieceType: null }] },
  ]);
  return ind.id;
}

/** Spouse quick-add partner (sex unknown until edited later). */
export async function createMinimalPartnerIndividual(
  ctx: ChangeCtx,
  givenNames: string[],
  surname: string,
): Promise<string> {
  return createMinimalNamedIndividual(ctx, givenNames, surname, null);
}

/** Allocate FAM xref, create family row with HUSB/WIFE from canonical M/F rules, spouse rows, denorm xrefs. */
export async function createNewFamilyLinkingPair(
  ctx: ChangeCtx,
  individualAId: string,
  individualBId: string,
): Promise<string> {
  const { tx, fileUuid } = ctx;
  if (individualAId === individualBId) {
    throw new Error("Cannot form a family with the same person twice");
  }
  const [a, b] = await Promise.all([
    tx.gedcomIndividual.findFirst({
      where: { id: individualAId, fileUuid },
      select: { id: true, sex: true },
    }),
    tx.gedcomIndividual.findFirst({
      where: { id: individualBId, fileUuid },
      select: { id: true, sex: true },
    }),
  ]);
  if (!a || !b) throw new Error("Individual not found in this tree");

  const { husbandId, wifeId } = canonicalSpouseSlotsForPair(
    { id: a.id, sex: a.sex },
    { id: b.id, sex: b.sex },
  );

  const existingFamilyId = await findExistingCoupleFamilyId(tx, fileUuid, husbandId, wifeId);
  if (existingFamilyId) {
    await rebuildSpouseRowsForFamily(ctx, existingFamilyId);
    await syncFamilySpouseXrefs(tx, existingFamilyId);
    return existingFamilyId;
  }

  const xref = await allocateNewFamilyXref(tx, fileUuid);
  const fam = await tx.gedcomFamily.create({
    data: {
      fileUuid,
      xref,
      husbandId,
      wifeId,
      childrenCount: 0,
    },
  });
  await registerXrefInFileObjects(tx, fileUuid, xref, "FAM", fam.id);
  await rebuildSpouseRowsForFamily(ctx, fam.id);
  await syncFamilySpouseXrefs(tx, fam.id);
  return fam.id;
}

export async function createNewSpouseFamilyRecords(
  ctx: ChangeCtx,
  subjectIndividualId: string,
  entries: NewSpouseFamilyPayload[],
): Promise<string[]> {
  const { tx, fileUuid } = ctx;
  const ids: string[] = [];
  for (const e of entries) {
    if (e.kind === "existing") {
      const pid = e.partnerIndividualId.trim();
      if (!pid) continue;
      if (pid === subjectIndividualId) {
        throw new Error("Cannot link an individual as their own spouse");
      }
      const partner = await tx.gedcomIndividual.findFirst({
        where: { id: pid, fileUuid },
        select: { id: true },
      });
      if (!partner) throw new Error("Partner individual not found in this tree");
      ids.push(await createNewFamilyLinkingPair(ctx, subjectIndividualId, partner.id));
    } else {
      const partnerId = await createMinimalPartnerIndividual(ctx, e.givenNames, e.surname);
      ids.push(await createNewFamilyLinkingPair(ctx, subjectIndividualId, partnerId));
    }
  }
  return ids;
}

export async function createNewChildFamiliesFromNewParentsRecords(
  ctx: ChangeCtx,
  entries: NewChildFamilyFromNewParentsPayload[],
): Promise<
  {
    familyId: string;
    relationshipType: string;
    pedigree: string | null;
    birthOrder: number | null;
    relationshipToHusband: string;
    relationshipToWife: string;
  }[]
> {
  const out: {
    familyId: string;
    relationshipType: string;
    pedigree: string | null;
    birthOrder: number | null;
    relationshipToHusband: string;
    relationshipToWife: string;
  }[] = [];
  const { tx, fileUuid } = ctx;
  for (const e of entries) {
    const s1 = parseGedcomSex(e.parent1.sex);
    const s2 = parseGedcomSex(e.parent2.sex);
    if (s1 == null || s2 == null) {
      throw new Error("Each new parent must have sex M, F, U, or X");
    }
    if (e.parent1.givenNames.length === 0 || !e.parent1.surname.trim()) {
      throw new Error("Parent 1 needs given names and a surname");
    }
    if (e.parent2.givenNames.length === 0 || !e.parent2.surname.trim()) {
      throw new Error("Parent 2 needs given names and a surname");
    }
    const rel1 = normalizeChildRelationshipType(e.parent1.relationshipType);
    const rel2 = normalizeChildRelationshipType(e.parent2.relationshipType);
    const p1 = await createMinimalNamedIndividual(
      ctx,
      e.parent1.givenNames,
      e.parent1.surname.trim(),
      s1,
    );
    const p2 = await createMinimalNamedIndividual(
      ctx,
      e.parent2.givenNames,
      e.parent2.surname.trim(),
      s2,
    );
    const famId = await createNewFamilyLinkingPair(ctx, p1, p2);
    const fam = await tx.gedcomFamily.findFirst({
      where: { id: famId, fileUuid },
      select: { husbandId: true, wifeId: true },
    });
    if (!fam?.husbandId || !fam?.wifeId) {
      throw new Error("New parental family is missing husband or wife after creation");
    }
    const relationshipToHusband = fam.husbandId === p1 ? rel1 : rel2;
    const relationshipToWife = fam.wifeId === p1 ? rel1 : rel2;
    const relationshipType = relationshipToHusband;
    const pedigree = e.pedigree != null && String(e.pedigree).trim() ? String(e.pedigree).trim() : null;
    const birthOrder =
      e.birthOrder != null && Number.isFinite(e.birthOrder) ? Math.trunc(e.birthOrder) : null;
    out.push({
      familyId: famId,
      relationshipType,
      relationshipToHusband,
      relationshipToWife,
      pedigree,
      birthOrder,
    });
  }
  return out;
}

async function assertIndividualIsSpouseInFamily(
  tx: Tx,
  fileUuid: string,
  individualId: string,
  familyId: string,
) {
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam) throw new Error(`Family ${familyId} not found in this tree`);
  if (fam.husbandId !== individualId && fam.wifeId !== individualId) {
    throw new Error("You can only add children to families where this person is a spouse");
  }
}

export async function applyAddChildrenToSpouseFamilies(
  ctx: ChangeCtx,
  subjectIndividualId: string,
  entries: AddChildToSpouseFamilyPayload[],
) {
  const { tx, fileUuid } = ctx;
  for (const e of entries) {
    const fid = e.familyId.trim();
    if (!fid) continue;
    await assertIndividualIsSpouseInFamily(tx, fileUuid, subjectIndividualId, fid);
    const birthOrder =
      e.birthOrder != null && Number.isFinite(e.birthOrder) ? Math.trunc(e.birthOrder) : null;
    const rel = (e.relationshipType ?? "biological").trim() || "biological";
    if (e.kind === "existing") {
      const cid = e.childIndividualId.trim();
      if (!cid) continue;
      if (cid === subjectIndividualId) {
        throw new Error("Cannot add this person as their own child in the same family");
      }
      await addChildToFamily(ctx, fid, cid, { relationshipType: rel, birthOrder });
    } else {
      const g = e.givenNames.map((s) => s.trim()).filter(Boolean);
      const sur = e.surname.trim();
      if (g.length === 0 || !sur) throw new Error("New child needs given names and a surname");
      const sex = parseGedcomSex(e.sex);
      if (sex == null) throw new Error("New child sex must be M, F, U, or X");
      const childId = await createMinimalNamedIndividual(ctx, g, sur, sex);
      await addChildToFamily(ctx, fid, childId, { relationshipType: rel, birthOrder });
    }
  }
}

export async function applyIndividualEditorPayload(
  ctx: ChangeCtx,
  individualId: string,
  payload: IndividualEditorPayload,
) {
  const { tx, fileUuid } = ctx;
  await repairIndividualKeyFactDenormFromEvents(ctx, individualId);

  if (payload.nameForms && payload.nameForms.length > 0) {
    await syncIndividualNameForms(ctx, individualId, payload.nameForms);
  } else if (payload.names) {
    await syncIndividualNameForms(ctx, individualId, [
      { role: "primary", givenNames: payload.names.givenNames, surnames: payload.names.surnames },
    ]);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "birth")) {
    if (payload.birth === null) {
      await upsertIndividualKeyFact(ctx, individualId, "birth", null, null);
    } else if (payload.birth) {
      await upsertIndividualKeyFact(
        ctx,
        individualId,
        "birth",
        payload.birth.date,
        payload.birth.place,
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "death")) {
    if (payload.death === null) {
      await upsertIndividualKeyFact(ctx, individualId, "death", null, null);
    } else if (payload.death) {
      await upsertIndividualKeyFact(
        ctx,
        individualId,
        "death",
        payload.death.date,
        payload.death.place,
      );
    }
  }

  const ind = await tx.gedcomIndividual.findUnique({
    where: { id: individualId },
    select: {
      birthDateId: true,
      deathDateId: true,
      deathYear: true,
    },
  });
  if (!ind) throw new Error("Individual not found");

  const { y, m, d } = await loadBirthYmd(tx, ind.birthDateId);
  const livingMode: LivingMode = payload.livingMode ?? "auto";
  const deathKnown = deathKnownFromIndividualSnapshot({
    deathDateId: ind.deathDateId,
    deathYear: ind.deathYear,
  });
  const isLiving = computeIsLiving({
    livingMode,
    deathKnown,
    birthYear: y,
    birthMonth: m,
    birthDay: d,
  });

  const sexData =
    payload.sex === undefined
      ? {}
      : { sex: parseGedcomSex(payload.sex) };

  await tx.gedcomIndividual.update({
    where: { id: individualId },
    data: {
      ...sexData,
      isLiving,
    },
  });

  let spousePayload: { familyId: string }[] | undefined;
  if (payload.newSpouseFamilies && payload.newSpouseFamilies.length > 0) {
    const createdFamIds = await createNewSpouseFamilyRecords(
      ctx,
      individualId,
      payload.newSpouseFamilies,
    );
    const base =
      payload.familiesAsSpouse ?? (await loadCurrentSpouseFamilyIds(tx, fileUuid, individualId));
    spousePayload = [...base, ...createdFamIds.map((id) => ({ familyId: id }))];
  } else if (payload.familiesAsSpouse) {
    spousePayload = payload.familiesAsSpouse;
  }
  if (spousePayload) {
    await syncIndividualSpouseFamilies(ctx, individualId, spousePayload);
  }

  if (payload.addChildrenToSpouseFamilies && payload.addChildrenToSpouseFamilies.length > 0) {
    await applyAddChildrenToSpouseFamilies(ctx, individualId, payload.addChildrenToSpouseFamilies);
  }

  let childPayload:
    | {
        familyId: string;
        relationshipType: string;
        pedigree?: string | null;
        birthOrder?: number | null;
        relationshipToHusband?: string | null;
        relationshipToWife?: string | null;
      }[]
    | undefined;
  if (payload.newChildFamiliesFromNewParents && payload.newChildFamiliesFromNewParents.length > 0) {
    const createdRows = await createNewChildFamiliesFromNewParentsRecords(
      ctx,
      payload.newChildFamiliesFromNewParents,
    );
    const base =
      payload.familiesAsChild ?? (await loadCurrentChildFamilyRows(tx, fileUuid, individualId));
    childPayload = [...base, ...createdRows];
  } else if (payload.familiesAsChild) {
    childPayload = payload.familiesAsChild;
  }
  if (childPayload) {
    await syncIndividualChildFamilies(ctx, individualId, childPayload);
  }

  if (spousePayload || childPayload) {
    await recomputeIndividualFamilyFlags(ctx, individualId);
  }
}

/**
 * Call the PostgreSQL `generate_next_xref(file_uuid, object_type)` function to produce
 * a proper GEDCOM XREF such as `@I123@` or `@F456@`.
 */
async function generateNextXref(tx: Tx, fileUuid: string, objectType: "INDI" | "FAM"): Promise<string> {
  const rows = await tx.$queryRaw<[{ generate_next_xref: string }]>`
    SELECT generate_next_xref(${fileUuid}::uuid, ${objectType}::text)
  `;
  const xref = rows[0]?.generate_next_xref;
  if (!xref) throw new Error(`generate_next_xref returned empty for ${objectType}`);
  return xref;
}

export async function allocateNewIndividualXref(tx: Tx, fileUuid: string): Promise<string> {
  return generateNextXref(tx, fileUuid, "INDI");
}

/** Server-allocated family XREF (never accept client-supplied values for new families). */
export async function allocateNewFamilyXref(tx: Tx, fileUuid: string): Promise<string> {
  return generateNextXref(tx, fileUuid, "FAM");
}

/** Insert the XREF → record mapping into `gedcom_file_objects` (the router table). */
export async function registerXrefInFileObjects(
  tx: Tx,
  fileUuid: string,
  xref: string,
  objectType: "INDI" | "FAM",
  objectUuid: string,
): Promise<void> {
  await tx.gedcomFileObject.create({
    data: { fileUuid, xref, objectType, objectUuid },
  });
}

/**
 * Create a new individual and apply editor payload (names, birth, death, sex, living),
 * then attach spouse/child links when provided (including `newSpouseFamilies`).
 */
export async function createIndividualFromEditorPayload(
  ctx: ChangeCtx,
  payload: IndividualEditorPayload,
): Promise<string> {
  const { tx, fileUuid } = ctx;
  const spouseLinks = payload.familiesAsSpouse ?? [];
  const childLinks = payload.familiesAsChild ?? [];
  const newSpouse = payload.newSpouseFamilies ?? [];
  const newChildFromParents = payload.newChildFamiliesFromNewParents ?? [];

  const p: IndividualEditorPayload = { ...payload };
  delete (p as { familiesAsSpouse?: unknown }).familiesAsSpouse;
  delete (p as { familiesAsChild?: unknown }).familiesAsChild;
  delete (p as { newSpouseFamilies?: unknown }).newSpouseFamilies;
  delete (p as { newChildFamiliesFromNewParents?: unknown }).newChildFamiliesFromNewParents;

  const nameForms = p.nameForms?.length
    ? p.nameForms
    : p.names
      ? [{ role: "primary" as const, givenNames: p.names.givenNames, surnames: p.names.surnames }]
      : [];
  if (!nameForms.length) {
    throw new Error("nameForms or names must define at least one name block");
  }
  const hasNameParts = nameForms.some(
    (f) => f.givenNames.some((g) => g.trim()) || f.surnames.some((s) => s.text.trim()),
  );
  if (!hasNameParts) {
    throw new Error("At least one given name or surname must be non-empty");
  }

  const xref = await allocateNewIndividualXref(tx, fileUuid);
  const primaryForm = nameForms.find((f) => f.role === "primary") ?? nameForms[0]!;
  const seedFullName = composeFullNameFromParts(primaryForm.givenNames, primaryForm.surnames);

  const ind = await tx.gedcomIndividual.create({
    data: {
      fileUuid,
      xref,
      fullName: seedFullName,
      fullNameLower: seedFullName.toLowerCase(),
      sex: parseGedcomSex(p.sex ?? undefined),
      isLiving: true,
    },
  });

  await registerXrefInFileObjects(tx, fileUuid, xref, "INDI", ind.id);
  await applyIndividualEditorPayload(ctx, ind.id, p);

  const createdFamIds = await createNewSpouseFamilyRecords(ctx, ind.id, newSpouse);
  const allSpouse = [...spouseLinks, ...createdFamIds.map((id) => ({ familyId: id }))];
  if (allSpouse.length > 0) {
    await syncIndividualSpouseFamilies(ctx, ind.id, allSpouse);
  }
  const fromNewParents = await createNewChildFamiliesFromNewParentsRecords(ctx, newChildFromParents);
  const allChild = [...childLinks, ...fromNewParents];
  if (allChild.length > 0) {
    await syncIndividualChildFamilies(ctx, ind.id, allChild);
  }
  if (allSpouse.length > 0 || allChild.length > 0) {
    await recomputeIndividualFamilyFlags(ctx, ind.id);
  }

  return ind.id;
}
