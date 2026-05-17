"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminGlossaryListItem {
  id: string;
  word: string;
  slug: string;
  dialect: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  meaning: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface AdminGlossaryListResponse {
  entries: AdminGlossaryListItem[];
  total: number;
  hasMore: boolean;
}

export interface AdminGlossaryDetail {
  id: string;
  treeId: string;
  authorId: string | null;
  word: string;
  slug: string;
  dialect: string | null;
  pronunciation: string | null;
  partOfSpeech: string | null;
  meaning: string;
  usageExample: string | null;
  usageTranslation: string | null;
  notes: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AdminGlossaryDetailResponse {
  entry: AdminGlossaryDetail;
}

function buildGlossaryParams(opts: {
  q?: string;
  status?: string;
  dialect?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.dialect) params.set("dialect", opts.dialect);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return params;
}

const glossaryHooks = createAdminCrudHooks<
  { q?: string; status?: string; dialect?: string; limit?: number; offset?: number },
  AdminGlossaryListResponse
>({
  base: "/api/admin/glossary",
  queryKey: ["admin", "glossary"],
  buildParams: buildGlossaryParams,
});

export const useAdminGlossary = glossaryHooks.useList;
export const useCreateGlossaryEntry = glossaryHooks.useCreate;
export const useUpdateGlossaryEntry = glossaryHooks.useUpdate;
export const useDeleteGlossaryEntry = glossaryHooks.useDelete;

export function useGlossaryEntryDetail(id: string) {
  return glossaryHooks.useDetail<AdminGlossaryDetailResponse>(id);
}
