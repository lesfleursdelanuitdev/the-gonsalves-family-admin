import type { Prisma } from "@ligneous/prisma";
import { prisma } from "../database/prisma.ts";
import { sanitizeNoteMarkdownForPersistence } from "../notes/sanitize-note-markdown.ts";

export interface NoteLinksPayload {
  individualIds: string[];
  familyIds: string[];
  eventIds: string[];
  sourceIds: string[];
}

function uniqIds(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Parse `links` from JSON body. Throws if `links` is present but not an object. */
export function parseNoteLinksFromBody(links: unknown): NoteLinksPayload {
  if (links == null) {
    return { individualIds: [], familyIds: [], eventIds: [], sourceIds: [] };
  }
  if (typeof links !== "object" || Array.isArray(links)) {
    throw new Error("links must be an object");
  }
  const o = links as Record<string, unknown>;
  return {
    individualIds: uniqIds(o.individualIds),
    familyIds: uniqIds(o.familyIds),
    eventIds: uniqIds(o.eventIds),
    sourceIds: uniqIds(o.sourceIds),
  };
}

export async function validateNoteLinksForFile(
  fileUuid: string,
  payload: NoteLinksPayload,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (payload.individualIds.length > 0) {
    const n = await prisma.gedcomIndividual.count({
      where: { fileUuid, id: { in: payload.individualIds } },
    });
    if (n !== payload.individualIds.length) {
      return { ok: false, message: "One or more individual IDs are not in this tree" };
    }
  }
  if (payload.familyIds.length > 0) {
    const n = await prisma.gedcomFamily.count({
      where: { fileUuid, id: { in: payload.familyIds } },
    });
    if (n !== payload.familyIds.length) {
      return { ok: false, message: "One or more family IDs are not in this tree" };
    }
  }
  if (payload.eventIds.length > 0) {
    const n = await prisma.gedcomEvent.count({
      where: { fileUuid, id: { in: payload.eventIds } },
    });
    if (n !== payload.eventIds.length) {
      return { ok: false, message: "One or more event IDs are not in this tree" };
    }
  }
  if (payload.sourceIds.length > 0) {
    const n = await prisma.gedcomSource.count({
      where: { fileUuid, id: { in: payload.sourceIds } },
    });
    if (n !== payload.sourceIds.length) {
      return { ok: false, message: "One or more source IDs are not in this tree" };
    }
  }
  return { ok: true };
}

async function createJunctionRows(
  tx: Prisma.TransactionClient,
  fileUuid: string,
  noteId: string,
  payload: NoteLinksPayload,
) {
  if (payload.individualIds.length > 0) {
    await tx.gedcomIndividualNote.createMany({
      data: payload.individualIds.map((individualId) => ({
        fileUuid,
        individualId,
        noteId,
      })),
    });
  }
  if (payload.familyIds.length > 0) {
    await tx.gedcomFamilyNote.createMany({
      data: payload.familyIds.map((familyId) => ({
        fileUuid,
        familyId,
        noteId,
      })),
    });
  }
  if (payload.eventIds.length > 0) {
    await tx.gedcomEventNote.createMany({
      data: payload.eventIds.map((eventId) => ({
        fileUuid,
        eventId,
        noteId,
      })),
    });
  }
  if (payload.sourceIds.length > 0) {
    await tx.gedcomSourceNote.createMany({
      data: payload.sourceIds.map((sourceId) => ({
        fileUuid,
        sourceId,
        noteId,
      })),
    });
  }
}

export async function replaceNoteLinksInTx(
  tx: Prisma.TransactionClient,
  fileUuid: string,
  noteId: string,
  payload: NoteLinksPayload,
) {
  await tx.gedcomIndividualNote.deleteMany({ where: { noteId } });
  await tx.gedcomFamilyNote.deleteMany({ where: { noteId } });
  await tx.gedcomEventNote.deleteMany({ where: { noteId } });
  await tx.gedcomSourceNote.deleteMany({ where: { noteId } });
  await createJunctionRows(tx, fileUuid, noteId, payload);
}

export async function replaceNoteLinks(
  fileUuid: string,
  noteId: string,
  payload: NoteLinksPayload,
) {
  await prisma.$transaction(async (tx) => {
    await replaceNoteLinksInTx(tx, fileUuid, noteId, payload);
  });
}

/**
 * Link an existing note to an individual (same file). No-op if the link already exists.
 */
export async function attachExistingNoteToIndividual(
  fileUuid: string,
  individualId: string,
  noteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = await prisma.gedcomNote.findFirst({
    where: { id: noteId, fileUuid },
    select: { id: true },
  });
  if (!note) {
    return { ok: false, message: "Note not found in this tree" };
  }
  const ind = await prisma.gedcomIndividual.findFirst({
    where: { id: individualId, fileUuid },
    select: { id: true },
  });
  if (!ind) {
    return { ok: false, message: "Individual not found in this tree" };
  }
  const existing = await prisma.gedcomIndividualNote.findFirst({
    where: { fileUuid, individualId, noteId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true };
  }
  await prisma.gedcomIndividualNote.create({
    data: { fileUuid, individualId, noteId },
  });
  return { ok: true };
}

/**
 * Link an existing note to a family (same file). No-op if the link already exists.
 */
export async function attachExistingNoteToFamily(
  fileUuid: string,
  familyId: string,
  noteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = await prisma.gedcomNote.findFirst({
    where: { id: noteId, fileUuid },
    select: { id: true },
  });
  if (!note) {
    return { ok: false, message: "Note not found in this tree" };
  }
  const fam = await prisma.gedcomFamily.findFirst({
    where: { id: familyId, fileUuid },
    select: { id: true },
  });
  if (!fam) {
    return { ok: false, message: "Family not found in this tree" };
  }
  const existing = await prisma.gedcomFamilyNote.findFirst({
    where: { fileUuid, familyId, noteId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true };
  }
  await prisma.gedcomFamilyNote.create({
    data: { fileUuid, familyId, noteId },
  });
  return { ok: true };
}

/**
 * Link an existing note to an event (same file). No-op if the link already exists.
 */
export async function attachExistingNoteToEvent(
  fileUuid: string,
  eventId: string,
  noteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = await prisma.gedcomNote.findFirst({
    where: { id: noteId, fileUuid },
    select: { id: true },
  });
  if (!note) {
    return { ok: false, message: "Note not found in this tree" };
  }
  const ev = await prisma.gedcomEvent.findFirst({
    where: { id: eventId, fileUuid },
    select: { id: true },
  });
  if (!ev) {
    return { ok: false, message: "Event not found in this tree" };
  }
  const existing = await prisma.gedcomEventNote.findFirst({
    where: { fileUuid, eventId, noteId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true };
  }
  await prisma.gedcomEventNote.create({
    data: { fileUuid, eventId, noteId },
  });
  return { ok: true };
}

/**
 * Link an existing note to a source (same file). No-op if the link already exists.
 */
export async function attachExistingNoteToSource(
  fileUuid: string,
  sourceId: string,
  noteId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = await prisma.gedcomNote.findFirst({
    where: { id: noteId, fileUuid },
    select: { id: true },
  });
  if (!note) {
    return { ok: false, message: "Note not found in this tree" };
  }
  const src = await prisma.gedcomSource.findFirst({
    where: { id: sourceId, fileUuid },
    select: { id: true },
  });
  if (!src) {
    return { ok: false, message: "Source not found in this tree" };
  }
  const existing = await prisma.gedcomSourceNote.findFirst({
    where: { fileUuid, sourceId, noteId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true };
  }
  await prisma.gedcomSourceNote.create({
    data: { fileUuid, sourceId, noteId },
  });
  return { ok: true };
}

/** Matches GEDCOM-style note ids stored as N1, @N2@, etc. */
const NOTE_NUMERIC_XREF_RE = /^@?N(\d+)@?$/i;

function nextNoteXrefFromExisting(xrefs: (string | null | undefined)[]): string {
  let maxN = 0;
  for (const raw of xrefs) {
    if (raw == null) continue;
    const m = String(raw).trim().match(NOTE_NUMERIC_XREF_RE);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `N${maxN + 1}`;
}

function bumpGeneratedNoteXref(x: string): string {
  const m = x.match(/^N(\d+)$/i);
  if (m) return `N${parseInt(m[1], 10) + 1}`;
  return "N1";
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

export async function createGedcomNoteWithLinks(
  fileUuid: string,
  data: { content: string; isTopLevel: boolean },
  payload: NoteLinksPayload,
) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.gedcomNote.findMany({
      where: { fileUuid, xref: { not: null } },
      select: { xref: true },
    });
    let xref = nextNoteXrefFromExisting(rows.map((r) => r.xref));

    for (let attempt = 0; attempt < 24; attempt++) {
      try {
        const note = await tx.gedcomNote.create({
          data: {
            fileUuid,
            content: sanitizeNoteMarkdownForPersistence(data.content),
            xref,
            isTopLevel: data.isTopLevel,
          },
        });
        await createJunctionRows(tx, fileUuid, note.id, payload);
        return note;
      } catch (e) {
        if (isPrismaUniqueViolation(e)) {
          xref = bumpGeneratedNoteXref(xref);
          continue;
        }
        throw e;
      }
    }
    throw new Error("Could not allocate a unique note xref");
  });
}
