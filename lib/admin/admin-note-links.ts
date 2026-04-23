import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";

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
            content: data.content,
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
