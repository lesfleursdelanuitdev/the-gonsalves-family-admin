/**
 * Sync between /admin/individuals filter panel + search (q) and URL query params
 * (same names as GET /api/admin/individuals).
 */

import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export const ADMIN_INDIVIDUALS_FILTER_QUERY_KEYS = [
  "q",
  "sex",
  "living",
  "givenName",
  "lastName",
  "birthYearMin",
  "birthYearMax",
  "deathYearMin",
  "deathYearMax",
] as const;

export type AdminIndividualsUrlFilterState = {
  q: string;
  sex: string;
  living: string;
  givenName: string;
  lastName: string;
  birthYearMin: string;
  birthYearMax: string;
  deathYearMin: string;
  deathYearMax: string;
};

export const ADMIN_INDIVIDUALS_FILTER_DEFAULTS: AdminIndividualsUrlFilterState = {
  q: "",
  sex: "",
  living: "",
  givenName: "",
  lastName: "",
  birthYearMin: "",
  birthYearMax: "",
  deathYearMin: "",
  deathYearMax: "",
};

const GEDCOM_SEX = new Set(["M", "F", "U", "X"]);

export function hasAdminIndividualsFilterQueryKeys(sp: URLSearchParams): boolean {
  return ADMIN_INDIVIDUALS_FILTER_QUERY_KEYS.some((k) => sp.has(k));
}

export function parseAdminIndividualsFiltersFromSearchParams(
  sp: URLSearchParams,
): Partial<AdminIndividualsUrlFilterState> {
  const out: Partial<AdminIndividualsUrlFilterState> = {};
  const q = sp.get("q");
  if (q !== null) out.q = q;
  const sexRaw = sp.get("sex");
  if (sexRaw !== null) {
    const u = sexRaw.toUpperCase();
    if (GEDCOM_SEX.has(u)) out.sex = u;
  }
  if (sp.has("living")) {
    const lv = sp.get("living");
    if (lv === "true" || lv === "false") out.living = lv;
  }
  const gn = sp.get("givenName");
  if (gn !== null) out.givenName = gn;
  const ln = sp.get("lastName");
  if (ln !== null) out.lastName = ln;
  for (const k of ["birthYearMin", "birthYearMax", "deathYearMin", "deathYearMax"] as const) {
    const v = sp.get(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export function mergeAdminIndividualsFilterDefaults(
  partial: Partial<AdminIndividualsUrlFilterState>,
): AdminIndividualsUrlFilterState {
  return { ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS, ...partial };
}

export function adminIndividualsFiltersToSearchParams(
  f: AdminIndividualsUrlFilterState,
): URLSearchParams {
  const p = new URLSearchParams();
  const t = (s: string) => s.trim();
  if (t(f.q)) p.set("q", t(f.q));
  if (t(f.sex)) p.set("sex", t(f.sex).toUpperCase());
  if (f.living === "true" || f.living === "false") p.set("living", f.living);
  if (t(f.givenName)) p.set("givenName", t(f.givenName));
  if (t(f.lastName)) p.set("lastName", t(f.lastName));
  if (t(f.birthYearMin)) p.set("birthYearMin", t(f.birthYearMin));
  if (t(f.birthYearMax)) p.set("birthYearMax", t(f.birthYearMax));
  if (t(f.deathYearMin)) p.set("deathYearMin", t(f.deathYearMin));
  if (t(f.deathYearMax)) p.set("deathYearMax", t(f.deathYearMax));
  return p;
}

export function adminIndividualsPathWithFilters(f: AdminIndividualsUrlFilterState): string {
  const p = adminIndividualsFiltersToSearchParams(f);
  const q = p.toString();
  return q ? `/admin/individuals?${q}` : "/admin/individuals";
}

/** From Given names catalog: individuals whose structured given names contain this token. */
export function adminIndividualsHrefForGivenName(givenName: string): string {
  return adminIndividualsPathWithFilters({
    ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS,
    givenName,
  });
}

/**
 * From Surnames catalog: individuals matching last-name prefix semantics (GEDCOM slash-aware),
 * using the stored catalog `surname` value (slashes stripped for the prefix param).
 */
export function adminIndividualsHrefForSurname(surname: string): string {
  const prefix = stripSlashesFromName(surname) || surname.trim();
  return adminIndividualsPathWithFilters({
    ...ADMIN_INDIVIDUALS_FILTER_DEFAULTS,
    lastName: prefix,
  });
}

export const adminCatalogToIndividualsLinkClass =
  "text-primary font-medium underline-offset-2 hover:underline";
