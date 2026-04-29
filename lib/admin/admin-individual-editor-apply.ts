import type { Prisma } from "@ligneous/prisma";
import {
  canonicalSpouseSlotsForPair,
  findExistingCoupleFamilyId,
  normalizeChildRelationshipType,
  recomputeIndividualFamilyFlags,
  rebuildSpouseRowsForFamily,
  singleSpouseSlotForFirstParent,
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
import { addChildToFamily, addParentToFamily } from "@/lib/admin/admin-family-membership";
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
  /** Optional GEDCOM pedigree text for this parent–child link. */
  pedigree?: string | null;
};

/** Two new parents + full couple family (HUSB/WIFE when resolvable). */
export type NewChildFamilyFromNewParentsPairPayload = {
  /** Omitted in older clients; treated as pair when `parent1` and `parent2` are present. */
  kind?: "pair";
  parent1: NewChildFamilyParentPayload;
  parent2: NewChildFamilyParentPayload;
  pedigree?: string | null;
  birthOrder?: number | null;
};

/** When creating one new parent, optionally attach them as spouse of an existing parent of the subject. */
export type NewChildFamilyLinkAsSpousePayload = {
  /** Family where the subject is (or will be) a child and `existingParentIndividualId` is a parent. */
  familyId: string;
  existingParentIndividualId: string;
};

/** One new parent + `gedcom_families_v2` row with a single occupied spouse slot. */
export type NewChildFamilyFromNewParentsSinglePayload = {
  kind: "single";
  parent: NewChildFamilyParentPayload;
  /** @deprecated Prefer `parent.pedigree`; still used as fallback when parent omits pedigree. */
  pedigree?: string | null;
  birthOrder?: number | null;
  /**
   * Link the new parent as spouse of `existingParentIndividualId`:
   * if that family has an empty spouse slot, fill it; if both slots are full, create a new couple family.
   */
  linkAsSpouse?: NewChildFamilyLinkAsSpousePayload;
};

export type NewChildFamilyFromNewParentsPayload =
  | NewChildFamilyFromNewParentsPairPayload
  | NewChildFamilyFromNewParentsSinglePayload;

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
    pedigreeToHusband?: string | null;
    pedigreeToWife?: string | null;
    relationshipToHusband?: string | null;
    relationshipToWife?: string | null;
  }[];
  /** New parental families: one or two new individuals + FAM, then link this person as child. */
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

export type ChildFamilySyncPayloadRow = {
  familyId: string;
  relationshipType: string;
  pedigree: string | null;
  pedigreeToHusband: string | null;
  pedigreeToWife: string | null;
  birthOrder: number | null;
  relationshipToHusband: string;
  relationshipToWife: string;
};

function buildChildFamilySyncRowFromParts(
  familyId: string,
  birthOrder: number | null,
  fam: { husbandId: string | null; wifeId: string | null },
  pcRows: { parentId: string; relationshipType: string; pedigree: string | null }[],
): ChildFamilySyncPayloadRow {
  const relOf = (pid: string | null | undefined) => {
    if (!pid) return { relationship: "biological", pedigree: null as string | null };
    const row = pcRows.find((p) => p.parentId === pid);
    return {
      relationship: (row?.relationshipType ?? "biological").trim() || "biological",
      pedigree: row?.pedigree?.trim() ? row.pedigree.trim() : null,
    };
  };
  const h = relOf(fam.husbandId);
  const w = relOf(fam.wifeId);
  const relationshipType = fam.husbandId ? h.relationship : w.relationship;
  return {
    familyId,
    relationshipType,
    pedigree: h.pedigree ?? w.pedigree,
    pedigreeToHusband: fam.husbandId ? h.pedigree : null,
    pedigreeToWife: fam.wifeId ? w.pedigree : null,
    birthOrder,
    relationshipToHusband: fam.husbandId ? h.relationship : "biological",
    relationshipToWife: fam.wifeId ? w.relationship : "biological",
  };
}

