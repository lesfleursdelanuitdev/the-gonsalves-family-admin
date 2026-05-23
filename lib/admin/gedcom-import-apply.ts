/**
 * Executes the persisted resolutions from a GEDCOM import merge plan.
 * - create_new: inserts GedcomIndividual + name forms + events + notes + sources
 * - merge_into_existing: additively merges events/notes/sources into the existing individual
 * - skip / mark_not_match: no-op
 * After processing individuals, creates family relationships between resolved individuals.
 */
import { GedcomDateType, Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { findOrCreateGedcomDate, findOrCreateGedcomPlace } from "./admin-event-create";
import {
  allocateNewFamilyXref,
  allocateNewIndividualXref,
  registerXrefInFileObjects,
} from "./admin-individual-editor-apply";
import {
  canonicalSpouseSlotsForPair,
  findExistingCoupleFamilyId,
  recomputeIndividualFamilyFlags,
  rebuildSpouseRowsForFamily,
  singleSpouseSlotForFirstParent,
  syncFamilySpouseXrefs,
} from "./admin-individual-families";
import { syncIndividualNameForms } from "./admin-individual-names";
import { addChildToFamily } from "./admin-family-membership";
import { computeIsLiving } from "./admin-individual-living";
import { eventLabelFor } from "../gedcom/event-catalog-label";
import { newBatchId } from "./changelog";
import type { ChangeCtx } from "./changelog";
import { effectiveResolution } from "./gedcom-import-merge-plan";
import type { ImportMergePlan, ImportResolution } from "./gedcom-import-merge-plan";

type Tx = Prisma.TransactionClient;

// ── Enriched document types ───────────────────────────────────────────────────

type EnrichedDate = {
  id: string; original: string; type: string; calendar: string;
  year: number; month: number; day: number;
  end_year: number; end_month: number; end_day: number;
};

type EnrichedPlace = {
  id: string; original: string; name: string; county: string;
  state: string; country: string; latitude: number; longitude: number;
};

type EnrichedIndividual = {
  id: string; xref: string; full_name: string; sex: string;
  birth_date_index: number; birth_place_index: number;
  death_date_index: number; death_place_index: number;
};

type EnrichedFamily = { id: string; xref: string; husband_xref: string; wife_xref: string };

type EnrichedEvent = {
  id: string; index: number; event_type: string; custom_type: string;
  date_index: number; place_index: number;
  value: string; cause: string; agency: string; sort_order: number;
};

type EnrichedNote = { id: string; xref: string; content: string; is_top_level: boolean };

type EnrichedSource = {
  id: string; xref: string; title: string; author: string;
  abbreviation: string; publication: string; text: string;
  repository_xref: string; call_number: string;
};

type EnrichedAttribute = {
  id: string; index: number; attribute_type: string; custom_type: string;
  value: string; date_index: number; place_index: number;
  agency: string; owner_xref: string; owner_type: string; sort_order: number;
};

type EnrichedResidence = {
  id: string; index: number; address: string;
  date_index: number; place_index: number;
  owner_xref: string; owner_type: string; sort_order: number;
};

type EnrichedIndividualEvent = { individual_xref: string; event_index: number; role: string };
type EnrichedIndividualNote = { individual_xref: string; note_index: number };
type EnrichedIndividualSource = {
  individual_xref: string; source_index: number;
  page: string; quality: number; citation_text: string;
};

type EnrichedIndividualAttribute = { individual_xref: string; attribute_index: number };
type EnrichedFamilyAttribute = { family_xref: string; attribute_index: number };
type EnrichedIndividualResidence = { individual_xref: string; residence_index: number };
type EnrichedFamilyResidence = { family_xref: string; residence_index: number };

type EnrichedNameForm = {
  id: string; individual_xref: string; name_type: string;
  is_primary: boolean; sort_order: number;
};
type EnrichedNameFormGivenName = { name_form_index: number; given_name_index: number; position: number };
type EnrichedNameFormSurname = { name_form_index: number; surname_index: number; position: number };
type EnrichedGivenName = { id: string; value: string; lower: string };
type EnrichedSurname = { id: string; value: string; lower: string };
type EnrichedFamilyChild = { family_xref: string; child_xref: string; birth_order: number };
type EnrichedParentChild = {
  parent_xref: string; child_xref: string; family_xref: string;
  relationship_type: string; pedigree: string;
};

type EnrichedDoc = {
  Individuals: EnrichedIndividual[];
  Families: EnrichedFamily[];
  Dates: EnrichedDate[];
  Places: EnrichedPlace[];
  GivenNames: EnrichedGivenName[];
  Surnames: EnrichedSurname[];
  Events: EnrichedEvent[];
  Attributes: EnrichedAttribute[];
  Residences: EnrichedResidence[];
  Notes: EnrichedNote[];
  Sources: EnrichedSource[];
  IndividualEvents: EnrichedIndividualEvent[];
  IndividualNotes: EnrichedIndividualNote[];
  IndividualSources: EnrichedIndividualSource[];
  IndividualAttributes: EnrichedIndividualAttribute[];
  FamilyAttributes: EnrichedFamilyAttribute[];
  IndividualResidences: EnrichedIndividualResidence[];
  FamilyResidences: EnrichedFamilyResidence[];
  NameForms: EnrichedNameForm[];
  NameFormGivenNames: EnrichedNameFormGivenName[];
  NameFormSurnames: EnrichedNameFormSurname[];
  FamilyChildren: EnrichedFamilyChild[];
  ParentChild: EnrichedParentChild[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function parseEnrichedDoc(snap: unknown): EnrichedDoc | null {
  if (!snap || typeof snap !== "object") return null;
  const enriched = (snap as Record<string, unknown>).enriched;
  if (!enriched || typeof enriched !== "object") return null;
  const e = enriched as Record<string, unknown>;
  return {
    Individuals: asArray<EnrichedIndividual>(e.Individuals),
    Families: asArray<EnrichedFamily>(e.Families),
    Dates: asArray<EnrichedDate>(e.Dates),
    Places: asArray<EnrichedPlace>(e.Places),
    GivenNames: asArray<EnrichedGivenName>(e.GivenNames),
    Surnames: asArray<EnrichedSurname>(e.Surnames),
    Events: asArray<EnrichedEvent>(e.Events),
    Attributes: asArray<EnrichedAttribute>(e.Attributes),
    Residences: asArray<EnrichedResidence>(e.Residences),
    Notes: asArray<EnrichedNote>(e.Notes),
    Sources: asArray<EnrichedSource>(e.Sources),
    IndividualEvents: asArray<EnrichedIndividualEvent>(e.IndividualEvents),
    IndividualNotes: asArray<EnrichedIndividualNote>(e.IndividualNotes),
    IndividualSources: asArray<EnrichedIndividualSource>(e.IndividualSources),
    IndividualAttributes: asArray<EnrichedIndividualAttribute>(e.IndividualAttributes),
    FamilyAttributes: asArray<EnrichedFamilyAttribute>(e.FamilyAttributes),
    IndividualResidences: asArray<EnrichedIndividualResidence>(e.IndividualResidences),
    FamilyResidences: asArray<EnrichedFamilyResidence>(e.FamilyResidences),
    NameForms: asArray<EnrichedNameForm>(e.NameForms),
    NameFormGivenNames: asArray<EnrichedNameFormGivenName>(e.NameFormGivenNames),
    NameFormSurnames: asArray<EnrichedNameFormSurname>(e.NameFormSurnames),
    FamilyChildren: asArray<EnrichedFamilyChild>(e.FamilyChildren),
    ParentChild: asArray<EnrichedParentChild>(e.ParentChild),
  };
}

function toGedcomDateType(raw: string): GedcomDateType {
  const u = (raw ?? "").toUpperCase().trim();
  if (Object.values(GedcomDateType).includes(u as GedcomDateType)) return u as GedcomDateType;
  return GedcomDateType.EXACT;
}

async function findOrCreateDateFromEnriched(tx: Tx, fileUuid: string, d: EnrichedDate): Promise<string> {
  return findOrCreateGedcomDate(tx, fileUuid, {
    dateType: toGedcomDateType(d.type),
    original: d.original || null,
    calendar: d.calendar || "GREGORIAN",
    year: d.year || null, month: d.month || null, day: d.day || null,
    endYear: d.end_year || null, endMonth: d.end_month || null, endDay: d.end_day || null,
  });
}

async function findOrCreatePlaceFromEnriched(tx: Tx, fileUuid: string, p: EnrichedPlace): Promise<string> {
  return findOrCreateGedcomPlace(tx, fileUuid, {
    original: p.original || "",
    name: p.name || null, county: p.county || null,
    state: p.state || null, country: p.country || null,
    latitude: p.latitude ? new Prisma.Decimal(p.latitude) : null,
    longitude: p.longitude ? new Prisma.Decimal(p.longitude) : null,
  });
}

function parseSex(raw: string): "M" | "F" | "U" | "X" | null {
  const s = (raw ?? "").toUpperCase();
  return (s === "M" || s === "F" || s === "U" || s === "X") ? s : null;
}

function splitFullName(fullName: string): { givenNames: string[]; surnames: string[] } {
  const idx = fullName.indexOf(" / ");
  if (idx >= 0) {
    const g = fullName.slice(0, idx).trim();
    const s = fullName.slice(idx + 3).trim();
    return { givenNames: g ? [g] : [], surnames: s ? [s] : [] };
  }
  return { givenNames: fullName.trim() ? [fullName.trim()] : [], surnames: [] };
}

// ── Event creation (shared between create_new and merge_into_existing) ────────

async function createEventFromEnriched(
  tx: Tx,
  fileUuid: string,
  individualId: string,
  event: EnrichedEvent,
  role: string,
  doc: EnrichedDoc,
): Promise<{ eventId: string; eventType: string; dateId: string | null; placeId: string | null }> {
  const enrichedDate = event.date_index >= 0 ? doc.Dates[event.date_index] : undefined;
  const enrichedPlace = event.place_index >= 0 ? doc.Places[event.place_index] : undefined;
  const dateId = enrichedDate ? await findOrCreateDateFromEnriched(tx, fileUuid, enrichedDate) : null;
  const placeId = enrichedPlace ? await findOrCreatePlaceFromEnriched(tx, fileUuid, enrichedPlace) : null;

  const ev = await tx.gedcomEvent.create({
    data: {
      fileUuid,
      eventType: event.event_type || "EVEN",
      customType: event.custom_type || null,
      eventLabel: eventLabelFor(event.event_type || "EVEN", event.custom_type || ""),
      dateId, placeId,
      value: event.value?.trim() || null,
      cause: event.cause?.trim() || null,
      agency: event.agency?.trim() || null,
      sortOrder: event.sort_order ?? 0,
    },
  });
  await tx.gedcomIndividualEvent.create({
    data: { fileUuid, individualId, eventId: ev.id, role: role || "principal" },
  });
  return { eventId: ev.id, eventType: event.event_type, dateId, placeId };
}

// ── Attribute creation ────────────────────────────────────────────────────────

async function createAttributeFromEnriched(
  tx: Tx,
  fileUuid: string,
  attr: EnrichedAttribute,
  doc: EnrichedDoc,
): Promise<string> {
  const enrichedDate = attr.date_index >= 0 ? doc.Dates[attr.date_index] : undefined;
  const enrichedPlace = attr.place_index >= 0 ? doc.Places[attr.place_index] : undefined;
  const dateId = enrichedDate ? await findOrCreateDateFromEnriched(tx, fileUuid, enrichedDate) : null;
  const placeId = enrichedPlace ? await findOrCreatePlaceFromEnriched(tx, fileUuid, enrichedPlace) : null;
  const a = await tx.gedcomAttribute.create({
    data: {
      fileUuid,
      attributeType: attr.attribute_type || "FACT",
      customType: attr.custom_type || null,
      value: attr.value?.trim() || null,
      dateId, placeId,
      agency: attr.agency?.trim() || null,
      sortOrder: attr.sort_order ?? 0,
    },
  });
  return a.id;
}

async function createResidenceFromEnriched(
  tx: Tx,
  fileUuid: string,
  res: EnrichedResidence,
  doc: EnrichedDoc,
): Promise<string> {
  const enrichedDate = res.date_index >= 0 ? doc.Dates[res.date_index] : undefined;
  const enrichedPlace = res.place_index >= 0 ? doc.Places[res.place_index] : undefined;
  const dateId = enrichedDate ? await findOrCreateDateFromEnriched(tx, fileUuid, enrichedDate) : null;
  const placeId = enrichedPlace ? await findOrCreatePlaceFromEnriched(tx, fileUuid, enrichedPlace) : null;
  const r = await tx.gedcomResidence.create({
    data: {
      fileUuid,
      address: res.address?.trim() || null,
      dateId, placeId,
      sortOrder: res.sort_order ?? 0,
    },
  });
  return r.id;
}

// ── Note creation ─────────────────────────────────────────────────────────────

async function findOrCreateNote(tx: Tx, fileUuid: string, content: string): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note content is empty");
  const existing = await tx.gedcomNote.findFirst({
    where: { fileUuid, content: trimmed },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.gedcomNote.create({
    data: { fileUuid, content: trimmed, isTopLevel: false },
  });
  return created.id;
}

async function linkNoteToIndividual(
  tx: Tx,
  fileUuid: string,
  individualId: string,
  noteId: string,
): Promise<boolean> {
  const exists = await tx.gedcomIndividualNote.findFirst({
    where: { fileUuid, individualId, noteId },
  });
  if (exists) return false;
  await tx.gedcomIndividualNote.create({
    data: { fileUuid, individualId, noteId },
  });
  return true;
}

// ── Source creation ───────────────────────────────────────────────────────────

async function findOrCreateSourceFromEnriched(
  tx: Tx,
  fileUuid: string,
  s: EnrichedSource,
): Promise<string> {
  // Match by xref first, then by title+author
  if (s.xref) {
    const byXref = await tx.gedcomSource.findFirst({ where: { fileUuid, xref: s.xref }, select: { id: true } });
    if (byXref) return byXref.id;
  }
  const title = s.title?.trim() || null;
  const author = s.author?.trim() || null;
  if (title) {
    const byTitle = await tx.gedcomSource.findFirst({
      where: { fileUuid, title, author: author ?? undefined },
      select: { id: true },
    });
    if (byTitle) return byTitle.id;
  }
  const xref = s.xref?.trim() || `@S_import_${crypto.randomUUID().slice(0, 8).toUpperCase()}@`;
  const created = await tx.gedcomSource.create({
    data: {
      fileUuid, xref,
      title, author,
      abbreviation: s.abbreviation?.trim() || null,
      publication: s.publication?.trim() || null,
      text: s.text?.trim() || null,
      repositoryXref: s.repository_xref?.trim() || null,
      callNumber: s.call_number?.trim() || null,
    },
  });
  return created.id;
}

async function linkSourceToIndividual(
  tx: Tx,
  fileUuid: string,
  individualId: string,
  sourceId: string,
  citation: { page: string; quality: number; citation_text: string },
): Promise<boolean> {
  const exists = await tx.gedcomIndividualSource.findFirst({
    where: { fileUuid, individualId, sourceId },
  });
  if (exists) return false;
  await tx.gedcomIndividualSource.create({
    data: {
      fileUuid, individualId, sourceId,
      page: citation.page?.trim() || null,
      quality: citation.quality ?? 0,
      citationText: citation.citation_text?.trim() || null,
    },
  });
  return true;
}

// ── Core individual creation ──────────────────────────────────────────────────

async function createIndividualFromEnriched(
  ctx: ChangeCtx,
  doc: EnrichedDoc,
  importIndi: EnrichedIndividual,
): Promise<string> {
  const { tx, fileUuid } = ctx;
  const xref = await allocateNewIndividualXref(tx, fileUuid);
  const sex = parseSex(importIndi.sex);

  const ind = await tx.gedcomIndividual.create({
    data: {
      fileUuid, xref,
      fullName: importIndi.full_name || "Unknown",
      fullNameLower: (importIndi.full_name || "Unknown").toLowerCase(),
      sex, isLiving: true,
    },
  });
  await registerXrefInFileObjects(tx, fileUuid, xref, "INDI", ind.id);

  // ── Name forms ──────────────────────────────────────────────────────────────
  const nameForms: Parameters<typeof syncIndividualNameForms>[2] = [];
  for (let nfIdx = 0; nfIdx < doc.NameForms.length; nfIdx++) {
    const nf = doc.NameForms[nfIdx];
    if (nf.individual_xref !== importIndi.xref) continue;
    const givenNames = doc.NameFormGivenNames.filter((g) => g.name_form_index === nfIdx)
      .sort((a, b) => a.position - b.position)
      .map((g) => doc.GivenNames[g.given_name_index]?.value)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const surnames = doc.NameFormSurnames.filter((s) => s.name_form_index === nfIdx)
      .sort((a, b) => a.position - b.position)
      .map((s) => doc.Surnames[s.surname_index]?.value)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (givenNames.length === 0 && surnames.length === 0) continue;
    nameForms.push({
      role: nf.is_primary ? "primary" : "alias",
      givenNames,
      surnames: surnames.map((s) => ({ text: s, pieceType: null })),
      aliasNameType: nf.is_primary ? undefined : nf.name_type || "aka",
    });
  }
  if (nameForms.length === 0 && importIndi.full_name) {
    const { givenNames, surnames } = splitFullName(importIndi.full_name);
    if (givenNames.length > 0 || surnames.length > 0) {
      nameForms.push({ role: "primary", givenNames, surnames: surnames.map((s) => ({ text: s, pieceType: null })) });
    }
  }
  if (nameForms.length > 0) await syncIndividualNameForms(ctx, ind.id, nameForms);

  // ── Events ──────────────────────────────────────────────────────────────────
  let birthDateId: string | null = null;
  let birthPlaceId: string | null = null;
  let deathDateId: string | null = null;
  let deathPlaceId: string | null = null;
  let birthYear: number | null = null;

  for (const ieLink of doc.IndividualEvents.filter((ie) => ie.individual_xref === importIndi.xref)) {
    const event = doc.Events[ieLink.event_index];
    if (!event) continue;
    const enrichedDate = event.date_index >= 0 ? doc.Dates[event.date_index] : undefined;
    if (!enrichedDate && !(event.place_index >= 0 && doc.Places[event.place_index]) && !event.value?.trim() && !event.cause?.trim()) continue;

    const { dateId, placeId } = await createEventFromEnriched(tx, fileUuid, ind.id, event, ieLink.role, doc);

    if (event.event_type === "BIRT") {
      birthDateId = dateId; birthPlaceId = placeId;
      if (enrichedDate) birthYear = enrichedDate.year || null;
    } else if (event.event_type === "DEAT") {
      deathDateId = dateId; deathPlaceId = placeId;
    }
  }

  const deathKnown = deathDateId != null || deathPlaceId != null;
  const isLiving = computeIsLiving({ livingMode: "auto", deathKnown, birthYear, birthMonth: null, birthDay: null });
  await tx.gedcomIndividual.update({
    where: { id: ind.id },
    data: { isLiving, birthDateId, birthPlaceId, deathDateId, deathPlaceId, birthYear },
  });

  // ── Attributes ──────────────────────────────────────────────────────────────
  for (const iaLink of doc.IndividualAttributes.filter((ia) => ia.individual_xref === importIndi.xref)) {
    const attr = doc.Attributes[iaLink.attribute_index];
    if (!attr) continue;
    const attrId = await createAttributeFromEnriched(tx, fileUuid, attr, doc);
    await tx.gedcomIndividualAttribute.create({
      data: { fileUuid, individualId: ind.id, attributeId: attrId },
    });
  }

  // ── Residences ──────────────────────────────────────────────────────────────
  for (const irLink of doc.IndividualResidences.filter((ir) => ir.individual_xref === importIndi.xref)) {
    const res = doc.Residences[irLink.residence_index];
    if (!res) continue;
    const resId = await createResidenceFromEnriched(tx, fileUuid, res, doc);
    await tx.gedcomIndividualResidence.create({
      data: { fileUuid, individualId: ind.id, residenceId: resId },
    });
  }

  // ── Notes ───────────────────────────────────────────────────────────────────
  for (const inLink of doc.IndividualNotes.filter((n) => n.individual_xref === importIndi.xref)) {
    const note = doc.Notes[inLink.note_index];
    if (!note?.content?.trim()) continue;
    const noteId = await findOrCreateNote(tx, fileUuid, note.content);
    await linkNoteToIndividual(tx, fileUuid, ind.id, noteId);
  }

  // ── Sources ─────────────────────────────────────────────────────────────────
  for (const isLink of doc.IndividualSources.filter((s) => s.individual_xref === importIndi.xref)) {
    const source = doc.Sources[isLink.source_index];
    if (!source) continue;
    const sourceId = await findOrCreateSourceFromEnriched(tx, fileUuid, source);
    await linkSourceToIndividual(tx, fileUuid, ind.id, sourceId, isLink);
  }

  return ind.id;
}

// ── Merge into existing ───────────────────────────────────────────────────────

async function mergeImportIntoExisting(
  tx: Tx,
  fileUuid: string,
  existingId: string,
  importIndi: EnrichedIndividual,
  doc: EnrichedDoc,
): Promise<void> {
  // Load existing individual's events to detect duplicates
  const existingEvents = await tx.gedcomIndividualEvent.findMany({
    where: { fileUuid, individualId: existingId },
    include: { event: { select: { eventType: true, dateId: true, placeId: true } } },
  });
  const existingEventKeys = new Set(
    existingEvents.map((e) => `${e.event.eventType}|${e.event.dateId ?? ""}|${e.event.placeId ?? ""}`),
  );

  // Merge events additively (skip duplicates by type + date + place)
  for (const ieLink of doc.IndividualEvents.filter((ie) => ie.individual_xref === importIndi.xref)) {
    const event = doc.Events[ieLink.event_index];
    if (!event) continue;

    const enrichedDate = event.date_index >= 0 ? doc.Dates[event.date_index] : undefined;
    const enrichedPlace = event.place_index >= 0 ? doc.Places[event.place_index] : undefined;
    if (!enrichedDate && !enrichedPlace && !event.value?.trim() && !event.cause?.trim()) continue;

    // Resolve date/place first to check for duplicates
    const dateId = enrichedDate ? await findOrCreateDateFromEnriched(tx, fileUuid, enrichedDate) : null;
    const placeId = enrichedPlace ? await findOrCreatePlaceFromEnriched(tx, fileUuid, enrichedPlace) : null;

    const key = `${event.event_type}|${dateId ?? ""}|${placeId ?? ""}`;
    if (existingEventKeys.has(key)) continue;

    const ev = await tx.gedcomEvent.create({
      data: {
        fileUuid,
        eventType: event.event_type || "EVEN",
        customType: event.custom_type || null,
        eventLabel: eventLabelFor(event.event_type || "EVEN", event.custom_type || ""),
        dateId, placeId,
        value: event.value?.trim() || null,
        cause: event.cause?.trim() || null,
        agency: event.agency?.trim() || null,
        sortOrder: event.sort_order ?? 0,
      },
    });
    await tx.gedcomIndividualEvent.create({
      data: { fileUuid, individualId: existingId, eventId: ev.id, role: ieLink.role || "principal" },
    });
    existingEventKeys.add(key);
  }

  // Merge notes additively (skip if same content already linked)
  const existingNoteIds = new Set(
    (await tx.gedcomIndividualNote.findMany({
      where: { fileUuid, individualId: existingId },
      select: { noteId: true },
    })).map((n) => n.noteId),
  );
  const existingNoteContents = existingNoteIds.size > 0
    ? new Set((await tx.gedcomNote.findMany({
        where: { fileUuid, id: { in: [...existingNoteIds] } },
        select: { content: true },
      })).map((n) => n.content?.trim() ?? ""))
    : new Set<string>();

  for (const inLink of doc.IndividualNotes.filter((n) => n.individual_xref === importIndi.xref)) {
    const note = doc.Notes[inLink.note_index];
    const content = note?.content?.trim();
    if (!content || existingNoteContents.has(content)) continue;
    const noteId = await findOrCreateNote(tx, fileUuid, content);
    const linked = await linkNoteToIndividual(tx, fileUuid, existingId, noteId);
    if (linked) existingNoteContents.add(content);
  }

  // Merge source citations additively (skip if same source already linked)
  const existingSourceIds = new Set(
    (await tx.gedcomIndividualSource.findMany({
      where: { fileUuid, individualId: existingId },
      select: { sourceId: true },
    })).map((s) => s.sourceId),
  );

  for (const isLink of doc.IndividualSources.filter((s) => s.individual_xref === importIndi.xref)) {
    const source = doc.Sources[isLink.source_index];
    if (!source) continue;
    const sourceId = await findOrCreateSourceFromEnriched(tx, fileUuid, source);
    if (existingSourceIds.has(sourceId)) continue;
    const linked = await linkSourceToIndividual(tx, fileUuid, existingId, sourceId, isLink);
    if (linked) existingSourceIds.add(sourceId);
  }
}

// ── Family creation ───────────────────────────────────────────────────────────

async function findOrCreateCoupleFamily(ctx: ChangeCtx, indivAId: string, indivBId: string): Promise<string> {
  const { tx, fileUuid } = ctx;
  const [a, b] = await Promise.all([
    tx.gedcomIndividual.findFirst({ where: { id: indivAId, fileUuid }, select: { id: true, sex: true } }),
    tx.gedcomIndividual.findFirst({ where: { id: indivBId, fileUuid }, select: { id: true, sex: true } }),
  ]);
  if (!a || !b) throw new Error("Individual not found when creating couple family");
  const { husbandId, wifeId } = canonicalSpouseSlotsForPair({ id: a.id, sex: a.sex }, { id: b.id, sex: b.sex });
  const existing = await findExistingCoupleFamilyId(tx, fileUuid, husbandId, wifeId);
  if (existing) {
    await rebuildSpouseRowsForFamily(ctx, existing);
    await syncFamilySpouseXrefs(tx, existing);
    return existing;
  }
  const xref = await allocateNewFamilyXref(tx, fileUuid);
  const fam = await tx.gedcomFamily.create({ data: { fileUuid, xref, husbandId, wifeId, childrenCount: 0 } });
  await registerXrefInFileObjects(tx, fileUuid, xref, "FAM", fam.id);
  await rebuildSpouseRowsForFamily(ctx, fam.id);
  await syncFamilySpouseXrefs(tx, fam.id);
  return fam.id;
}

async function findOrCreateSingleParentFamily(ctx: ChangeCtx, parentId: string): Promise<string> {
  const { tx, fileUuid } = ctx;
  const parent = await tx.gedcomIndividual.findFirst({ where: { id: parentId, fileUuid }, select: { id: true, sex: true } });
  if (!parent) throw new Error("Parent individual not found");
  const slot = singleSpouseSlotForFirstParent(parent.sex);
  const husbandId = slot === "husband" ? parent.id : null;
  const wifeId = slot === "wife" ? parent.id : null;
  const xref = await allocateNewFamilyXref(tx, fileUuid);
  const fam = await tx.gedcomFamily.create({ data: { fileUuid, xref, husbandId, wifeId, childrenCount: 0 } });
  await registerXrefInFileObjects(tx, fileUuid, xref, "FAM", fam.id);
  await rebuildSpouseRowsForFamily(ctx, fam.id);
  await syncFamilySpouseXrefs(tx, fam.id);
  return fam.id;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ApplyGedcomImportResult = {
  created: number;
  merged: number;
  skipped: number;
  familiesCreated: number;
};

export type GedcomApplyProgress = {
  processed: number;
  total: number;
  created: number;
  merged: number;
  skipped: number;
  label: string;
};

export async function applyGedcomImport(
  fileUuid: string,
  userId: string,
  plan: ImportMergePlan,
  overrides: Record<string, ImportResolution>,
  canonicalSnapshotJson: unknown,
  alternativeOverrides?: Record<string, string>,
  onProgress?: (progress: GedcomApplyProgress) => void,
): Promise<ApplyGedcomImportResult> {
  const doc = parseEnrichedDoc(canonicalSnapshotJson);
  if (!doc) throw new Error("Import has no enriched document; run compare first");

  return prisma.$transaction(
    async (tx) => {
      const ctx: ChangeCtx = { tx, fileUuid, userId, batchId: newBatchId() };
      const defaults = plan.defaultResolutions;
      const importIdToProductionId = new Map<string, string>();
      const importXrefToProductionId = new Map<string, string>();
      const importIdToXref = new Map<string, string>(doc.Individuals.map((i) => [i.id, i.xref]));

      let created = 0;
      let merged = 0;
      let skipped = 0;
      const total = plan.candidates.length;

      for (let i = 0; i < plan.candidates.length; i++) {
        const candidate = plan.candidates[i];
        const resolution = effectiveResolution(candidate.candidateId, defaults, overrides);

        if (resolution === "create_new") {
          const importIndi = doc.Individuals.find((ind) => ind.id === candidate.importedIndividualId);
          if (!importIndi) continue;
          const productionId = await createIndividualFromEnriched(ctx, doc, importIndi);
          importIdToProductionId.set(candidate.importedIndividualId, productionId);
          importXrefToProductionId.set(importIndi.xref, productionId);
          created++;
          onProgress?.({ processed: i + 1, total, created, merged, skipped, label: `Created: ${candidate.importedDisplay}` });
        } else if (resolution === "merge_into_existing") {
          const existingId = alternativeOverrides?.[candidate.candidateId] ?? candidate.existingIndividualId;
          if (!existingId) { skipped++; onProgress?.({ processed: i + 1, total, created, merged, skipped, label: `Skipped: ${candidate.importedDisplay}` }); continue; }
          importIdToProductionId.set(candidate.importedIndividualId, existingId);
          const xref = importIdToXref.get(candidate.importedIndividualId);
          if (xref) importXrefToProductionId.set(xref, existingId);
          const importIndi = doc.Individuals.find((ind) => ind.id === candidate.importedIndividualId);
          if (importIndi) {
            await mergeImportIntoExisting(tx, fileUuid, existingId, importIndi, doc);
          }
          merged++;
          onProgress?.({ processed: i + 1, total, created, merged, skipped, label: `Merged: ${candidate.importedDisplay}` });
        } else {
          skipped++;
          onProgress?.({ processed: i + 1, total, created, merged, skipped, label: `Skipped: ${candidate.importedDisplay}` });
        }
      }

      // ── Family relationships ───────────────────────────────────────────────
      let familiesCreated = 0;
      for (const importFam of doc.Families) {
        const husbProdId = importXrefToProductionId.get(importFam.husband_xref) ?? null;
        const wifeProdId = importXrefToProductionId.get(importFam.wife_xref) ?? null;
        const famChildren = doc.FamilyChildren.filter((fc) => fc.family_xref === importFam.xref);
        const famParentChild = doc.ParentChild.filter((pc) => pc.family_xref === importFam.xref);
        const childrenInProd = famChildren
          .map((fc) => importXrefToProductionId.get(fc.child_xref))
          .filter((id): id is string => id != null);

        if (!husbProdId && !wifeProdId && childrenInProd.length === 0) continue;

        let productionFamilyId: string | null = null;
        if (husbProdId && wifeProdId) {
          productionFamilyId = await findOrCreateCoupleFamily(ctx, husbProdId, wifeProdId);
          familiesCreated++;
        } else if ((husbProdId || wifeProdId) && childrenInProd.length > 0) {
          productionFamilyId = await findOrCreateSingleParentFamily(ctx, (husbProdId ?? wifeProdId)!);
          familiesCreated++;
        }

        if (!productionFamilyId) continue;

        // ── Family attributes ──────────────────────────────────────────────
        for (const faLink of doc.FamilyAttributes.filter((fa) => fa.family_xref === importFam.xref)) {
          const attr = doc.Attributes[faLink.attribute_index];
          if (!attr) continue;
          const attrId = await createAttributeFromEnriched(tx, fileUuid, attr, doc);
          await tx.gedcomFamilyAttribute.create({
            data: { fileUuid, familyId: productionFamilyId, attributeId: attrId },
          });
        }

        // ── Family residences ──────────────────────────────────────────────
        for (const frLink of doc.FamilyResidences.filter((fr) => fr.family_xref === importFam.xref)) {
          const res = doc.Residences[frLink.residence_index];
          if (!res) continue;
          const resId = await createResidenceFromEnriched(tx, fileUuid, res, doc);
          await tx.gedcomFamilyResidence.create({
            data: { fileUuid, familyId: productionFamilyId, residenceId: resId },
          });
        }

        for (const fc of famChildren) {
          const childProdId = importXrefToProductionId.get(fc.child_xref);
          if (!childProdId) continue;
          const pcRow = famParentChild.find((pc) => pc.child_xref === fc.child_xref);
          try {
            await addChildToFamily(ctx, productionFamilyId, childProdId, {
              relationshipType: pcRow?.relationship_type || "biological",
              birthOrder: fc.birth_order || null,
            });
          } catch { /* already a child */ }
        }
      }

      // ── Recompute family flags ─────────────────────────────────────────────
      for (const id of new Set(importIdToProductionId.values())) {
        await recomputeIndividualFamilyFlags(ctx, id);
      }

      return { created, merged, skipped, familiesCreated };
    },
    { timeout: 120_000 },
  );
}
