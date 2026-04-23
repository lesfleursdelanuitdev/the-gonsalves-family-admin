import type { ChangeCtx } from "@/lib/admin/changelog";
import { normalizeSurnamePieceType, type SurnamePayloadRow } from "@/lib/forms/individual-editor-form";

const BIRTH_NAME_TYPE = "birth";

export type NameFormSyncInput = {
  /** Existing row id from DB; omit for new forms. */
  id?: string | null;
  role: "primary" | "alias";
  /** Stored `name_type` for alias rows (e.g. aka, married); ignored when role is primary. */
  aliasNameType?: string | null;
  givenNames: string[];
  surnames: SurnamePayloadRow[];
};

async function findOrCreateGivenNameId(ctx: ChangeCtx, raw: string): Promise<string> {
  const { tx, fileUuid } = ctx;
  const givenName = raw.trim();
  if (!givenName) throw new Error("Given name cannot be empty");
  const givenNameLower = givenName.toLowerCase();
  const existing = await tx.gedcomGivenName.findFirst({
    where: { fileUuid, givenNameLower },
  });
  if (existing) return existing.id;
  const created = await tx.gedcomGivenName.create({
    data: { fileUuid, givenName, givenNameLower },
  });
  return created.id;
}

async function findOrCreateSurnameId(ctx: ChangeCtx, raw: string): Promise<string> {
  const { tx, fileUuid } = ctx;
  const surname = raw.trim();
  if (!surname) throw new Error("Surname cannot be empty");
  const surnameLower = surname.toLowerCase();
  const existing = await tx.gedcomSurname.findFirst({
    where: { fileUuid, surnameLower },
  });
  if (existing) return existing.id;
  const created = await tx.gedcomSurname.create({
    data: { fileUuid, surname, surnameLower },
  });
  return created.id;
}

/** Compose GEDCOM-style display string for fullName / fullNameLower. */
export function composeFullNameFromParts(
  givenNames: string[],
  surnames: string[] | SurnamePayloadRow[],
): string {
  const g = givenNames.map((s) => s.trim()).filter(Boolean);
  const s = surnames
    .map((x) => (typeof x === "string" ? x.trim() : x.text.trim()))
    .filter(Boolean);
  const givenPart = g.join(" ");
  const surPart = s.join(" ");
  if (givenPart && surPart) return `${givenPart} / ${surPart}`;
  if (givenPart) return givenPart;
  if (surPart) return surPart;
  return "Unknown";
}

function cleanSurnameRows(surnames: string[] | SurnamePayloadRow[]): SurnamePayloadRow[] {
  const surRows: SurnamePayloadRow[] = surnames.map((x) =>
    typeof x === "string" ? { text: x, pieceType: null } : x,
  );
  return surRows
    .map((r) => ({
      text: r.text.trim(),
      pieceType:
        r.pieceType != null && r.pieceType !== ""
          ? normalizeSurnamePieceType(r.pieceType) || null
          : null,
    }))
    .filter((r) => r.text.length > 0);
}

function cleanNameFormParts(
  givenNames: string[],
  surnames: string[] | SurnamePayloadRow[],
): { gClean: string[]; sRows: SurnamePayloadRow[] } {
  const gClean = givenNames.map((x) => x.trim()).filter(Boolean);
  const sRows = cleanSurnameRows(surnames);
  return { gClean, sRows };
}

function resolvedDbNameType(role: "primary" | "alias", aliasNameType: string | null | undefined): string {
  if (role === "primary") return BIRTH_NAME_TYPE;
  const t = (aliasNameType ?? "").trim().toLowerCase();
  if (!t || t === BIRTH_NAME_TYPE) return "aka";
  return t.slice(0, 64);
}

