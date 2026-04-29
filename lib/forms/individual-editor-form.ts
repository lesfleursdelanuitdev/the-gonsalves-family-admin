import type { LivingMode } from "@/lib/admin/admin-individual-living";
import type {
  AddChildToSpouseFamilyPayload,
  NewChildFamilyFromNewParentsPayload,
  NewChildFamilyFromNewParentsSinglePayload,
  NewSpouseFamilyPayload,
} from "@/lib/admin/admin-individual-editor-apply";
import { formatDisplayNameFromNameForms, type NameFormForDisplay } from "@/lib/gedcom/display-name";
import { gedcomDateSpecifierNeedsRange } from "@/lib/gedcom/gedcom-date-specifiers";

/** Client form state for birth or death (mirrors EventForm date/place JSON). */
export type KeyFactFormState = {
  dateSpecifier: string;
  dateOriginal: string;
  y: string;
  m: string;
  d: string;
  ey: string;
  em: string;
  ed: string;
  placeName: string;
  placeCounty: string;
  placeState: string;
  placeCountry: string;
  placeOriginal: string;
  placeLat: string;
  placeLng: string;
};

/** Date-only slice of `KeyFactFormState` for `GedcomDateInput`. */
export type GedcomDateFormSlice = Pick<
  KeyFactFormState,
  "dateSpecifier" | "dateOriginal" | "y" | "m" | "d" | "ey" | "em" | "ed"
>;

/** Place-only slice of `KeyFactFormState` for `GedcomPlaceInput`. */
export type GedcomPlaceFormSlice = Pick<
  KeyFactFormState,
  | "placeName"
  | "placeCounty"
  | "placeState"
  | "placeCountry"
  | "placeOriginal"
  | "placeLat"
  | "placeLng"
>;

/** One surname piece on the primary birth name form; `pieceType` matches DB `surname_piece_type`. */
export type SurnameFormRow = { text: string; pieceType: string };

/** API / DB row for PATCH / name sync (`pieceType` null = default). */
export type SurnamePayloadRow = { text: string; pieceType: string | null };

const SURNAME_PIECE_WHITELIST = new Set(["", "birth", "maiden", "married", "aka", "unknown"]);

/** UI + API: coerce to a allowed value or "". */
export function normalizeSurnamePieceType(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  return SURNAME_PIECE_WHITELIST.has(s) ? s : "";
}

export const SURNAME_PIECE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "birth", label: "Birth" },
  { value: "maiden", label: "Maiden" },
  { value: "married", label: "Married" },
  { value: "aka", label: "Also known as (AKA)" },
  { value: "unknown", label: "Unknown" },
];

export type NameFormRole = "primary" | "alias";

