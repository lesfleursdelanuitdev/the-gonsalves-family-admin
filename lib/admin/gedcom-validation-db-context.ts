/**
 * Resolves GEDCOM xrefs from validator findings to admin-tree DB rows and link counts.
 */

import { prisma } from "@/lib/database/prisma";

export type ApiFindingLike = {
  Xref?: string;
  RelatedXref?: string;
  /** From ligneous-gedcom-lib `ValidationError.AssociatedXrefs` — all xrefs implicated by the rule. */
  AssociatedXrefs?: string[];
  Details?: Record<string, string> | null;
};

/** Collect distinct xref pointers from a lib-api validation row. */
export function collectXrefsFromFinding(finding: ApiFindingLike): string[] {
  const out: string[] = [];
  const push = (s: string | undefined | null) => {
    const t = (s ?? "").trim();
    if (!t || !t.startsWith("@")) return;
    if (!out.includes(t)) out.push(t);
  };
  push(finding.Xref);
  push(finding.RelatedXref);
  if (Array.isArray(finding.AssociatedXrefs)) {
    for (const x of finding.AssociatedXrefs) {
      push(x);
    }
  }
  const d = finding.Details;
  if (d) {
    for (const k of ["pointer", "parent", "child", "husb_xref", "wife_xref", "family", "target"] as const) {
      push(d[k]);
    }
  }
  return out;
}

export type IndividualDbContext = {
  kind: "individual";
  id: string;
  xref: string;
  summary: {
    fullName: string | null;
    sex: string | null;
    birthYear: number | null;
    deathYear: number | null;
    isLiving: boolean;
  };
  links: {
    familiesAsSpouse: { id: string; xref: string }[];
    familiesAsChild: { id: string; xref: string }[];
    spouseEdgeCount: number;
    parentChildAsParentCount: number;
    parentChildAsChildCount: number;
    familyChildRowCount: number;
    individualEventCount: number;
    individualNoteCount: number;
    individualSourceCount: number;
    associationAsSubjectCount: number;
    associationAsAssociateCount: number;
    individualMediaCount: number;
    familyPartnerRowCount: number;
  };
};

export type FamilyDbContext = {
  kind: "family";
  id: string;
  xref: string;
  summary: {
    husbandXref: string | null;
    wifeXref: string | null;
    marriageYear: number | null;
    childrenCount: number;
  };
  links: {
    familyChildCount: number;
    familyPartnerCount: number;
    spouseEdgeCount: number;
    parentChildCount: number;
    familyEventCount: number;
    familyNoteCount: number;
    familySourceCount: number;
    familyMediaCount: number;
  };
};

export type SourceDbContext = {
  kind: "source";
  id: string;
  xref: string;
  summary: { title: string | null; author: string | null };
  links: { individualSourceCount: number; familySourceCount: number; eventSourceCount: number; sourceNoteCount: number };
};

export type NoteDbContext = {
  kind: "note";
  id: string;
  xref: string | null;
  summary: { isTopLevel: boolean; contentPreview: string };
  links: {
    individualNoteCount: number;
    familyNoteCount: number;
    eventNoteCount: number;
    sourceNoteCount: number;
  };
};

export type ValidationDbContextResponse = {
  fileUuid: string;
  records: Array<IndividualDbContext | FamilyDbContext | SourceDbContext | NoteDbContext>;
  xrefsNotInDatabase: string[];
};

async function buildIndividualContext(fileUuid: string, id: string, xref: string): Promise<IndividualDbContext> {
  const indi = await prisma.gedcomIndividual.findFirst({
    where: { id, fileUuid },
    select: {
      fullName: true,
      sex: true,
      birthYear: true,
      deathYear: true,
      isLiving: true,
    },
  });
  const [
    spouseFamilies,
    childFamilies,
    spouseEdgeCount,
    parentChildAsParentCount,
    parentChildAsChildCount,
    familyChildRowCount,
    individualEventCount,
    individualNoteCount,
    individualSourceCount,
    associationAsSubjectCount,
    associationAsAssociateCount,
    individualMediaCount,
    familyPartnerRowCount,
  ] = await Promise.all([
    prisma.gedcomFamily.findMany({
      where: { fileUuid, OR: [{ husbandId: id }, { wifeId: id }] },
      select: { id: true, xref: true },
    }),
    prisma.gedcomFamilyChild.findMany({
      where: { fileUuid, childId: id },
      select: { family: { select: { id: true, xref: true } } },
    }),
    prisma.gedcomSpouse.count({ where: { fileUuid, OR: [{ individualId: id }, { spouseId: id }] } }),
    prisma.gedcomParentChild.count({ where: { fileUuid, parentId: id } }),
    prisma.gedcomParentChild.count({ where: { fileUuid, childId: id } }),
    prisma.gedcomFamilyChild.count({ where: { fileUuid, childId: id } }),
    prisma.gedcomIndividualEvent.count({ where: { fileUuid, individualId: id } }),
    prisma.gedcomIndividualNote.count({ where: { fileUuid, individualId: id } }),
    prisma.gedcomIndividualSource.count({ where: { fileUuid, individualId: id } }),
    prisma.gedcomIndividualAssociation.count({ where: { fileUuid, subjectIndividualId: id } }),
    prisma.gedcomIndividualAssociation.count({ where: { fileUuid, associateIndividualId: id } }),
    prisma.gedcomIndividualMedia.count({ where: { fileUuid, individualId: id } }),
    prisma.gedcomFamilyPartner.count({ where: { fileUuid, individualId: id } }),
  ]);

  return {
    kind: "individual",
    id,
    xref,
    summary: {
      fullName: indi?.fullName ?? null,
      sex: indi?.sex != null ? String(indi.sex) : null,
      birthYear: indi?.birthYear ?? null,
      deathYear: indi?.deathYear ?? null,
      isLiving: indi?.isLiving ?? true,
    },
    links: {
      familiesAsSpouse: spouseFamilies.map((f) => ({ id: f.id, xref: f.xref })),
      familiesAsChild: childFamilies.map((r) => ({ id: r.family.id, xref: r.family.xref })),
      spouseEdgeCount,
      parentChildAsParentCount,
      parentChildAsChildCount,
      familyChildRowCount,
      individualEventCount,
      individualNoteCount,
      individualSourceCount,
      associationAsSubjectCount,
      associationAsAssociateCount,
      individualMediaCount,
      familyPartnerRowCount,
    },
  };
}