async function loadCurrentChildFamilyRows(
  tx: Tx,
  fileUuid: string,
  individualId: string,
): Promise<ChildFamilySyncPayloadRow[]> {
  const fcRows = await tx.gedcomFamilyChild.findMany({
    where: { fileUuid, childId: individualId },
    select: { familyId: true, birthOrder: true },
  });
  const familyIds = fcRows
    .map((r) => r.familyId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (familyIds.length === 0) return [];

  const [famRows, pcRows] = await Promise.all([
    tx.gedcomFamily.findMany({
      where: { fileUuid, id: { in: familyIds } },
      select: { id: true, husbandId: true, wifeId: true },
    }),
    tx.gedcomParentChild.findMany({
      where: { fileUuid, childId: individualId, familyId: { in: familyIds } },
      select: { familyId: true, parentId: true, relationshipType: true, pedigree: true },
    }),
  ]);
  const famById = new Map(famRows.map((f) => [f.id, f]));
  const pcByFamily = new Map<string, { parentId: string; relationshipType: string; pedigree: string | null }[]>();
  for (const r of pcRows) {
    const fid = r.familyId;
    if (!fid) continue;
    const arr = pcByFamily.get(fid) ?? [];
    arr.push({
      parentId: r.parentId,
      relationshipType: (r.relationshipType ?? "biological").trim() || "biological",
      pedigree: r.pedigree?.trim() ? r.pedigree.trim() : null,
    });
    pcByFamily.set(fid, arr);
  }

  return fcRows
    .filter((r): r is typeof r & { familyId: string } => Boolean(r.familyId))
    .map((r) => {
      const fam = famById.get(r.familyId);
      if (!fam) {
        return buildChildFamilySyncRowFromParts(r.familyId, r.birthOrder, { husbandId: null, wifeId: null }, []);
      }
      return buildChildFamilySyncRowFromParts(
        r.familyId,
        r.birthOrder,
        { husbandId: fam.husbandId, wifeId: fam.wifeId },
        pcByFamily.get(r.familyId) ?? [],
      );
    });
}

function mergeChildFamilySyncRowsByFamilyId(
  base: ChildFamilySyncPayloadRow[],
  created: ChildFamilySyncPayloadRow[],
): ChildFamilySyncPayloadRow[] {
  const m = new Map<string, ChildFamilySyncPayloadRow>();
  for (const r of base) m.set(r.familyId, { ...r });
  for (const r of created) {
    const prev = m.get(r.familyId);
    m.set(r.familyId, prev ? { ...prev, ...r } : { ...r });
  }
  return [...m.values()];
}

async function loadChildFamilySyncRowFromDb(
  tx: Tx,
  fileUuid: string,
  childId: string,
  familyId: string,
): Promise<ChildFamilySyncPayloadRow | null> {
  const fc = await tx.gedcomFamilyChild.findFirst({
    where: { fileUuid, familyId, childId },
    select: { birthOrder: true },
  });
  if (!fc) return null;
  const fam = await tx.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { husbandId: true, wifeId: true },
  });
  if (!fam) return null;
  const pcs = await tx.gedcomParentChild.findMany({
    where: { fileUuid, childId, familyId },
    select: { parentId: true, relationshipType: true, pedigree: true },
  });
  const mapped = pcs.map((r) => ({
    parentId: r.parentId,
    relationshipType: (r.relationshipType ?? "biological").trim() || "biological",
    pedigree: r.pedigree?.trim() ? r.pedigree.trim() : null,
  }));
  return buildChildFamilySyncRowFromParts(
    familyId,
    fc.birthOrder,
    { husbandId: fam.husbandId, wifeId: fam.wifeId },
    mapped,
  );
}

