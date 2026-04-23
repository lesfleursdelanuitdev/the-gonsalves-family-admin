import type {
  AddChildToSpouseFamilyPayload,
  IndividualEditorPayload,
  NewChildFamilyFromNewParentsPayload,
  NewChildFamilyParentPayload,
  NewSpouseFamilyPayload,
} from "@/lib/admin/admin-individual-editor-apply";
import type { NameFormSyncInput } from "@/lib/admin/admin-individual-names";
import { normalizeSurnamePieceType, type SurnamePayloadRow } from "@/lib/forms/individual-editor-form";

/** Parse `names.surnames` from JSON (legacy string[] or { text, pieceType }[]). */
export function parseSurnameRowsFromNamesJson(raw: unknown): SurnamePayloadRow[] {
  if (!Array.isArray(raw)) return [];
  const out: SurnamePayloadRow[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push({ text: t, pieceType: null });
      continue;
    }
    if (item !== null && typeof item === "object" && "text" in item) {
      const o = item as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      if (!text) continue;
      const p = normalizeSurnamePieceType(typeof o.pieceType === "string" ? o.pieceType : "");
      out.push({ text, pieceType: p ? p : null });
    }
  }
  return out;
}

/** Keys that trigger the full editor transaction on PATCH /api/admin/individuals/[id]. */
export const INDIVIDUAL_EDITOR_PATCH_KEYS = [
  "nameForms",
  "names",
  "birth",
  "death",
  "livingMode",
  "familiesAsSpouse",
  "newSpouseFamilies",
  "familiesAsChild",
  "newChildFamiliesFromNewParents",
  "addChildrenToSpouseFamilies",
] as const;

export function bodyHasIndividualEditorPayload(body: Record<string, unknown>): boolean {
  return INDIVIDUAL_EDITOR_PATCH_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
}

function parseNewChildFamilyParentField(raw: unknown): NewChildFamilyParentPayload | null {
  if (raw === null || typeof raw !== "object") return null;
  const x = raw as Record<string, unknown>;
  let givenNames: string[] = [];
  if (Array.isArray(x.givenNames)) {
    givenNames = x.givenNames
      .filter((g): g is string => typeof g === "string")
      .map((g) => g.trim())
      .filter(Boolean);
  } else if (typeof x.givenNames === "string") {
    givenNames = x.givenNames.trim().split(/\s+/).filter(Boolean);
  }
  const surname = typeof x.surname === "string" ? x.surname.trim() : "";
  const su = typeof x.sex === "string" ? x.sex.trim().toUpperCase() : "";
  const sex = su === "M" || su === "F" || su === "U" || su === "X" ? su : null;
  if (givenNames.length === 0 || !surname || !sex) return null;
  const relationshipType =
    typeof x.relationshipType === "string" && x.relationshipType.trim()
      ? x.relationshipType.trim()
      : "biological";
  return { givenNames, surname, sex, relationshipType };
}

