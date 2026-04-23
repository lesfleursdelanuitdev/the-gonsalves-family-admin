/**
 * Sync between /admin/events filter panel and URL query params (same names as GET /api/admin/events).
 */

export const ADMIN_EVENTS_FILTER_QUERY_KEYS = [
  "eventType",
  "placeContains",
  "dateYearMin",
  "dateYearMax",
  "linkType",
  "linkedGiven",
  "linkedLast",
] as const;

export type AdminEventsUrlFilterState = {
  eventType: string;
  placeContains: string;
  dateYearMin: string;
  dateYearMax: string;
  linkType: string;
  linkedGiven: string;
  linkedLast: string;
};

export const ADMIN_EVENTS_FILTER_DEFAULTS: AdminEventsUrlFilterState = {
  eventType: "",
  placeContains: "",
  dateYearMin: "",
  dateYearMax: "",
  linkType: "",
  linkedGiven: "",
  linkedLast: "",
};

export function hasAdminEventsFilterQueryKeys(sp: URLSearchParams): boolean {
  return ADMIN_EVENTS_FILTER_QUERY_KEYS.some((k) => sp.has(k));
}

export function parseAdminEventsFiltersFromSearchParams(
  sp: URLSearchParams,
): Partial<AdminEventsUrlFilterState> {
  const out: Partial<AdminEventsUrlFilterState> = {};
  const get = (k: string) => {
    const v = sp.get(k);
    return v !== null ? v : undefined;
  };
  const et = get("eventType");
  if (et !== undefined) out.eventType = et;
  const pc = get("placeContains");
  if (pc !== undefined) out.placeContains = pc;
  const dmin = get("dateYearMin");
  if (dmin !== undefined) out.dateYearMin = dmin;
  const dmax = get("dateYearMax");
  if (dmax !== undefined) out.dateYearMax = dmax;
  const lt = get("linkType");
  if (lt === "individual" || lt === "family") out.linkType = lt;
  const lg = get("linkedGiven");
  if (lg !== undefined) out.linkedGiven = lg;
  const ll = get("linkedLast");
  if (ll !== undefined) out.linkedLast = ll;
  return out;
}

export function mergeAdminEventsFilterDefaults(
  partial: Partial<AdminEventsUrlFilterState>,
): AdminEventsUrlFilterState {
  return { ...ADMIN_EVENTS_FILTER_DEFAULTS, ...partial };
}

/** Serialize non-empty filter fields for router.replace. */
export function adminEventsFiltersToSearchParams(
  f: AdminEventsUrlFilterState,
): URLSearchParams {
  const p = new URLSearchParams();
  const t = (s: string) => s.trim();
  if (t(f.eventType)) p.set("eventType", t(f.eventType));
  if (t(f.placeContains)) p.set("placeContains", t(f.placeContains));
  if (t(f.dateYearMin)) p.set("dateYearMin", t(f.dateYearMin));
  if (t(f.dateYearMax)) p.set("dateYearMax", t(f.dateYearMax));
  if (f.linkType === "individual" || f.linkType === "family") {
    p.set("linkType", f.linkType);
  }
  if (t(f.linkedGiven)) p.set("linkedGiven", t(f.linkedGiven));
  if (t(f.linkedLast)) p.set("linkedLast", t(f.linkedLast));
  return p;
}

export function adminEventsPathWithFilters(f: AdminEventsUrlFilterState): string {
  const p = adminEventsFiltersToSearchParams(f);
  const q = p.toString();
  return q ? `/admin/events?${q}` : "/admin/events";
}

/** Deep link from Places catalog: events whose place text contains this original PLAC. */
export function adminEventsHrefForPlaceOriginal(original: string): string {
  return adminEventsPathWithFilters({
    ...ADMIN_EVENTS_FILTER_DEFAULTS,
    placeContains: original,
  });
}

/** Deep link from Dates catalog: events whose linked date uses this calendar year. */
export function adminEventsHrefForDateYear(year: number): string {
  const y = String(year);
  return adminEventsPathWithFilters({
    ...ADMIN_EVENTS_FILTER_DEFAULTS,
    dateYearMin: y,
    dateYearMax: y,
  });
}

/** Link styling: catalog row → events list. */
export const adminCatalogToEventsLinkClass =
  "text-primary font-medium underline-offset-2 hover:underline";
