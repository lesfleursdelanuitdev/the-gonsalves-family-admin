"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminRepositoryListItem {
  id: string;
  xref: string;
  name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  _count: { sourceRepositories: number };
}

export interface AdminRepositoriesListResponse {
  repositories: AdminRepositoryListItem[];
  total: number;
  hasMore: boolean;
}

function buildRepositoriesParams(opts: {
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

const repositoriesHooks = createAdminCrudHooks<
  { q?: string; limit?: number; offset?: number },
  AdminRepositoriesListResponse
>({
  base: "/api/admin/repositories",
  queryKey: ["admin", "repositories"],
  buildParams: buildRepositoriesParams,
});

export const useAdminRepositories = repositoriesHooks.useList;
export const useDeleteRepository = repositoriesHooks.useDelete;
