"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminIndividualListItem {
  id: string;
  xref: string;
  fullName: string | null;
  sex: string | null;
  birthYear: string | null;
  deathYear: string | null;
  individualNameForms?: Array<{
    isPrimary: boolean | null;
    sortOrder: number | null;
    givenNames: Array<{ givenName: { givenName: string } }>;
    surnames: Array<{ surname: { surname: string } }>;
  }>;
}

export interface AdminIndividualsListResponse {
  individuals: AdminIndividualListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminIndividualsOpts {
  q?: string;
  limit?: number;
  offset?: number;
  sex?: string;
  /** Send only `"true"` or `"false"` to filter living status. */
  living?: "true" | "false";
  givenName?: string;
  lastName?: string;
  birthYearMin?: string;
  birthYearMax?: string;
  deathYearMin?: string;
  deathYearMax?: string;
}

export interface IndividualUserLinkRow {
  linkId: string;
  verified: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
}

export function buildIndividualsParams(opts: UseAdminIndividualsOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.sex) params.set("sex", opts.sex);
  if (opts.living === "true" || opts.living === "false") params.set("living", opts.living);
  if (opts.givenName) params.set("givenName", opts.givenName);
  if (opts.lastName) params.set("lastName", opts.lastName);
  if (opts.birthYearMin) params.set("birthYearMin", opts.birthYearMin);
  if (opts.birthYearMax) params.set("birthYearMax", opts.birthYearMax);
  if (opts.deathYearMin) params.set("deathYearMin", opts.deathYearMin);
  if (opts.deathYearMax) params.set("deathYearMax", opts.deathYearMax);
  return params;
}

const individualsHooks = createAdminCrudHooks<UseAdminIndividualsOpts, AdminIndividualsListResponse>({
  base: "/api/admin/individuals",
  queryKey: ["admin", "individuals"],
  buildParams: buildIndividualsParams,
});

export const ADMIN_INDIVIDUALS_QUERY_KEY = individualsHooks.QUERY_KEY;
export const useAdminIndividuals = individualsHooks.useList;
export const useAdminIndividual = (id: string) => individualsHooks.useDetail<{ individual: unknown }>(id, "detail");
export const useCreateIndividual = individualsHooks.useCreate;
export const useUpdateIndividual = individualsHooks.useUpdate;
export const useDeleteIndividual = individualsHooks.useDelete;

export function useAdminIndividualEvents(id: string) {
  return useQuery({
    queryKey: [...individualsHooks.QUERY_KEY, "events", id],
    queryFn: () => fetchJson<{ events: IndividualDetailEvent[] }>(`${individualsHooks.BASE}/${id}/events`),
    enabled: !!id,
  });
}

export function useAdminIndividualUserLinks(id: string) {
  return useQuery({
    queryKey: [...individualsHooks.QUERY_KEY, "user-links", id],
    queryFn: () => fetchJson<{ links: IndividualUserLinkRow[] }>(`${individualsHooks.BASE}/${id}/user-links`),
    enabled: !!id,
  });
}
