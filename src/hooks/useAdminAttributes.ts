"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminAttributeListItem {
  id: string;
  attributeType: string;
  customType?: string | null;
  value?: string | null;
  agency?: string | null;
  date: { original?: string | null; year?: number | null; month?: number | null; day?: number | null } | null;
  place: { original?: string | null; name?: string | null } | null;
  individualAttributes: Array<{
    individual: {
      id: string;
      fullName: string | null;
      individualNameForms?: Array<{
        givenNames: Array<{ givenName: { givenName: string } }>;
        surnames: Array<{ surname: { surname: string } }>;
      }>;
    };
  }>;
  familyAttributes: Array<{
    family: {
      id: string;
      xref: string;
      husband: { id: string; fullName: string | null } | null;
      wife: { id: string; fullName: string | null } | null;
    };
  }>;
}

export interface AdminAttributesListResponse {
  attributes: AdminAttributeListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminAttributesOpts {
  q?: string;
  attributeType?: string;
  customTypeContains?: string;
  valueContains?: string;
  placeContains?: string;
  linkType?: "individual" | "family";
  linkedGiven?: string;
  linkedLast?: string;
  limit?: number;
  offset?: number;
}

function buildAttributesParams(opts: UseAdminAttributesOpts): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.attributeType) p.set("attributeType", opts.attributeType);
  if (opts.customTypeContains?.trim()) p.set("customTypeContains", opts.customTypeContains.trim());
  if (opts.valueContains?.trim()) p.set("valueContains", opts.valueContains.trim());
  if (opts.placeContains?.trim()) p.set("placeContains", opts.placeContains.trim());
  if (opts.linkType === "individual" || opts.linkType === "family") p.set("linkType", opts.linkType);
  if (opts.linkedGiven?.trim()) p.set("linkedGiven", opts.linkedGiven.trim());
  if (opts.linkedLast?.trim()) p.set("linkedLast", opts.linkedLast.trim());
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  return p;
}

const hooks = createAdminCrudHooks<UseAdminAttributesOpts, AdminAttributesListResponse>({
  base: "/api/admin/attributes",
  queryKey: ["admin", "attributes"],
  buildParams: buildAttributesParams,
});

export const ADMIN_ATTRIBUTES_QUERY_KEY = hooks.QUERY_KEY;
export const useAdminAttributes = hooks.useList;
export const useAdminAttribute = (id: string) =>
  hooks.useDetail<{ attribute: AdminAttributeListItem }>(id);
export const useCreateAttribute = hooks.useCreate;
export const useUpdateAttribute = hooks.useUpdate;
export const useDeleteAttribute = hooks.useDelete;