export function parseIndividualEditorPayload(body: Record<string, unknown>): IndividualEditorPayload {
  const payload: IndividualEditorPayload = {};

  if ("sex" in body) {
    payload.sex = body.sex === null ? null : String(body.sex);
  }
  if (Array.isArray(body.nameForms)) {
    const rows: NameFormSyncInput[] = body.nameForms
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => {
        const role = x.role === "alias" ? "alias" : "primary";
        const givenNames = Array.isArray(x.givenNames)
          ? x.givenNames.filter((g): g is string => typeof g === "string")
          : [];
        const surnames = parseSurnameRowsFromNamesJson(x.surnames);
        const id = x.id != null && String(x.id).trim() !== "" ? String(x.id).trim() : null;
        const aliasNameType =
          typeof x.aliasNameType === "string" && x.aliasNameType.trim() ? x.aliasNameType.trim() : null;
        return { id, role, aliasNameType, givenNames, surnames };
      });
    if (rows.length > 0) payload.nameForms = rows;
  }
  if (body.names && typeof body.names === "object" && body.names !== null) {
    const n = body.names as Record<string, unknown>;
    const givenNames = Array.isArray(n.givenNames) ? n.givenNames.filter((x): x is string => typeof x === "string") : [];
    const surnames = parseSurnameRowsFromNamesJson(n.surnames);
    payload.names = { givenNames, surnames };
  }
  if (Object.prototype.hasOwnProperty.call(body, "birth")) {
    if (body.birth === null) {
      payload.birth = null;
    } else if (body.birth && typeof body.birth === "object") {
      const b = body.birth as Record<string, unknown>;
      payload.birth = { date: b.date, place: b.place };
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "death")) {
    if (body.death === null) {
      payload.death = null;
    } else if (body.death && typeof body.death === "object") {
      const d = body.death as Record<string, unknown>;
      payload.death = { date: d.date, place: d.place };
    }
  }
  if (typeof body.livingMode === "string" && (body.livingMode === "auto" || body.livingMode === "living" || body.livingMode === "deceased")) {
    payload.livingMode = body.livingMode;
  }
  if (Array.isArray(body.familiesAsSpouse)) {
    payload.familiesAsSpouse = body.familiesAsSpouse
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => ({ familyId: String(x.familyId ?? "") }))
      .filter((x) => x.familyId.length > 0);
  }
  if (Array.isArray(body.newSpouseFamilies)) {
    const out: NewSpouseFamilyPayload[] = [];
    for (const x of body.newSpouseFamilies) {
      if (x === null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const kind = o.kind === "new" ? "new" : o.kind === "existing" ? "existing" : "";
      if (kind === "existing") {
        const partnerIndividualId = String(o.partnerIndividualId ?? "").trim();
        if (partnerIndividualId) out.push({ kind: "existing", partnerIndividualId });
        continue;
      }
      if (kind === "new") {
        let givenNames: string[] = [];
        if (Array.isArray(o.givenNames)) {
          givenNames = o.givenNames.filter((g): g is string => typeof g === "string").map((g) => g.trim());
        } else if (typeof o.givenNames === "string") {
          givenNames = o.givenNames.trim().split(/\s+/).filter(Boolean);
        }
        const surname = typeof o.surname === "string" ? o.surname.trim() : "";
        if (givenNames.length > 0 && surname) out.push({ kind: "new", givenNames, surname });
      }
    }
    if (out.length > 0) payload.newSpouseFamilies = out;
  }
  if (Array.isArray(body.familiesAsChild)) {
    payload.familiesAsChild = body.familiesAsChild
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => ({
        familyId: String(x.familyId ?? ""),
        relationshipType: typeof x.relationshipType === "string" ? x.relationshipType : "biological",
        pedigree: typeof x.pedigree === "string" ? x.pedigree : null,
        birthOrder: typeof x.birthOrder === "number" ? x.birthOrder : null,
        ...(typeof x.relationshipToHusband === "string" && x.relationshipToHusband.trim()
          ? { relationshipToHusband: x.relationshipToHusband.trim() }
          : {}),
        ...(typeof x.relationshipToWife === "string" && x.relationshipToWife.trim()
          ? { relationshipToWife: x.relationshipToWife.trim() }
          : {}),
      }))
      .filter((x) => x.familyId.length > 0);
  }

  if (Array.isArray(body.newChildFamiliesFromNewParents)) {
    const ncOut: NewChildFamilyFromNewParentsPayload[] = [];
    for (const x of body.newChildFamiliesFromNewParents) {
      if (x === null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const p1 = parseNewChildFamilyParentField(o.parent1);
      const p2 = parseNewChildFamilyParentField(o.parent2);
      if (!p1 || !p2) continue;
      const pedigreeRaw = typeof o.pedigree === "string" ? o.pedigree.trim() : "";
      const pedigree = pedigreeRaw ? pedigreeRaw : null;
      const birthOrder = typeof o.birthOrder === "number" ? o.birthOrder : null;
      ncOut.push({ parent1: p1, parent2: p2, pedigree, birthOrder });
    }
    if (ncOut.length > 0) payload.newChildFamiliesFromNewParents = ncOut;
  }

  if (Array.isArray(body.addChildrenToSpouseFamilies)) {
    const acOut: AddChildToSpouseFamilyPayload[] = [];
    for (const x of body.addChildrenToSpouseFamilies) {
      if (x === null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const familyId = String(o.familyId ?? "").trim();
      if (!familyId) continue;
      const kind = o.kind === "new" ? "new" : o.kind === "existing" ? "existing" : "";
      if (!kind) continue;
      const relationshipType =
        typeof o.relationshipType === "string" && o.relationshipType.trim()
          ? o.relationshipType.trim()
          : "biological";
      const birthOrder =
        typeof o.birthOrder === "number" && Number.isFinite(o.birthOrder) ? Math.trunc(o.birthOrder) : null;
      if (kind === "existing") {
        const childIndividualId = String(o.childIndividualId ?? "").trim();
        if (!childIndividualId) continue;
        acOut.push({
          kind: "existing",
          familyId,
          childIndividualId,
          relationshipType,
          birthOrder,
        });
        continue;
      }
      let givenNames: string[] = [];
      if (Array.isArray(o.givenNames)) {
        givenNames = o.givenNames
          .filter((g): g is string => typeof g === "string")
          .map((g) => g.trim())
          .filter(Boolean);
      } else if (typeof o.givenNames === "string") {
        givenNames = o.givenNames.trim().split(/\s+/).filter(Boolean);
      }
      const surname = typeof o.surname === "string" ? o.surname.trim() : "";
      const su = typeof o.sex === "string" ? o.sex.trim().toUpperCase() : "";
      const sex = su === "M" || su === "F" || su === "U" || su === "X" ? su : null;
      if (givenNames.length === 0 || !surname || !sex) continue;
      acOut.push({
        kind: "new",
        familyId,
        givenNames,
        surname,
        sex,
        relationshipType,
        birthOrder,
      });
    }
    if (acOut.length > 0) payload.addChildrenToSpouseFamilies = acOut;
  }

  if (!payload.nameForms?.length && payload.names) {
    payload.nameForms = [
      {
        role: "primary",
        givenNames: payload.names.givenNames,
        surnames: payload.names.surnames,
      },
    ];
  }

  return payload;
}