async function buildFamilyContext(fileUuid: string, id: string, xref: string): Promise<FamilyDbContext> {
  const fam = await prisma.gedcomFamily.findFirst({
    where: { id, fileUuid },
    select: {
      husbandXref: true,
      wifeXref: true,
      marriageYear: true,
      childrenCount: true,
    },
  });
  const [
    familyChildCount,
    familyPartnerCount,
    spouseEdgeCount,
    parentChildCount,
    familyEventCount,
    familyNoteCount,
    familySourceCount,
    familyMediaCount,
  ] = await Promise.all([
    prisma.gedcomFamilyChild.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomFamilyPartner.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomSpouse.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomParentChild.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomFamilyEvent.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomFamilyNote.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomFamilySource.count({ where: { fileUuid, familyId: id } }),
    prisma.gedcomFamilyMedia.count({ where: { fileUuid, familyId: id } }),
  ]);

  return {
    kind: "family",
    id,
    xref,
    summary: {
      husbandXref: fam?.husbandXref ?? null,
      wifeXref: fam?.wifeXref ?? null,
      marriageYear: fam?.marriageYear ?? null,
      childrenCount: fam?.childrenCount ?? 0,
    },
    links: {
      familyChildCount,
      familyPartnerCount,
      spouseEdgeCount,
      parentChildCount,
      familyEventCount,
      familyNoteCount,
      familySourceCount,
      familyMediaCount,
    },
  };
}

async function buildSourceContext(fileUuid: string, id: string, xref: string): Promise<SourceDbContext> {
  const src = await prisma.gedcomSource.findFirst({
    where: { id, fileUuid },
    select: { title: true, author: true },
  });
  const [individualSourceCount, familySourceCount, eventSourceCount, sourceNoteCount] = await Promise.all([
    prisma.gedcomIndividualSource.count({ where: { fileUuid, sourceId: id } }),
    prisma.gedcomFamilySource.count({ where: { fileUuid, sourceId: id } }),
    prisma.gedcomEventSource.count({ where: { fileUuid, sourceId: id } }),
    prisma.gedcomSourceNote.count({ where: { fileUuid, sourceId: id } }),
  ]);
  return {
    kind: "source",
    id,
    xref,
    summary: { title: src?.title ?? null, author: src?.author ?? null },
    links: { individualSourceCount, familySourceCount, eventSourceCount, sourceNoteCount },
  };
}

async function buildNoteContext(fileUuid: string, id: string, xref: string | null): Promise<NoteDbContext> {
  const note = await prisma.gedcomNote.findFirst({
    where: { id, fileUuid },
    select: { xref: true, isTopLevel: true, content: true },
  });
  const preview = (note?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const [individualNoteCount, familyNoteCount, eventNoteCount, sourceNoteCount] = await Promise.all([
    prisma.gedcomIndividualNote.count({ where: { fileUuid, noteId: id } }),
    prisma.gedcomFamilyNote.count({ where: { fileUuid, noteId: id } }),
    prisma.gedcomEventNote.count({ where: { fileUuid, noteId: id } }),
    prisma.gedcomSourceNote.count({ where: { fileUuid, noteId: id } }),
  ]);
  return {
    kind: "note",
    id,
    xref: note?.xref ?? xref,
    summary: { isTopLevel: note?.isTopLevel ?? false, contentPreview: preview },
    links: { individualNoteCount, familyNoteCount, eventNoteCount, sourceNoteCount },
  };
}

export async function buildValidationDbContext(fileUuid: string, xrefs: string[]): Promise<ValidationDbContextResponse> {
  const unique = [...new Set(xrefs.map((x) => x.trim()).filter(Boolean))];
  const records: ValidationDbContextResponse["records"] = [];
  const seen = new Set<string>();

  const individuals = await prisma.gedcomIndividual.findMany({
    where: { fileUuid, xref: { in: unique } },
    select: { id: true, xref: true },
  });
  for (const row of individuals) {
    seen.add(row.xref);
    records.push(await buildIndividualContext(fileUuid, row.id, row.xref));
  }

  const families = await prisma.gedcomFamily.findMany({
    where: { fileUuid, xref: { in: unique } },
    select: { id: true, xref: true },
  });
  for (const row of families) {
    seen.add(row.xref);
    records.push(await buildFamilyContext(fileUuid, row.id, row.xref));
  }

  const sources = await prisma.gedcomSource.findMany({
    where: { fileUuid, xref: { in: unique } },
    select: { id: true, xref: true },
  });
  for (const row of sources) {
    seen.add(row.xref);
    records.push(await buildSourceContext(fileUuid, row.id, row.xref));
  }

  for (const x of unique) {
    if (seen.has(x)) continue;
    const note = await prisma.gedcomNote.findFirst({
      where: { fileUuid, xref: x },
      select: { id: true, xref: true },
    });
    if (note) {
      seen.add(x);
      records.push(await buildNoteContext(fileUuid, note.id, note.xref));
    }
  }

  const xrefsNotInDatabase = unique.filter((x) => !seen.has(x));
  return { fileUuid, records, xrefsNotInDatabase };
}
