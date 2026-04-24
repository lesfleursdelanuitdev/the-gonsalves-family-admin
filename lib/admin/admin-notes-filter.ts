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
    f.linkedLast
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

  return parts;
}

export function adminNotesWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