async function writeNameFormLinks(
  ctx: ChangeCtx,
  nameFormId: string,
  gClean: string[],
  sRows: SurnamePayloadRow[],
) {
  const { tx, fileUuid } = ctx;
  await tx.gedcomNameFormGivenName.deleteMany({ where: { nameFormId } });
  await tx.gedcomNameFormSurname.deleteMany({ where: { nameFormId } });

  let pos = 1;
  for (const g of gClean) {
    const gid = await findOrCreateGivenNameId(ctx, g);
    await tx.gedcomNameFormGivenName.create({
      data: { fileUuid, nameFormId, givenNameId: gid, position: pos },
    });
    pos += 1;
  }
  pos = 1;
  for (const row of sRows) {
    const sid = await findOrCreateSurnameId(ctx, row.text);
    // Create without surnamePieceType so deployments with an older generated Prisma
    // client (before surname_piece_type) still validate. When piece type is set and
    // the column exists, apply it via raw SQL.
    const created = await tx.gedcomNameFormSurname.create({
      data: {
        fileUuid,
        nameFormId,
        surnameId: sid,
        position: pos,
      },
    });
    if (row.pieceType != null && row.pieceType !== "") {
      await tx.$executeRaw`
        UPDATE "gedcom_name_form_surnames"
        SET "surname_piece_type" = ${row.pieceType}
        WHERE "id" = ${created.id}
      `;
    }
    pos += 1;
  }
}

/**
 * Replaces all name forms for the individual: upserts by id, deletes omitted rows,
 * and sets `fullName` from the primary form only.
 */
export async function syncIndividualNameForms(
  ctx: ChangeCtx,
  individualId: string,
  rows: NameFormSyncInput[],
) {
  const { tx, fileUuid } = ctx;
  if (rows.length === 0) throw new Error("At least one name form is required");
  const primaryCount = rows.filter((r) => r.role === "primary").length;
  if (primaryCount !== 1) throw new Error("Exactly one primary name is required");

  const sorted = [...rows].sort((a, b) => {
    if (a.role === "primary" && b.role !== "primary") return -1;
    if (a.role !== "primary" && b.role === "primary") return 1;
    return 0;
  });

  const cleaned = sorted.map((row) => {
    const { gClean, sRows } = cleanNameFormParts(row.givenNames, row.surnames);
    if (gClean.length === 0 && sRows.length === 0) {
      throw new Error("Each name form must include at least one given name or surname");
    }
    return { row, gClean, sRows };
  });

  const existing = await tx.gedcomIndividualNameForm.findMany({
    where: { fileUuid, individualId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));

  const matchedIds = new Set<string>();
  for (const { row } of cleaned) {
    const raw = row.id?.trim();
    if (raw && existingIds.has(raw)) matchedIds.add(raw);
  }

  const toRemove = existing.map((e) => e.id).filter((id) => !matchedIds.has(id));
  if (toRemove.length > 0) {
    await tx.gedcomIndividualNameForm.deleteMany({
      where: { fileUuid, individualId, id: { in: toRemove } },
    });
  }

  for (let idx = 0; idx < cleaned.length; idx++) {
    const { row, gClean, sRows } = cleaned[idx];
    const nameType = resolvedDbNameType(row.role, row.aliasNameType);
    const isPrimary = row.role === "primary";
    const rawId = row.id?.trim();
    const useId = rawId && existingIds.has(rawId) ? rawId : null;

    let formId: string;
    if (useId) {
      await tx.gedcomIndividualNameForm.update({
        where: { id: useId },
        data: { nameType, isPrimary, sortOrder: idx },
      });
      formId = useId;
    } else {
      const created = await tx.gedcomIndividualNameForm.create({
        data: { fileUuid, individualId, nameType, isPrimary, sortOrder: idx },
      });
      formId = created.id;
    }

    await writeNameFormLinks(ctx, formId, gClean, sRows);
  }

  const primaryCleaned = cleaned.find((c) => c.row.role === "primary");
  if (!primaryCleaned) throw new Error("Primary name form missing");
  const fullName = composeFullNameFromParts(primaryCleaned.gClean, primaryCleaned.sRows);
  await tx.gedcomIndividual.update({
    where: { id: individualId },
    data: {
      fullName,
      fullNameLower: fullName.toLowerCase(),
    },
  });
}
