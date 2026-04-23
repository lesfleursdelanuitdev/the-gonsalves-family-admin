import { Prisma } from "@ligneous/prisma";
import { escapeLike } from "@/lib/gedcom/gedcom-name-search";
import { linkedIndividualExistsSql } from "@/lib/admin/admin-linked-name-sql";
import { joinAndConditions } from "@/lib/admin/admin-sql-helpers";

/** UI bucket aligned with `admin/media/page.tsx` mapApiToRows. */
export type AdminMediaCategory = "photo" | "document" | "video";

export interface AdminMediaStructuredFilters {
  mediaCategory: AdminMediaCategory | null;
  titleContains: string | null;
  fileRefContains: string | null;
  /** Matches substring in `form` or `file_ref` (e.g. jpg, .png, pdf). */
  fileTypeContains: string | null;
  linkedGiven: string | null;
  linkedLast: string | null;
}

export function parseMediaCategoryParam(searchParams: URLSearchParams): AdminMediaCategory | null {
  const v = searchParams.get("mediaCategory")?.trim().toLowerCase() || "";
  if (v === "photo" || v === "document" || v === "video") return v;
  return null;
}

export function parseStructuredMediaFromSearchParams(
  searchParams: URLSearchParams
): AdminMediaStructuredFilters {
  const cg = searchParams.get("linkedGiven")?.trim().toLowerCase() || "";
  const cl = searchParams.get("linkedLast")?.trim() || "";
  const tc = searchParams.get("titleContains")?.trim() || "";
  const fc = searchParams.get("fileRefContains")?.trim() || "";
  const ft = searchParams.get("fileTypeContains")?.trim() || "";
  return {
    mediaCategory: parseMediaCategoryParam(searchParams),
    titleContains: tc || null,
    fileRefContains: fc || null,
    fileTypeContains: ft || null,
    linkedGiven: cg || null,
    linkedLast: cl || null,
  };
}

export function hasStructuredMediaFilters(f: AdminMediaStructuredFilters): boolean {
  return !!(
    f.mediaCategory ||
    f.titleContains ||
    f.fileRefContains ||
    f.fileTypeContains ||
    f.linkedGiven ||
    f.linkedLast
  );
}

/**
 * WHERE fragments for `gedcom_media_v2` aliased as `m`.
 */
export function adminMediaFilterConditions(
  fileUuid: string,
  structured: AdminMediaStructuredFilters,
  q: string | null
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`m.file_uuid = ${fileUuid}::uuid`];

  if (structured.mediaCategory === "photo") {
    parts.push(Prisma.sql`(
      m.form IS NULL OR TRIM(m.form) = '' OR (
        LOWER(m.form) NOT LIKE '%video%' AND LOWER(m.form) NOT LIKE '%doc%'
      )
    )`);
  } else if (structured.mediaCategory === "document") {
    parts.push(
      Prisma.sql`(LOWER(COALESCE(m.form,'')) LIKE '%doc%' OR LOWER(TRIM(COALESCE(m.form,''))) = 'document')`
    );
  } else if (structured.mediaCategory === "video") {
    parts.push(
      Prisma.sql`(LOWER(COALESCE(m.form,'')) LIKE '%video%' OR LOWER(TRIM(COALESCE(m.form,''))) = 'video')`
    );
  }

  const titleTrim = structured.titleContains?.trim() || "";
  if (titleTrim) {
    const pat = `%${escapeLike(titleTrim)}%`;
    parts.push(Prisma.sql`m.title ILIKE ${pat} ESCAPE '\\'`);
  }

  const fileRefTrim = structured.fileRefContains?.trim() || "";
  if (fileRefTrim) {
    const pat = `%${escapeLike(fileRefTrim)}%`;
    parts.push(Prisma.sql`m.file_ref ILIKE ${pat} ESCAPE '\\'`);
  }

  let fileTypeNorm = structured.fileTypeContains?.trim().toLowerCase() || "";
  if (fileTypeNorm.startsWith(".")) fileTypeNorm = fileTypeNorm.slice(1);
  if (fileTypeNorm) {
    const pat = `%${escapeLike(fileTypeNorm)}%`;
    parts.push(
      Prisma.sql`(LOWER(COALESCE(m.form,'')) LIKE ${pat} ESCAPE '\\' OR LOWER(COALESCE(m.file_ref,'')) LIKE ${pat} ESCAPE '\\')`
    );
  }

  const nameExists = linkedIndividualExistsSql(
    "gedcom_individual_media_v2",
    "media_id",
    "m",
    structured.linkedGiven,
    structured.linkedLast,
  );
  if (nameExists) parts.push(nameExists);

  const qTrim = q?.trim() || "";
  if (qTrim) {
    const pat = `%${escapeLike(qTrim)}%`;
    parts.push(Prisma.sql`(
      m.title ILIKE ${pat} ESCAPE '\\'
      OR (m.description IS NOT NULL AND m.description ILIKE ${pat} ESCAPE '\\')
      OR m.file_ref ILIKE ${pat} ESCAPE '\\'
      OR m.form ILIKE ${pat} ESCAPE '\\'
      OR (m.xref IS NOT NULL AND m.xref ILIKE ${pat} ESCAPE '\\')
    )`);
  }

  return parts;
}

export function adminMediaWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