function trimPedigreePayload(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
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

/**
 * Allocate FAM xref and create a family with exactly one parent in HUSB or WIFE (from sex via
 * `singleSpouseSlotForFirstParent`). The other slot stays null until a second parent is added later.
 */
export async function createNewFamilyWithSingleParent(ctx: ChangeCtx, parentIndividualId: string): Promise<string> {
  const { tx, fileUuid } = ctx;
  const parent = await tx.gedcomIndividual.findFirst({
    where: { id: parentIndividualId, fileUuid },
    select: { id: true, sex: true },
  });
  if (!parent) throw new Error("Parent individual not found in this tree");

  const slot = singleSpouseSlotForFirstParent(parent.sex);
  const husbandId = slot === "husband" ? parent.id : null;
  const wifeId = slot === "wife" ? parent.id : null;

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

function editorChildFamilyPayloadToSyncRow(
  row: NonNullable<IndividualEditorPayload["familiesAsChild"]>[number],
): ChildFamilySyncPayloadRow {
  const rt = normalizeChildRelationshipType(row.relationshipType ?? "biological");
  const ped = trimPedigreePayload(row.pedigree ?? null);
  const relH =
    row.relationshipToHusband != null && String(row.relationshipToHusband).trim() !== ""
      ? normalizeChildRelationshipType(String(row.relationshipToHusband))
      : rt;
  const relW =
    row.relationshipToWife != null && String(row.relationshipToWife).trim() !== ""
      ? normalizeChildRelationshipType(String(row.relationshipToWife))
      : rt;
  const pedH =
    row.pedigreeToHusband !== undefined ? trimPedigreePayload(row.pedigreeToHusband ?? null) : null;
  const pedW = row.pedigreeToWife !== undefined ? trimPedigreePayload(row.pedigreeToWife ?? null) : null;
  return {
    familyId: row.familyId,
    relationshipType: rt,
    pedigree: ped,
    pedigreeToHusband: pedH,
    pedigreeToWife: pedW,
    birthOrder: row.birthOrder ?? null,
    relationshipToHusband: relH,
    relationshipToWife: relW,
  };
}

export async function createNewChildFamiliesFromNewParentsRecords(
  ctx: ChangeCtx,
  entries: NewChildFamilyFromNewParentsPayload[],
  subjectIndividualId: string,
): Promise<ChildFamilySyncPayloadRow[]> {
  const out: ChildFamilySyncPayloadRow[] = [];
  const { tx, fileUuid } = ctx;
  for (const e of entries) {
    const birthOrder =
      e.birthOrder != null && Number.isFinite(e.birthOrder) ? Math.trunc(e.birthOrder) : null;

    if (e.kind === "single") {
      const s = parseGedcomSex(e.parent.sex);
      if (s == null) {
        throw new Error("New parent sex must be M, F, U, or X");
      }
      if (e.parent.givenNames.length === 0 || !e.parent.surname.trim()) {
        throw new Error("Parent needs given names and a surname");
      }
      const rel = normalizeChildRelationshipType(e.parent.relationshipType);
      const pedN = trimPedigreePayload(e.parent.pedigree ?? e.pedigree ?? null);

      const newParentId = await createMinimalNamedIndividual(
        ctx,
        e.parent.givenNames,
        e.parent.surname.trim(),
        s,
      );

      if (e.linkAsSpouse) {
        const linkFid = e.linkAsSpouse.familyId.trim();
        const existingPid = e.linkAsSpouse.existingParentIndividualId.trim();
        if (!linkFid || !existingPid) {
          throw new Error("linkAsSpouse requires familyId and existingParentIndividualId");
        }
        const fam0 = await tx.gedcomFamily.findFirst({
          where: { id: linkFid, fileUuid },
          select: { id: true, husbandId: true, wifeId: true },
        });
        if (!fam0) throw new Error("Family for linkAsSpouse not found in this tree");
        if (fam0.husbandId !== existingPid && fam0.wifeId !== existingPid) {
          throw new Error("existingParentIndividualId must be the husband or wife in the given family");
        }
        const childRow = await tx.gedcomFamilyChild.findFirst({
          where: { fileUuid, familyId: linkFid, childId: subjectIndividualId },
        });
        if (!childRow) {
          throw new Error(
            "linkAsSpouse requires this person to already be a child of that family (include it in familiesAsChild when creating a new person).",
          );
        }

        const hasBothParents = !!fam0.husbandId && !!fam0.wifeId;
        if (!hasBothParents) {
          await addParentToFamily(ctx, fam0.id, newParentId);
          const refreshed = await loadChildFamilySyncRowFromDb(tx, fileUuid, subjectIndividualId, fam0.id);
          if (!refreshed) {
            throw new Error("Failed to reload child–family row after addParentToFamily");
          }
          out.push(mergePedigreeAndRelForNewParentInFamily(refreshed, fam0, newParentId, rel, pedN));
          continue;
        }

        const newFamId = await createNewFamilyLinkingPair(ctx, existingPid, newParentId);
        const fam = await tx.gedcomFamily.findFirst({
          where: { id: newFamId, fileUuid },
          select: { husbandId: true, wifeId: true },
        });
        if (!fam?.husbandId || !fam?.wifeId) {
          throw new Error("New couple family is missing husband or wife after creation");
        }
        const existingPc = await tx.gedcomParentChild.findFirst({
          where: { fileUuid, childId: subjectIndividualId, parentId: existingPid },
          select: { relationshipType: true, pedigree: true },
        });
        const relExisting = normalizeChildRelationshipType(existingPc?.relationshipType ?? "biological");
        const pedExisting = trimPedigreePayload(existingPc?.pedigree ?? null);
        const relationshipToHusband =
          fam.husbandId === newParentId
            ? rel
            : fam.husbandId === existingPid
              ? relExisting
              : normalizeChildRelationshipType("biological");
        const relationshipToWife =
          fam.wifeId === newParentId
            ? rel
            : fam.wifeId === existingPid
              ? relExisting
              : normalizeChildRelationshipType("biological");
        const pedigreeToHusband =
          fam.husbandId === newParentId ? pedN : fam.husbandId === existingPid ? pedExisting : null;
        const pedigreeToWife =
          fam.wifeId === newParentId ? pedN : fam.wifeId === existingPid ? pedExisting : null;
        out.push({
          familyId: newFamId,
          relationshipType: rel,
          relationshipToHusband,
          relationshipToWife,
          pedigree: pedN ?? pedExisting,
          pedigreeToHusband,
          pedigreeToWife,
          birthOrder,
        });
        continue;
      }

      const famId = await createNewFamilyWithSingleParent(ctx, newParentId);
      const fam = await tx.gedcomFamily.findFirst({
        where: { id: famId, fileUuid },
        select: { husbandId: true, wifeId: true },
      });
      if (!fam) {
        throw new Error("New parental family not found after creation");
      }
      const relationshipToHusband =
        fam.husbandId === newParentId ? rel : normalizeChildRelationshipType("biological");
      const relationshipToWife =
        fam.wifeId === newParentId ? rel : normalizeChildRelationshipType("biological");
      const pedigreeToHusband = fam.husbandId === newParentId ? pedN : null;
      const pedigreeToWife = fam.wifeId === newParentId ? pedN : null;
      out.push({
        familyId: famId,
        relationshipType: rel,
        relationshipToHusband,
        relationshipToWife,
        pedigree: pedN,
        pedigreeToHusband,
        pedigreeToWife,
        birthOrder,
      });
      continue;
    }

    const legacyPed = trimPedigreePayload(e.pedigree ?? null);
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
    const ped1 = trimPedigreePayload(e.parent1.pedigree ?? null) ?? legacyPed;
    const ped2 = trimPedigreePayload(e.parent2.pedigree ?? null) ?? legacyPed;
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
    const pedigreeToHusband = fam.husbandId === p1 ? ped1 : ped2;
    const pedigreeToWife = fam.wifeId === p1 ? ped1 : ped2;
    out.push({
      familyId: famId,
      relationshipType,
      relationshipToHusband,
      relationshipToWife,
      pedigree: ped1 ?? ped2,
      pedigreeToHusband,
      pedigreeToWife,
      birthOrder,
    });
  }
  return out;
}

/** After addParentToFamily, overlay form relationship + pedigree for the new parent’s slot only. */
function mergePedigreeAndRelForNewParentInFamily(
  row: ChildFamilySyncPayloadRow,
  fam: { husbandId: string | null; wifeId: string | null },
  newParentId: string,
  relNew: string,
  pedNew: string | null,
): ChildFamilySyncPayloadRow {
  const isH = fam.husbandId === newParentId;
  const isW = fam.wifeId === newParentId;
  return {
    ...row,
    relationshipType: isH || isW ? relNew : row.relationshipType,
    relationshipToHusband: isH ? relNew : row.relationshipToHusband,
    relationshipToWife: isW ? relNew : row.relationshipToWife,
    pedigreeToHusband: isH ? pedNew : row.pedigreeToHusband,
    pedigreeToWife: isW ? pedNew : row.pedigreeToWife,
    pedigree: pedNew ?? row.pedigree,
  };
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

  let childPayload: ChildFamilySyncPayloadRow[] | undefined;
  if (payload.newChildFamiliesFromNewParents && payload.newChildFamiliesFromNewParents.length > 0) {
    const createdRows = await createNewChildFamiliesFromNewParentsRecords(
      ctx,
      payload.newChildFamiliesFromNewParents,
      individualId,
    );
    const baseRows =
      payload.familiesAsChild != null
        ? payload.familiesAsChild.map(editorChildFamilyPayloadToSyncRow)
        : await loadCurrentChildFamilyRows(tx, fileUuid, individualId);
    childPayload = mergeChildFamilySyncRowsByFamilyId(baseRows, createdRows);
  } else if (payload.familiesAsChild) {
    childPayload = payload.familiesAsChild.map(editorChildFamilyPayloadToSyncRow);
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
 * a GEDCOM 5.5-style XREF such as `@I123@`, `@F456@`, or `@S7@` (sources use prefix S).
 */
async function generateNextXref(tx: Tx, fileUuid: string, objectType: "INDI" | "FAM" | "SOUR"): Promise<string> {
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

/** Server-allocated source XREF (`@S…@`); never accept client-supplied xrefs for new sources. */
export async function allocateNewSourceXref(tx: Tx, fileUuid: string): Promise<string> {
  return generateNextXref(tx, fileUuid, "SOUR");
}

/** Insert the XREF → record mapping into `gedcom_file_objects` (the router table). */
export async function registerXrefInFileObjects(
  tx: Tx,
  fileUuid: string,
  xref: string,
  objectType: "INDI" | "FAM" | "SOUR",
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
  const needsPriorChildSyncForSpouseLink =
    newChildFromParents.some((e) => e.kind === "single" && e.linkAsSpouse) && childLinks.length > 0;
  if (needsPriorChildSyncForSpouseLink) {
    await syncIndividualChildFamilies(
      ctx,
      ind.id,
      childLinks.map(editorChildFamilyPayloadToSyncRow),
    );
  }
  const fromNewParents = await createNewChildFamiliesFromNewParentsRecords(
    ctx,
    newChildFromParents,
    ind.id,
  );
  const baseChildSync = childLinks.map(editorChildFamilyPayloadToSyncRow);
  const allChild = mergeChildFamilySyncRowsByFamilyId(baseChildSync, fromNewParents);
  if (allChild.length > 0) {
    await syncIndividualChildFamilies(ctx, ind.id, allChild);
  }
  if (allSpouse.length > 0 || allChild.length > 0) {
    await recomputeIndividualFamilyFlags(ctx, ind.id);
  }

  return ind.id;
}
