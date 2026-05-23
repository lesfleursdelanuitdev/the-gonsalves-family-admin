/**
 * Sync between /admin/attributes filter panel and URL query params
 * (same names as GET /api/admin/attributes).
 */

export const ADMIN_ATTRIBUTES_FILTER_QUERY_KEYS = [
  "attributeType",
  "customTypeContains",
  "valueContains",
  "placeContains",
  "linkType",
  "linkedGiven",
  "linkedLast",
] as const;

export type AdminAttributesUrlFilterState = {
  attributeType: string;
  customTypeContains: string;
  valueContains: string;
  placeContains: string;
  linkType: string;
  linkedGiven: string;
  linkedLast: string;
};

export const ADMIN_ATTRIBUTES_FILTER_DEFAULTS: AdminAttributesUrlFilterState = {
  attributeType: "",
  customTypeContains: "",
  valueContains: "",
  placeContains: "",
  linkType: "",
  linkedGiven: "",
  linkedLast: "",
};

export function hasAdminAttributesFilterQueryKeys(sp: URLSearchParams): boolean {
  return ADMIN_ATTRIBUTES_FILTER_QUERY_KEYS.some((k) => sp.has(k));
}

export function parseAdminAttributesFiltersFromSearchParams(
  sp: URLSearchParams,
): Partial<AdminAttributesUrlFilterState> {
  const out: Partial<AdminAttributesUrlFilterState> = {};
  const get = (k: string) => { const v = sp.get(k); return v !== null ? v : undefined; };
  const at = get("attributeType");
  if (at !== undefined) out.attributeType = at;
  const ctc = get("customTypeContains");
  if (ctc !== undefined) out.customTypeContains = ctc;
  const vc = get("valueContains");
  if (vc !== undefined) out.valueContains = vc;
  const pc = get("placeContains");
  if (pc !== undefined) out.placeContains = pc;
  const lt = get("linkType");
  if (lt === "individual" || lt === "family") out.linkType = lt;
  const lg = get("linkedGiven");
  if (lg !== undefined) out.linkedGiven = lg;
  const ll = get("linkedLast");
  if (ll !== undefined) out.linkedLast = ll;
  return out;
}

export function mergeAdminAttributesFilterDefaults(
  partial: Partial<AdminAttributesUrlFilterState>,
): AdminAttributesUrlFilterState {
  return { ...ADMIN_ATTRIBUTES_FILTER_DEFAULTS, ...partial };
}

export function adminAttributesFiltersToSearchParams(
  f: AdminAttributesUrlFilterState,
): URLSearchParams {
  const p = new URLSearchParams();
  const t = (s: string) => s.trim();
  if (t(f.attributeType)) p.set("attributeType", t(f.attributeType));
  if (t(f.customTypeContains)) p.set("customTypeContains", t(f.customTypeContains));
  if (t(f.valueContains)) p.set("valueContains", t(f.valueContains));
  if (t(f.placeContains)) p.set("placeContains", t(f.placeContains));
  if (f.linkType === "individual" || f.linkType === "family") p.set("linkType", f.linkType);
  if (t(f.linkedGiven)) p.set("linkedGiven", t(f.linkedGiven));
  if (t(f.linkedLast)) p.set("linkedLast", t(f.linkedLast));
  return p;
}

export function adminAttributesPathWithFilters(f: AdminAttributesUrlFilterState): string {
  const p = adminAttributesFiltersToSearchParams(f);
  const q = p.toString();
  return q ? `/admin/attributes?${q}` : "/admin/attributes";
}