/** One editable name block (primary or alias) in the individual editor. */
export type NameFormEditorRow = {
  /** Stable React key; not sent when `dbId` is absent. */
  clientId: string;
  /** Persisted `gedcom_individual_name_forms.id` when loaded from the API. */
  dbId?: string;
  role: NameFormRole;
  /** Stored DB `name_type` for alias rows (round-trip). */
  aliasNameType: string;
  givenNames: string[];
  surnames: SurnameFormRow[];
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `nid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newEmptyNameFormEditorRow(role: NameFormRole = "alias"): NameFormEditorRow {
  return {
    clientId: newClientId(),
    role,
    aliasNameType: "aka",
    givenNames: [""],
    surnames: [{ text: "", pieceType: "" }],
  };
}

/** Display-only roster for “Families as child”; omitted in PATCH body. */
export type ChildInFamilySummary = {
  individualId: string;
  xref: string;
  displayName: string;
  sex: string | null;
  birthOrder: number | null;
};

/** One parent’s fields in the “create new parents” draft. */
export type ChildNewParentsParentFields = {
  givenNames: string;
  surname: string;
  sex: string;
  relationshipType: string;
  /** GEDCOM pedigree for this parent–child link (optional). */
  pedigree: string;
};

/** Draft for “add parents — create new people”; omitted from `familiesAsChild` ids in submit body. */
export type ChildNewParentsDraft =
  | { mode: "pair"; parent1: ChildNewParentsParentFields; parent2: ChildNewParentsParentFields }
  | {
      mode: "single";
      parent: ChildNewParentsParentFields;
      /** Add the new parent as spouse of this existing parent (see server `linkAsSpouse`). */
      linkAsSpouse?: {
        familyId: string;
        existingParentIndividualId: string;
        existingParentLabel: string;
      };
    };

export type ChildFamilyFormRow = {
  familyId: string;
  relationshipType: string;
  /** Default when per-partner fields are blank. */
  pedigree: string;
  relationshipToHusband: string;
  relationshipToWife: string;
  pedigreeToHusband: string;
  pedigreeToWife: string;
  birthOrder: string;
  /** Pending: create one or two new parents + FAM, then link this person as child on save. */
  pendingNewParents?: ChildNewParentsDraft;
  /** From GET individual detail or family picker; omitted in PATCH body. */
  parentHusbandDisplay?: string;
  parentWifeDisplay?: string;
  parentHusbandSex?: string;
  parentWifeSex?: string;
  parentHusbandId?: string;
  parentWifeId?: string;
  /** From individual detail or GET /api/admin/families/[id] after pick; omitted in PATCH body. */
  childrenInFamily?: ChildInFamilySummary[];
};

/** Queued in the spouse tab; applied on save via `addChildrenToSpouseFamilies`. */
export type PendingSpouseFamilyChildDraft =
  | {
      clientId: string;
      kind: "existing";
      childIndividualId: string;
      displayLabel: string;
      relationshipType: string;
      birthOrder: string;
    }
  | {
      clientId: string;
      kind: "new";
      givenNames: string;
      surname: string;
      sex: string;
      relationshipType: string;
      birthOrder: string;
    };

export type SpouseFamilyFormRow = {
  familyId: string;
  /**
   * Pending: create a new family at save with this partner (existing individual).
   * When set, `familyId` is empty until after save.
   */
  newFamilyExistingPartnerId?: string;
  newFamilyPartnerDisplay?: string;
  /** Pending: create a new individual (minimal name) + new family at save. */
  newFamilyNewPartner?: { givenNames: string; surname: string };
  /** GEDCOM husband / wife slots; from individual detail or family GET; omitted in PATCH body. */
  husbandDisplay?: string;
  wifeDisplay?: string;
  husbandSex?: string;
  wifeSex?: string;
  husbandId?: string;
  wifeId?: string;
  childrenInFamily?: ChildInFamilySummary[];
  /** Children to link to this family on save (subject must be a spouse in this family). */
  pendingSpouseFamilyChildren?: PendingSpouseFamilyChildDraft[];
};

export type IndividualEditorFormSeed = {
  xref: string;
  sex: string;
  nameForms: NameFormEditorRow[];
  birth: KeyFactFormState;
  death: KeyFactFormState;
  livingMode: LivingMode;
  familiesAsSpouse: SpouseFamilyFormRow[];
  familiesAsChild: ChildFamilyFormRow[];
};

export function emptyKeyFactFormState(): KeyFactFormState {
  return {
    dateSpecifier: "EXACT",
    dateOriginal: "",
    y: "",
    m: "",
    d: "",
    ey: "",
    em: "",
    ed: "",
    placeName: "",
    placeCounty: "",
    placeState: "",
    placeCountry: "",
    placeOriginal: "",
    placeLat: "",
    placeLng: "",
  };
}

function decToInputString(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? String(n) : s;
}

function intToStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return "";
}

export function keyFactStateFromDateAndPlace(date: unknown, place: unknown): KeyFactFormState {
  const s = emptyKeyFactFormState();
  if (date && typeof date === "object") {
    const d = date as Record<string, unknown>;
    s.dateSpecifier = d.dateType != null && d.dateType !== "" ? String(d.dateType) : "EXACT";
    s.dateOriginal = String(d.original ?? "").trim();
    s.y = intToStr(d.year);
    s.m = intToStr(d.month);
    s.d = intToStr(d.day);
    s.ey = intToStr(d.endYear);
    s.em = intToStr(d.endMonth);
    s.ed = intToStr(d.endDay);
  }
  if (place && typeof place === "object") {
    const p = place as Record<string, unknown>;
    s.placeName = String(p.name ?? "").trim();
    s.placeCounty = String(p.county ?? "").trim();
    s.placeState = String(p.state ?? "").trim();
    s.placeCountry = String(p.country ?? "").trim();
    s.placeOriginal = String(p.original ?? "").trim();
    s.placeLat = decToInputString(p.latitude);
    s.placeLng = decToInputString(p.longitude);
  }
  return s;
}

/**
 * When `GedcomDate` / `GedcomPlace` relations are null but denormalized columns exist (or only display text),
 * prefill the form so edit mode matches the detail view.
 */
export function enrichKeyFactFromDenormalized(
  fact: KeyFactFormState,
  opts: { displayDate?: unknown; displayPlace?: unknown; year?: unknown },
): KeyFactFormState {
  const s = { ...fact };
  const hasStructuredDate =
    Boolean(s.y?.trim()) ||
    Boolean(s.m?.trim()) ||
    Boolean(s.d?.trim()) ||
    Boolean(s.dateOriginal?.trim()) ||
    Boolean(s.ey?.trim() || s.em?.trim() || s.ed?.trim()) ||
    (s.dateSpecifier && s.dateSpecifier !== "EXACT");
  if (!hasStructuredDate && opts.displayDate != null) {
    const t = String(opts.displayDate).trim();
    if (t) s.dateOriginal = t;
  }
  if (!s.y?.trim() && opts.year != null) {
    const y = typeof opts.year === "number" ? opts.year : Number(opts.year);
    if (Number.isFinite(y)) s.y = String(Math.trunc(y));
  }
  const hasPlace =
    Boolean(s.placeName?.trim()) ||
    Boolean(s.placeCounty?.trim()) ||
    Boolean(s.placeState?.trim()) ||
    Boolean(s.placeCountry?.trim()) ||
    Boolean(s.placeOriginal?.trim()) ||
    Boolean(s.placeLat?.trim()) ||
    Boolean(s.placeLng?.trim());
  if (!hasPlace && opts.displayPlace != null) {
    const t = String(opts.displayPlace).trim();
    if (t) s.placeOriginal = t;
  }
  return s;
}

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** `null` = clear fact; object = upsert (date/place keys optional). */
export function keyFactToApiValue(fact: KeyFactFormState): Record<string, unknown> | null {
  const showRange = gedcomDateSpecifierNeedsRange(fact.dateSpecifier);
  const year = parseYm(fact.y);
  const month = parseYm(fact.m);
  const day = parseYm(fact.d);
  const endYear = parseYm(fact.ey);
  const endMonth = parseYm(fact.em);
  const endDay = parseYm(fact.ed);
  const orig = fact.dateOriginal.trim();
  const isDefaultExact =
    fact.dateSpecifier === "EXACT" &&
    !orig &&
    year == null &&
    month == null &&
    day == null &&
    endYear == null &&
    endMonth == null &&
    endDay == null;
  const date =
    isDefaultExact
      ? undefined
      : {
          dateType: fact.dateSpecifier,
          calendar: "GREGORIAN",
          ...(orig ? { original: orig } : {}),
          year,
          month,
          day,
          endYear: showRange ? endYear : null,
          endMonth: showRange ? endMonth : null,
          endDay: showRange ? endDay : null,
        };

  const name = fact.placeName.trim();
  const county = fact.placeCounty.trim();
  const state = fact.placeState.trim();
  const country = fact.placeCountry.trim();
  const original = fact.placeOriginal.trim();
  const lat = fact.placeLat.trim();
  const lng = fact.placeLng.trim();
  const place =
    !name && !county && !state && !country && !original && !lat && !lng
      ? undefined
      : {
          ...(original ? { original } : {}),
          ...(name ? { name } : {}),
          ...(county ? { county } : {}),
          ...(state ? { state } : {}),
          ...(country ? { country } : {}),
          ...(lat ? { latitude: Number(lat) } : {}),
          ...(lng ? { longitude: Number(lng) } : {}),
        };

  if (!date && !place) return null;
  const out: Record<string, unknown> = {};
  if (date) out.date = date;
  if (place) out.place = place;
  return out;
}

function extractGivenNamesFromForm(form: Record<string, unknown> | undefined): string[] {
  if (!form) return [""];
  const givens =
    (form.givenNames as { givenName?: { givenName?: string | null } | null }[] | undefined)
      ?.map((g) => String(g?.givenName?.givenName ?? "").trim())
      .filter((s) => s.length > 0) ?? [];
  return givens.length ? givens : [""];
}

function extractSurnameRowsFromForm(form: Record<string, unknown> | undefined): SurnameFormRow[] {
  if (!form) return [{ text: "", pieceType: "" }];
  const rows =
    (form.surnames as
      | { surname?: { surname?: string | null } | null; surnamePieceType?: string | null }[]
      | undefined) ?? [];
  const out: SurnameFormRow[] = rows.map((row) => ({
    text: String(row?.surname?.surname ?? "").trim(),
    pieceType: normalizeSurnamePieceType(String(row?.surnamePieceType ?? "")),
  }));
  const nonEmpty = out.filter((r) => r.text.length > 0);
  return nonEmpty.length ? nonEmpty : [{ text: "", pieceType: "" }];
}

/**
 * Resolves GEDCOM sex (M/F/U/X) for UI from an individual slice returned by admin includes
 * (`sex` enum and optional free-text `gender` when sex is unknown).
 */
export function parentSexFromIndividualRecord(indi: unknown): string | undefined {
  if (!indi || typeof indi !== "object") return undefined;
  const o = indi as Record<string, unknown>;
  if (o.sex != null && o.sex !== "") {
    const s = String(o.sex).trim().toUpperCase();
    if (s) return s;
  }
  const g = typeof o.gender === "string" ? o.gender.trim().toLowerCase() : "";
  if (!g) return undefined;
  if (g === "m" || g === "male" || g.startsWith("male")) return "M";
  if (g === "f" || g === "female" || g.startsWith("female")) return "F";
  return undefined;
}

function partnerDisplayFromIncludedIndividual(indi: unknown): string {
  if (!indi || typeof indi !== "object") return "";
  const o = indi as Record<string, unknown>;
  const name = formatDisplayNameFromNameForms(
    o.individualNameForms as NameFormForDisplay[] | null | undefined,
    typeof o.fullName === "string" ? o.fullName : null,
  ).trim();
  if (name) return name;
  const xref = o.xref != null ? String(o.xref).trim() : "";
  if (xref) return xref;
  const id = typeof o.id === "string" ? o.id : "";
  return id ? `${id.slice(0, 8)}…` : "";
}

/**
 * Normalizes `family.familyChildren` from individual detail or family GET (Prisma junction and/or merged rows).
 */
export function familyChildrenToSummaries(familyChildren: unknown): ChildInFamilySummary[] {
  const rows = Array.isArray(familyChildren) ? familyChildren : [];
  const out: ChildInFamilySummary[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const child = o.child;
    const c =
      child && typeof child === "object" ? (child as Record<string, unknown>) : undefined;
    const individualId =
      (c && typeof c.id === "string" && c.id) ||
      (typeof o.childId === "string" && o.childId) ||
      "";
    if (!individualId) continue;
    const bo = o.birthOrder;
    const birthOrder =
      bo != null && typeof bo === "number" && Number.isFinite(bo) ? Math.trunc(bo) : null;
    const display = c
      ? partnerDisplayFromIncludedIndividual(c) ||
        String(c.fullName ?? "").trim() ||
        (typeof c.xref === "string" ? c.xref.trim() : "") ||
        `${individualId.slice(0, 8)}…`
      : `${individualId.slice(0, 8)}…`;
    const sexFromRecord = c ? parentSexFromIndividualRecord(c) : undefined;
    const sex =
      sexFromRecord ??
      (c && c.sex != null && String(c.sex).trim()
        ? String(c.sex).trim().toUpperCase()
        : null);
    const xref = c && typeof c.xref === "string" ? c.xref : "";
    out.push({ individualId, xref, displayName: display, sex, birthOrder });
  }
  out.sort((a, b) => {
    const ao = a.birthOrder ?? 10_000;
    const bo = b.birthOrder ?? 10_000;
    if (ao !== bo) return ao - bo;
    return a.displayName.localeCompare(b.displayName);
  });
  return out;
}

/** Build spouse row display from a family object (individual include or GET /api/admin/families/[id]). */
export function spouseFamilyRowFromFamilyRecord(
  familyId: string,
  fam: Record<string, unknown> | undefined | null,
): SpouseFamilyFormRow {
  if (!fam) return { familyId };
  const husbandLabel = partnerDisplayFromIncludedIndividual(fam.husband);
  const wifeLabel = partnerDisplayFromIncludedIndividual(fam.wife);
  const husbandSex = parentSexFromIndividualRecord(fam.husband);
  const wifeSex = parentSexFromIndividualRecord(fam.wife);
  const husbandRec = fam.husband as Record<string, unknown> | undefined;
  const wifeRec = fam.wife as Record<string, unknown> | undefined;
  const husbandId = typeof husbandRec?.id === "string" ? husbandRec.id : undefined;
  const wifeId = typeof wifeRec?.id === "string" ? wifeRec.id : undefined;
  return {
    familyId,
    ...(husbandLabel ? { husbandDisplay: husbandLabel } : {}),
    ...(wifeLabel ? { wifeDisplay: wifeLabel } : {}),
    ...(husbandSex ? { husbandSex } : {}),
    ...(wifeSex ? { wifeSex } : {}),
    ...(husbandId ? { husbandId } : {}),
    ...(wifeId ? { wifeId } : {}),
    childrenInFamily: familyChildrenToSummaries(fam.familyChildren),
  };
}

/** Map GET /api/admin/individuals/[id] `individual` into form seed. */
export function individualDetailToFormSeed(ind: Record<string, unknown>): IndividualEditorFormSeed {
  const rawForms = (ind.individualNameForms as Record<string, unknown>[] | undefined) ?? [];
  const sorted = [...rawForms].sort((a, b) => {
    const ap = Boolean(a.isPrimary);
    const bp = Boolean(b.isPrimary);
    if (ap !== bp) return ap ? -1 : 1;
    const so = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    if (so !== 0) return so;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });

  const nameForms: NameFormEditorRow[] =
    sorted.length > 0
      ? (() => {
          const primaryIdx = sorted.findIndex((f) => Boolean(f.isPrimary));
          const effectivePrimaryIdx = primaryIdx >= 0 ? primaryIdx : 0;
          return sorted.map((f, index) => {
            const id = typeof f.id === "string" && f.id.trim() ? f.id.trim() : "";
            const isPrimary = index === effectivePrimaryIdx;
            const nt = String(f.nameType ?? "").toLowerCase();
            return {
              clientId: id || newClientId(),
              ...(id ? { dbId: id } : {}),
              role: isPrimary ? "primary" : "alias",
              aliasNameType: isPrimary ? "aka" : nt || "aka",
              givenNames: extractGivenNamesFromForm(f),
              surnames: extractSurnameRowsFromForm(f),
            };
          });
        })()
      : [newEmptyNameFormEditorRow("primary")];

  const husbandFams = (ind.husbandInFamilies as Record<string, unknown>[] | undefined) ?? [];
  const wifeFams = (ind.wifeInFamilies as Record<string, unknown>[] | undefined) ?? [];
  const spouseSeen = new Set<string>();
  const familiesAsSpouse: SpouseFamilyFormRow[] = [];
  for (const raw of [...husbandFams, ...wifeFams]) {
    const fid = typeof raw.id === "string" ? raw.id : "";
    if (!fid || spouseSeen.has(fid)) continue;
    spouseSeen.add(fid);
    familiesAsSpouse.push(spouseFamilyRowFromFamilyRecord(fid, raw));
  }

  const fcRows = (ind.familyChildAsChild as Record<string, unknown>[] | undefined) ?? [];
  const parentRows =
    (ind.parentAsChild as
      | {
          familyId: string;
          parentId: string;
          relationshipType?: string | null;
          pedigree?: string | null;
        }[]
      | undefined) ?? [];
  const byFamilyParents = new Map<
    string,
    { parentId: string; relationshipType: string; pedigree: string }[]
  >();
  for (const p of parentRows) {
    if (!p?.familyId || !p?.parentId) continue;
    const arr = byFamilyParents.get(p.familyId) ?? [];
    arr.push({
      parentId: p.parentId,
      relationshipType: (p.relationshipType ?? "biological").trim() || "biological",
      pedigree: p.pedigree?.trim() ?? "",
    });
    byFamilyParents.set(p.familyId, arr);
  }

  const familiesAsChild: ChildFamilyFormRow[] = fcRows.map((row) => {
    const fam = row.family as Record<string, unknown> | undefined;
    const fid =
      typeof row.familyId === "string"
        ? row.familyId
        : typeof fam?.id === "string"
          ? fam.id
          : "";
    const pcList = byFamilyParents.get(fid) ?? [];
    const bo = row.birthOrder;
    const birthOrderStr =
      bo != null && typeof bo === "number" && Number.isFinite(bo) ? String(Math.trunc(bo)) : "";
    const husbandLabel = partnerDisplayFromIncludedIndividual(fam?.husband);
    const wifeLabel = partnerDisplayFromIncludedIndividual(fam?.wife);
    const husbandSex = parentSexFromIndividualRecord(fam?.husband);
    const wifeSex = parentSexFromIndividualRecord(fam?.wife);
    const husbandRec = fam?.husband as Record<string, unknown> | undefined;
    const wifeRec = fam?.wife as Record<string, unknown> | undefined;
    const parentHusbandId = typeof husbandRec?.id === "string" ? husbandRec.id : undefined;
    const parentWifeId = typeof wifeRec?.id === "string" ? wifeRec.id : undefined;
    let relationshipToHusband = "";
    let relationshipToWife = "";
    let pedigreeToHusband = "";
    let pedigreeToWife = "";
    for (const pc of pcList) {
      if (parentHusbandId && pc.parentId === parentHusbandId) {
        relationshipToHusband = pc.relationshipType;
        pedigreeToHusband = pc.pedigree;
      }
      if (parentWifeId && pc.parentId === parentWifeId) {
        relationshipToWife = pc.relationshipType;
        pedigreeToWife = pc.pedigree;
      }
    }
    const relationshipType = relationshipToHusband || relationshipToWife || "biological";
    const pedigree = pedigreeToHusband || pedigreeToWife || "";
    return {
      familyId: fid,
      relationshipType,
      pedigree,
      relationshipToHusband: relationshipToHusband || relationshipType,
      relationshipToWife: relationshipToWife || relationshipType,
      pedigreeToHusband,
      pedigreeToWife,
      birthOrder: birthOrderStr,
      ...(husbandLabel ? { parentHusbandDisplay: husbandLabel } : {}),
      ...(wifeLabel ? { parentWifeDisplay: wifeLabel } : {}),
      ...(husbandSex ? { parentHusbandSex: husbandSex } : {}),
      ...(wifeSex ? { parentWifeSex: wifeSex } : {}),
      ...(parentHusbandId ? { parentHusbandId } : {}),
      ...(parentWifeId ? { parentWifeId } : {}),
      childrenInFamily: familyChildrenToSummaries(fam?.familyChildren),
    };
  });

  const birthBase = keyFactStateFromDateAndPlace(ind.birthDate, ind.birthPlace);
  const deathBase = keyFactStateFromDateAndPlace(ind.deathDate, ind.deathPlace);

  return {
    xref: String(ind.xref ?? ""),
    sex: ind.sex != null ? String(ind.sex) : "",
    nameForms,
    birth: enrichKeyFactFromDenormalized(birthBase, {
      displayDate: ind.birthDateDisplay,
      displayPlace: ind.birthPlaceDisplay,
      year: ind.birthYear,
    }),
    death: enrichKeyFactFromDenormalized(deathBase, {
      displayDate: ind.deathDateDisplay,
      displayPlace: ind.deathPlaceDisplay,
      year: ind.deathYear,
    }),
    livingMode: "auto",
    familiesAsSpouse,
    familiesAsChild,
  };
}

export function emptyIndividualEditorFormSeed(): IndividualEditorFormSeed {
  return {
    xref: "",
    sex: "",
    nameForms: [newEmptyNameFormEditorRow("primary")],
    birth: emptyKeyFactFormState(),
    death: emptyKeyFactFormState(),
    livingMode: "auto",
    familiesAsSpouse: [],
    familiesAsChild: [],
  };
}

/** Preview string aligned with `composeFullNameFromParts` (birth name). */
export function previewFullNameFromParts(givenNames: string[], surnames: string[]): string {
  const g = givenNames.map((s) => s.trim()).filter(Boolean);
  const s = surnames.map((x) => x.trim()).filter(Boolean);
  const givenPart = g.join(" ");
  const surPart = s.join(" ");
  if (givenPart && surPart) return `${givenPart} / ${surPart}`;
  if (givenPart) return givenPart;
  if (surPart) return surPart;
  return "";
}

export function buildEditorSubmitBody(seed: IndividualEditorFormSeed): Record<string, unknown> {
  const birthVal = keyFactToApiValue(seed.birth);
  const deathVal = keyFactToApiValue(seed.death);
  const familiesAsChild = seed.familiesAsChild
    .filter((r) => r.familyId.trim())
    .map((r) => {
      let birthOrder: number | null = null;
      if (r.birthOrder.trim()) {
        const n = Math.trunc(Number(r.birthOrder));
        if (Number.isFinite(n)) birthOrder = n;
      }
      const rt = r.relationshipType.trim() || "biological";
      const relH = (r.relationshipToHusband || rt).trim() || "biological";
      const relW = (r.relationshipToWife || rt).trim() || "biological";
      return {
        familyId: r.familyId.trim(),
        relationshipType: rt,
        relationshipToHusband: relH,
        relationshipToWife: relW,
        pedigree: r.pedigree.trim() || null,
        pedigreeToHusband: r.pedigreeToHusband.trim() || null,
        pedigreeToWife: r.pedigreeToWife.trim() || null,
        birthOrder,
      };
    });

  const newChildFamiliesFromNewParents: NewChildFamilyFromNewParentsPayload[] = [];
  for (const r of seed.familiesAsChild) {
    const d = r.pendingNewParents;
    if (!d) continue;
    const okSex = (s: string) => s === "M" || s === "F" || s === "U" || s === "X";
    let birthOrder: number | null = null;
    if (r.birthOrder.trim()) {
      const n = Math.trunc(Number(r.birthOrder));
      if (Number.isFinite(n)) birthOrder = n;
    }
    const rowPedigree = r.pedigree.trim() || null;

    if (d.mode === "single") {
      const g = d.parent.givenNames.trim().split(/\s+/).filter(Boolean);
      const sur = d.parent.surname.trim();
      const sx = d.parent.sex.trim().toUpperCase();
      if (g.length > 0 && sur && okSex(sx)) {
        const rt = d.parent.relationshipType.trim() || "biological";
        const parentPed = d.parent.pedigree.trim() || null;
        const single: NewChildFamilyFromNewParentsSinglePayload = {
          kind: "single",
          parent: {
            givenNames: g,
            surname: sur,
            sex: sx as "M" | "F" | "U" | "X",
            relationshipType: rt,
            pedigree: parentPed,
          },
          birthOrder,
        };
        if (rowPedigree) single.pedigree = rowPedigree;
        if (d.linkAsSpouse?.familyId && d.linkAsSpouse.existingParentIndividualId) {
          single.linkAsSpouse = {
            familyId: d.linkAsSpouse.familyId,
            existingParentIndividualId: d.linkAsSpouse.existingParentIndividualId,
          };
        }
        newChildFamiliesFromNewParents.push(single);
      }
      continue;
    }

    const g1 = d.parent1.givenNames.trim().split(/\s+/).filter(Boolean);
    const g2 = d.parent2.givenNames.trim().split(/\s+/).filter(Boolean);
    const s1 = d.parent1.surname.trim();
    const s2 = d.parent2.surname.trim();
    const sx1 = d.parent1.sex.trim().toUpperCase();
    const sx2 = d.parent2.sex.trim().toUpperCase();
    if (g1.length > 0 && s1 && okSex(sx1) && g2.length > 0 && s2 && okSex(sx2)) {
      const rt1 = d.parent1.relationshipType.trim() || "biological";
      const rt2 = d.parent2.relationshipType.trim() || "biological";
      const ped1 = d.parent1.pedigree.trim() || null;
      const ped2 = d.parent2.pedigree.trim() || null;
      newChildFamiliesFromNewParents.push({
        kind: "pair",
        parent1: {
          givenNames: g1,
          surname: s1,
          sex: sx1 as "M" | "F" | "U" | "X",
          relationshipType: rt1,
          pedigree: ped1,
        },
        parent2: {
          givenNames: g2,
          surname: s2,
          sex: sx2 as "M" | "F" | "U" | "X",
          relationshipType: rt2,
          pedigree: ped2,
        },
        pedigree: rowPedigree,
        birthOrder,
      });
    }
  }
  const familiesAsSpouse = seed.familiesAsSpouse
    .filter((r) => r.familyId.trim())
    .map((r) => ({ familyId: r.familyId.trim() }));

  const newSpouseFamilies: NewSpouseFamilyPayload[] = [];
  for (const r of seed.familiesAsSpouse) {
    const pid = r.newFamilyExistingPartnerId?.trim();
    if (pid) {
      newSpouseFamilies.push({ kind: "existing", partnerIndividualId: pid });
      continue;
    }
    const np = r.newFamilyNewPartner;
    if (np) {
      const gLine = np.givenNames.trim();
      const sur = np.surname.trim();
      const givenNames = gLine.split(/\s+/).filter(Boolean);
      if (givenNames.length > 0 && sur) {
        newSpouseFamilies.push({ kind: "new", givenNames, surname: sur });
      }
    }
  }

  const addChildrenToSpouseFamilies: AddChildToSpouseFamilyPayload[] = [];
  for (const r of seed.familiesAsSpouse) {
    const fid = r.familyId.trim();
    if (!fid || !r.pendingSpouseFamilyChildren?.length) continue;
    for (const p of r.pendingSpouseFamilyChildren) {
      let birthOrder: number | null = null;
      if (p.birthOrder.trim()) {
        const n = Math.trunc(Number(p.birthOrder));
        if (Number.isFinite(n)) birthOrder = n;
      }
      const relationshipType = p.relationshipType.trim() || "biological";
      if (p.kind === "existing") {
        addChildrenToSpouseFamilies.push({
          kind: "existing",
          familyId: fid,
          childIndividualId: p.childIndividualId.trim(),
          relationshipType,
          birthOrder,
        });
      } else {
        const givenNames = p.givenNames.trim().split(/\s+/).filter(Boolean);
        const surname = p.surname.trim();
        const sx = p.sex.trim().toUpperCase();
        if (givenNames.length === 0 || !surname || (sx !== "M" && sx !== "F" && sx !== "U" && sx !== "X")) {
          continue;
        }
        addChildrenToSpouseFamilies.push({
          kind: "new",
          familyId: fid,
          givenNames,
          surname,
          sex: sx as "M" | "F" | "U" | "X",
          relationshipType,
          birthOrder,
        });
      }
    }
  }

  const sexUpper = seed.sex.trim().toUpperCase();
  const sex =
    sexUpper === "M" || sexUpper === "F" || sexUpper === "U" || sexUpper === "X" ? sexUpper : null;

  return {
    sex,
    nameForms: seed.nameForms.map((f) => ({
      ...(f.dbId ? { id: f.dbId } : {}),
      role: f.role,
      ...(f.role === "alias"
        ? { aliasNameType: f.aliasNameType.trim() || "aka" }
        : { aliasNameType: null }),
      givenNames: f.givenNames.map((s) => s.trim()),
      surnames: f.surnames
        .map((r) => ({
          text: r.text.trim(),
          pieceType: normalizeSurnamePieceType(r.pieceType),
        }))
        .filter((r) => r.text.length > 0),
    })),
    birth: birthVal === null ? null : birthVal,
    death: deathVal === null ? null : deathVal,
    livingMode: seed.livingMode,
    familiesAsSpouse,
    ...(newSpouseFamilies.length > 0 ? { newSpouseFamilies } : {}),
    familiesAsChild,
    ...(newChildFamiliesFromNewParents.length > 0 ? { newChildFamiliesFromNewParents } : {}),
    ...(addChildrenToSpouseFamilies.length > 0 ? { addChildrenToSpouseFamilies } : {}),
  };
}
