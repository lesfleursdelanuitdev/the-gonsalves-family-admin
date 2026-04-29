import { GedcomDateType, Prisma } from "@ligneous/prisma";
import {
  composePlaceOriginal,
  hashGedcomDateParts,
  hashGedcomPlaceOriginal,
} from "@/lib/gedcom/gedcom-entity-hash";

type Tx = Prisma.TransactionClient;

const GEDCOM_DATE_TYPES = new Set<string>(Object.values(GedcomDateType));

/** GEDCOM-style tags (and older client values) → Prisma `GedcomDateType`. */
const LEGACY_DATE_TYPE_TO_ENUM: Record<string, GedcomDateType> = {
  ABT: GedcomDateType.ABOUT,
  BEF: GedcomDateType.BEFORE,
  AFT: GedcomDateType.AFTER,
  BET: GedcomDateType.BETWEEN,
  CAL: GedcomDateType.CALCULATED,
  EST: GedcomDateType.ESTIMATED,
};

export function parseGedcomDateType(raw: unknown): GedcomDateType {
  if (typeof raw !== "string") return GedcomDateType.EXACT;
  const u = raw.trim().toUpperCase();
  if (!u) return GedcomDateType.EXACT;
  const mapped = LEGACY_DATE_TYPE_TO_ENUM[u];
  if (mapped) return mapped;
  if (GEDCOM_DATE_TYPES.has(u)) {
    return u as GedcomDateType;
  }
  return GedcomDateType.EXACT;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function hasMeaningfulDate(input: {
  dateType: GedcomDateType;
  original: string;
  year: number | null;
  month: number | null;
  day: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
}): boolean {
  if (input.dateType !== GedcomDateType.EXACT) return true;
  if (input.original.trim()) return true;
  return (
    input.year != null ||
    input.month != null ||
    input.day != null ||
    input.endYear != null ||
    input.endMonth != null ||
    input.endDay != null
  );
}

export function parseDateInput(raw: unknown): {
  dateType: GedcomDateType;
  original: string | null;
  calendar: string | null;
  year: number | null;
  month: number | null;
  day: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
} | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const dateType = parseGedcomDateType(o.dateType);
  const original = typeof o.original === "string" ? o.original.trim() : "";
  const calendar =
    typeof o.calendar === "string" && o.calendar.trim() ? o.calendar.trim() : "GREGORIAN";
  const year = numOrNull(o.year);
  const month = numOrNull(o.month);
  const day = numOrNull(o.day);
  const endYear = numOrNull(o.endYear);
  const endMonth = numOrNull(o.endMonth);
  const endDay = numOrNull(o.endDay);

  const parsed = { dateType, original, calendar, year, month, day, endYear, endMonth, endDay };
  if (!hasMeaningfulDate({ dateType, original, year, month, day, endYear, endMonth, endDay })) {
    return null;
  }
  return parsed;
}

export async function findOrCreateGedcomDate(tx: Tx, fileUuid: string, input: NonNullable<ReturnType<typeof parseDateInput>>) {
  const hash = hashGedcomDateParts({
    dateType: input.dateType,
    year: input.year,
    month: input.month,
    day: input.day,
    endYear: input.endYear,
    endMonth: input.endMonth,
    endDay: input.endDay,
  });

  const existing = await tx.gedcomDate.findFirst({
    where: { fileUuid, hash },
  });
  if (existing) return existing.id;

  const origTrim = (input.original ?? "").trim();
  const created = await tx.gedcomDate.create({
    data: {
      fileUuid,
      hash,
      dateType: input.dateType,
      calendar: input.calendar,
      original: origTrim ? origTrim : null,
      year: input.year,
      month: input.month,
      day: input.day,
      endYear: input.endYear,
      endMonth: input.endMonth,
      endDay: input.endDay,
    },
  });
  return created.id;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function parseOptionalDecimal(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}

export function parsePlaceInput(raw: unknown): {
  original: string;
  name: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
} | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = strOrNull(o.name);
  const county = strOrNull(o.county);
  const state = strOrNull(o.state);
  const country = strOrNull(o.country);
  let original = typeof o.original === "string" ? o.original.trim() : "";
  if (!original) {
    original = composePlaceOriginal({ name: name ?? "", county: county ?? "", state: state ?? "", country: country ?? "" });
  }
  const lat = parseOptionalDecimal(o.latitude);
  const lng = parseOptionalDecimal(o.longitude);

  if (!original && !name && !county && !state && !country && lat == null && lng == null) {
    return null;
  }

  return {
    original: original || composePlaceOriginal({ name: name ?? "", county: county ?? "", state: state ?? "", country: country ?? "" }),
    name,
    county,
    state,
    country,
    latitude: lat,
    longitude: lng,
  };
}

export async function findOrCreateGedcomPlace(tx: Tx, fileUuid: string, input: NonNullable<ReturnType<typeof parsePlaceInput>>) {
  const hash = hashGedcomPlaceOriginal(input.original || "");

  const existing = await tx.gedcomPlace.findFirst({
    where: { fileUuid, hash },
  });
  if (existing) return existing.id;

  const created = await tx.gedcomPlace.create({
    data: {
      fileUuid,
      hash,
      original: input.original || "",
      name: input.name,
      county: input.county,
      state: input.state,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
  return created.id;
}

export function parseLinkIds(body: Record<string, unknown>): { individualIds: string[]; familyIds: string[] } {
  const fromLinks = body.links;
  let individualIds: string[] = [];
  let familyIds: string[] = [];

  if (fromLinks && typeof fromLinks === "object") {
    const l = fromLinks as Record<string, unknown>;
    if (Array.isArray(l.individualIds)) {
      individualIds = l.individualIds.filter((x): x is string => typeof x === "string" && x.length > 0);
    }
    if (Array.isArray(l.familyIds)) {
      familyIds = l.familyIds.filter((x): x is string => typeof x === "string" && x.length > 0);
    }
  }

  if (typeof body.linkedIndividualId === "string" && body.linkedIndividualId.trim()) {
    individualIds.push(body.linkedIndividualId.trim());
  }
  if (typeof body.linkedFamilyId === "string" && body.linkedFamilyId.trim()) {
    familyIds.push(body.linkedFamilyId.trim());
  }

  individualIds = [...new Set(individualIds)];
  familyIds = [...new Set(familyIds)];

  return { individualIds, familyIds };
}

/** Deduped non-empty media UUID strings from `body.mediaIds` (for event ↔ media links). */
export function parseMediaIds(body: Record<string, unknown>): string[] {
  const raw = body.mediaIds;
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
  return [...new Set(ids)];
}
