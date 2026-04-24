"use client";

import { ADMIN_FAMILIES_API_BASE, ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminFamilyListItem {
  id: string;
  xref: string;
  marriageYear: string | null;
  marriageDateDisplay: string | null;
  childrenCount: number | null;
  husband: { id: string; fullName: string | null } | null;
  wife: { id: string; fullName: string | null } | null;
}

export interface AdminFamiliesListResponse {
  families: AdminFamilyListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminFamiliesOpts {
  q?: string;
  limit?: number;
  offset?: number;
  partnerCount?: "one" | "two";
  p1Given?: string;
  p1Last?: string;
  p2Given?: string;
  p2Last?: string;
  childrenOp?: "gt" | "lt" | "eq";
  childrenCount?: string;
  hasMarriageDate?: "true" | "false";
}

export function buildFamiliesParams(opts: UseAdminFamiliesOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.partnerCount) params.set("partnerCount", opts.partnerCount);
  if (opts.p1Given) params.set("p1Given", opts.p1Given);
  if (opts.p1Last) params.set("p1Last", opts.p1Last);
  if (opts.p2Given) params.set("p2Given", opts.p2Given);
  if (opts.p2Last) params.set("p2Last", opts.p2Last);
  if (opts.childrenOp) params.set("childrenOp", opts.childrenOp);
  if (opts.childrenCount) params.set("childrenCount", opts.childrenCount);
  if (opts.hasMarriageDate === "true" || opts.hasMarriageDate === "false") {
    params.set("hasMarriageDate", opts.hasMarriageDate);
  }
  return params;
}

const familiesHooks = createAdminCrudHooks<UseAdminFamiliesOpts, AdminFamiliesListResponse>({
  base: ADMIN_FAMILIES_API_BASE,
  queryKey: ADMIN_FAMILIES_QUERY_KEY,
  buildParams: buildFamiliesParams,
});

export { ADMIN_FAMILIES_QUERY_KEY };
export const useAdminFamilies = familiesHooks.useList;
export const useAdminFamily = (id: string) => familiesHooks.useDetail<{ family: unknown }>(id, "detail");
export const useCreateFamily = familiesHooks.useCreate;
export const useUpdateFamily = familiesHooks.useUpdate;
export const useDeleteFamily = familiesHooks.useDelete;
