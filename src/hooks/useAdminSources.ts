"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminSourceListItem {
  id: string;
  xref: string;
  title: string | null;
  author: string | null;
  individualSources: Array<{ individual: { fullName: string | null } }>;
  familySources: Array<{
    family: {
      husband: { fullName: string | null } | null;
      wife: { fullName: string | null } | null;
    };
  }>;
  eventSources: Array<{ event: { eventType: string } }>;
}

export interface AdminSourcesListResponse {
  sources: AdminSourceListItem[];
  total: number;
  hasMore: boolean;
}

function buildSourcesParams(opts: {
  q?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  return params;
}

const sourcesHooks = createAdminCrudHooks<
  { q?: string; limit?: number; offset?: number },
  AdminSourcesListResponse
>({
  base: "/api/admin/sources",
  queryKey: ["admin", "sources"],
  buildParams: buildSourcesParams,
});

export const useAdminSources = sourcesHooks.useList;
export const useAdminSource = (id: string) => sourcesHooks.useDetail<{ source: unknown }>(id);
export const useCreateSource = sourcesHooks.useCreate;
export const useUpdateSource = sourcesHooks.useUpdate;
export const useDeleteSource = sourcesHooks.useDelete;
