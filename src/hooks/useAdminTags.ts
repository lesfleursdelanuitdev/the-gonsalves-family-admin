"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminTagListItem {
  id: string;
  name: string;
  color: string | null;
  isGlobal: boolean;
  userId: string | null;
}

export interface AdminTagsListResponse {
  tags: AdminTagListItem[];
  total: number;
  hasMore: boolean;
}

function buildTagsParams(opts: { q?: string; limit?: number; offset?: number }): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return params;
}

const tagsHooks = createAdminCrudHooks<{ q?: string; limit?: number; offset?: number }, AdminTagsListResponse>({
  base: "/api/admin/tags",
  queryKey: ["admin", "tags"],
  buildParams: buildTagsParams,
});

export const useAdminTags = tagsHooks.useList;
export const useCreateTag = tagsHooks.useCreate;
