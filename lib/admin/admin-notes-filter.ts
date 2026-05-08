import { Prisma } from "@ligneous/prisma";
import { escapeLike } from "@/lib/gedcom/gedcom-name-search";
import { linkedIndividualExistsSql } from "@/lib/admin/admin-linked-name-sql";
import { joinAndConditions } from "@/lib/admin/admin-sql-helpers";

export interface AdminNotesStructuredFilters {
  /** When null, do not filter by top-level flag. */
  isTopLevel: boolean | null;
  contentContains: string | null;
  /** Lowercased substring for structured given-name contains on linked individuals. */
  linkedGiven: string | null;
  /** Trimmed prefix for GEDCOM slash-aware surname on linked individuals. */
  linkedLast: string | null;
  /** Notes linked to this individual (junction `gedcom_individual_notes_v2`). */
  linkedIndividualId: string | null;
  /** Notes linked to this family (junction `gedcom_family_notes_v2`). */
  linkedFamilyId: string | null;
  /** Notes linked to this event (junction `gedcom_event_notes_v2`). */
  linkedEventId: string | null;
}

/** UUID string for `linkedIndividualId` / `linkedFamilyId` / `linkedEventId` query params. */
const NOTE_LINK_ENTITY_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseNoteLinkedEntityIdParam(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key)?.trim() ?? "";
  if (!v || !NOTE_LINK_ENTITY_UUID_RE.test(v)) return null;
  return v.toLowerCase();
}

export function parseIsTopLevelParam(searchParams: URLSearchParams): boolean | null {
  if (!searchParams.has("isTopLevel")) return null;
  const v = searchParams.get("isTopLevel");
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function hasStructuredNoteFilters(f: AdminNotesStructuredFilters): boolean {
  return !!(
    f.isTopLevel !== null ||
    f.contentContains ||
    f.linkedGiven ||
    f.linkedLast ||
    f.linkedIndividualId ||
    f.linkedFamilyId ||
    f.linkedEventId
  );
}

/**
 * WHERE conditions on `gedcom_notes_v2` aliased as `n`.
 */
export function adminNotesFilterConditions(
  fileUuid: string,
  structured: AdminNotesStructuredFilters,
  q: string | null
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`n.file_uuid = ${fileUuid}::uuid`];

  if (structured.isTopLevel === true) {
    parts.push(Prisma.sql`n.is_top_level = true`);
  } else if (structured.isTopLevel === false) {
    parts.push(Prisma.sql`n.is_top_level = false`);
  }

  const contentTrim = structured.contentContains?.trim() || "";
  if (contentTrim) {
    const pat = `%${escapeLike(contentTrim)}%`;
    parts.push(Prisma.sql`n.content ILIKE ${pat} ESCAPE '\\'`);
  }

  const qTrim = q?.trim() || "";
  if (qTrim) {
    const xrefPat = `%${escapeLike(qTrim)}%`;
    parts.push(
      Prisma.sql`(
        to_tsvector('english', n.content) @@ websearch_to_tsquery('english', ${qTrim})
        OR (n.xref IS NOT NULL AND n.xref ILIKE ${xrefPat} ESCAPE '\\')
      )`,
    );
  }

  const nameExists = linkedIndividualExistsSql(
    "gedcom_individual_notes_v2",
    "note_id",
    "n",
    structured.linkedGiven,
    structured.linkedLast,
  );
  if (nameExists) parts.push(nameExists);

  if (structured.linkedIndividualId) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM gedcom_individual_notes_v2 lnk
        WHERE lnk.note_id = n.id
          AND lnk.file_uuid = ${fileUuid}::uuid
          AND lnk.individual_id = ${structured.linkedIndividualId}::uuid
      )`,
    );
  }
  if (structured.linkedFamilyId) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM gedcom_family_notes_v2 lnk
        WHERE lnk.note_id = n.id
          AND lnk.file_uuid = ${fileUuid}::uuid
          AND lnk.family_id = ${structured.linkedFamilyId}::uuid
      )`,
    );
  }
  if (structured.linkedEventId) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM gedcom_event_notes_v2 lnk
        WHERE lnk.note_id = n.id
          AND lnk.file_uuid = ${fileUuid}::uuid
          AND lnk.event_id = ${structured.linkedEventId}::uuid
      )`,
    );
  }

  return parts;
}

export function adminNotesWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
