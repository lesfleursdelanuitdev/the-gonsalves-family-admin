import { Prisma } from "@ligneous/prisma";
import { escapeLike } from "@/lib/gedcom/gedcom-name-search";
import { givenNameExistsSql, lastNameRegexSql } from "@/lib/admin/admin-linked-name-sql";
import { joinAndConditions } from "@/lib/admin/admin-sql-helpers";

/**
 * Partner 1 / Partner 2 in the admin UI map to GEDCOM columns: P1 → husband (HUSB), P2 → wife (WIFE).
 * Name filters apply to those columns only (not swapped).
 */
export interface AdminFamiliesStructuredFilters {
  partnerCount: "one" | "two" | null;
  p1Given: string | null;
  p1Last: string | null;
  p2Given: string | null;
  p2Last: string | null;
  childrenOp: "gt" | "lt" | "eq" | null;
  childrenValue: number | null;
  hasMarriageDate: boolean | null;
}

export function parsePartnerCountParam(raw: string | null): "one" | "two" | null {
  if (raw === "one" || raw === "two") return raw;
  return null;
}

export function parseChildrenOpParam(raw: string | null): "gt" | "lt" | "eq" | null {
  if (raw === "gt" || raw === "lt" || raw === "eq") return raw;
  return null;
}

export function parseChildrenValueParam(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseHasMarriageDateParam(
  searchParams: URLSearchParams
): boolean | null {
  if (!searchParams.has("hasMarriageDate")) return null;
  const v = searchParams.get("hasMarriageDate");
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function hasStructuredFamilyFilters(f: AdminFamiliesStructuredFilters): boolean {
  const childrenActive =
    f.childrenOp != null && f.childrenValue != null;
  return !!(
    f.partnerCount ||
    f.p1Given ||
    f.p1Last ||
    f.p2Given ||
    f.p2Last ||
    childrenActive ||
    f.hasMarriageDate !== null
  );
}

/** Match one spouse slot (`h` = husband row, `w` = wife row) by given (contains) and/or surname prefix (GEDCOM slash-aware). */
function partnerSlotMatchConditions(
  slot: "h" | "w",
  givenLower: string | null,
  lastPrefix: string | null,
): Prisma.Sql[] {
  const idExpr = slot === "h" ? Prisma.raw("h.id") : Prisma.raw("w.id");
  const nameExpr = slot === "h" ? Prisma.raw("h.full_name_lower") : Prisma.raw("w.full_name_lower");
  const nullGuard = slot === "h" ? Prisma.sql`h.id IS NOT NULL` : Prisma.sql`w.id IS NOT NULL`;
  const parts: Prisma.Sql[] = [];
  if (givenLower) {
    parts.push(Prisma.sql`(${nullGuard} AND ${givenNameExistsSql(idExpr, givenLower)})`);
  }
  if (lastPrefix) {
    parts.push(Prisma.sql`(${nullGuard} AND ${lastNameRegexSql(nameExpr, lastPrefix)})`);
  }
  return parts;
}

function andSql(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) return Prisma.sql`TRUE`;
  if (conditions.length === 1) return conditions[0]!;
  return Prisma.sql`(${Prisma.join(conditions, " AND ")})`;
}

/** P1 or P2 “person” matches the given spouse slot when all of their non-empty name criteria match. */
function personMatchesSlot(
  slot: "h" | "w",
  givenLower: string | null,
  lastPrefix: string | null,
): Prisma.Sql {
  return andSql(partnerSlotMatchConditions(slot, givenLower, lastPrefix));
}

/**
 * WHERE conditions for `gedcom_families_v2 f` with `h` = husband individual, `w` = wife individual.
 */
export function adminFamiliesFilterConditions(
  fileUuid: string,
  structured: AdminFamiliesStructuredFilters,
  q: string | null
): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`f.file_uuid = ${fileUuid}::uuid`];

  if (structured.partnerCount === "two") {
    parts.push(Prisma.sql`f.husband_id IS NOT NULL AND f.wife_id IS NOT NULL`);
  } else if (structured.partnerCount === "one") {
    parts.push(
      Prisma.sql`((f.husband_id IS NOT NULL AND f.wife_id IS NULL) OR (f.husband_id IS NULL AND f.wife_id IS NOT NULL))`
    );
  }

  if (structured.childrenOp && structured.childrenValue != null) {
    const n = structured.childrenValue;
    if (structured.childrenOp === "gt") {
      parts.push(Prisma.sql`f.children_count > ${n}`);
    } else if (structured.childrenOp === "lt") {
      parts.push(Prisma.sql`f.children_count < ${n}`);
    } else {
      parts.push(Prisma.sql`f.children_count = ${n}`);
    }
  }

  if (structured.hasMarriageDate === true) {
    parts.push(
      Prisma.sql`(f.marriage_date_id IS NOT NULL OR f.marriage_year IS NOT NULL OR (f.marriage_date_display IS NOT NULL AND btrim(f.marriage_date_display) <> ''))`
    );
  } else if (structured.hasMarriageDate === false) {
    parts.push(
      Prisma.sql`NOT (f.marriage_date_id IS NOT NULL OR f.marriage_year IS NOT NULL OR (f.marriage_date_display IS NOT NULL AND btrim(f.marriage_date_display) <> ''))`
    );
  }

  const hasP1 = !!(structured.p1Given || structured.p1Last);
  const hasP2 = !!(structured.p2Given || structured.p2Last);
  const onePartnerFamily = structured.partnerCount === "one";

  if (hasP1 && hasP2) {
    const p1OnH = personMatchesSlot("h", structured.p1Given, structured.p1Last);
    const p2OnW = personMatchesSlot("w", structured.p2Given, structured.p2Last);
    parts.push(Prisma.sql`(${p1OnH} AND ${p2OnW})`);
  } else if (hasP1) {
    const p1OnH = personMatchesSlot("h", structured.p1Given, structured.p1Last);
    if (onePartnerFamily) {
      const p1OnW = personMatchesSlot("w", structured.p1Given, structured.p1Last);
      parts.push(Prisma.sql`(${p1OnH} OR ${p1OnW})`);
    } else {
      parts.push(p1OnH);
    }
  } else if (hasP2) {
    const p2OnW = personMatchesSlot("w", structured.p2Given, structured.p2Last);
    if (onePartnerFamily) {
      const p2OnH = personMatchesSlot("h", structured.p2Given, structured.p2Last);
      parts.push(Prisma.sql`(${p2OnH} OR ${p2OnW})`);
    } else {
      parts.push(p2OnW);
    }
  }

  const qTrim = q?.trim().toLowerCase() || "";
  if (qTrim) {
    const likePattern = `%${escapeLike(qTrim)}%`;
    parts.push(
      Prisma.sql`(
        (h.id IS NOT NULL AND h.full_name_lower LIKE ${likePattern} ESCAPE '\\')
        OR (w.id IS NOT NULL AND w.full_name_lower LIKE ${likePattern} ESCAPE '\\')
      )`
    );
  }

  return parts;
}

export function adminFamiliesWhereSql(conditions: Prisma.Sql[]): Prisma.Sql {
  return joinAndConditions(conditions);
}
