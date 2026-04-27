"use client";

import { useQuery } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { fetchJson } from "@/lib/infra/api";

export interface AdminMediaListItem {
  id: string;
  title: string | null;
  description: string | null;
  fileRef: string | null;
  form: string | null;
  individualMedia: Array<{ individual: { fullName: string | null } }>;
  familyMedia: Array<{
    family: {
      husband: { fullName: string | null } | null;
      wife: { fullName: string | null } | null;
    };
  }>;
  sourceMedia: Array<{ source: { title: string | null; xref: string } }>;
  /** Present when API includes event–media junction rows. */
  eventMedia?: Array<{
    event: { id: string; eventType: string; customType: string | null };
  }>;
  appTags?: Array<{ id: string; tag: { id: string; name: string; color: string | null } }>;
  albumLinks?: Array<{ id: string; album: { id: string; name: string } }>;
}

export interface AdminMediaListResponse {
  media: AdminMediaListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminMediaOpts {
  q?: string;
  limit?: number;
  offset?: number;
  mediaCategory?: "photo" | "document" | "video" | "audio";
  titleContains?: string;
  fileRefContains?: string;
  fileTypeContains?: string;
  linkedGiven?: string;
  linkedLast?: string;
  albumId?: string;
  tagId?: string;
}

function buildMediaParams(opts: UseAdminMediaOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (
    opts.mediaCategory === "photo" ||
    opts.mediaCategory === "document" ||
    opts.mediaCategory === "video" ||
    opts.mediaCategory === "audio"
  ) {
    params.set("mediaCategory", opts.mediaCategory);
  }
  if (opts.titleContains) params.set("titleContains", opts.titleContains);
  if (opts.fileRefContains) params.set("fileRefContains", opts.fileRefContains);
  if (opts.fileTypeContains) params.set("fileTypeContains", opts.fileTypeContains);
  if (opts.linkedGiven) params.set("linkedGiven", opts.linkedGiven);
  if (opts.linkedLast) params.set("linkedLast", opts.linkedLast);
  if (opts.albumId) params.set("albumId", opts.albumId);
  if (opts.tagId) params.set("tagId", opts.tagId);
  return params;
}

const mediaHooks = createAdminCrudHooks<UseAdminMediaOpts, AdminMediaListResponse>({
  base: "/api/admin/media",
  queryKey: ["admin", "media"],
  buildParams: buildMediaParams,
});

export const ADMIN_MEDIA_QUERY_KEY = mediaHooks.QUERY_KEY;

export function useAdminMedia(opts?: UseAdminMediaOpts, enabled = true) {
  const params = opts ? buildMediaParams(opts) : new URLSearchParams();
  const qs = params.toString();
  return useQuery({
    queryKey: [...ADMIN_MEDIA_QUERY_KEY, qs],
    queryFn: () => fetchJson<AdminMediaListResponse>(`/api/admin/media${qs ? `?${qs}` : ""}`),
    enabled,
  });
}
export const useAdminMediaItem = (id: string) => mediaHooks.useDetail<{ media: unknown }>(id);
export const useCreateMedia = mediaHooks.useCreate;
export const useUpdateMedia = mediaHooks.useUpdate;
export const useDeleteMedia = mediaHooks.useDelete;
