"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { fetchJson } from "@/lib/infra/api";

export interface AdminMediaListItem {
  id: string;
  mediaScope?: "family-tree" | "site-assets" | "my-media";
  createdAt?: string;
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
  /**
   * Aggregated counts surfaced by the list endpoint. The full `placeLinks` / `dateLinks` arrays
   * are only available on the detail endpoint; lists return counts to keep payloads small.
   */
  linkedCount?: number;
  placeCount?: number;
  dateCount?: number;
  tagCount?: number;
  albumCount?: number;
}

export interface AdminMediaListResponse {
  media: AdminMediaListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminMediaOpts {
  scope?: "all" | "family-tree" | "site-assets" | "my-media";
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
  /** Limit to media linked to this individual (GEDCOM junction). */
  linkedIndividualId?: string;
  linkedFamilyId?: string;
  linkedEventId?: string;
  /** GEDCOM event tag (e.g. BIRT); only affects family-tree `/api/admin/media` results. */
  linkedEventType?: string;
}

export type AdminMediaScope = "family-tree" | "site-assets" | "my-media";

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
  if (opts.linkedIndividualId) params.set("linkedIndividualId", opts.linkedIndividualId);
  if (opts.linkedFamilyId) params.set("linkedFamilyId", opts.linkedFamilyId);
  if (opts.linkedEventId) params.set("linkedEventId", opts.linkedEventId);
  if (opts.linkedEventType?.trim()) params.set("linkedEventType", opts.linkedEventType.trim().toUpperCase());
  return params;
}

const mediaHooks = createAdminCrudHooks<UseAdminMediaOpts, AdminMediaListResponse>({
  base: "/api/admin/media",
  queryKey: ["admin", "media"],
  buildParams: buildMediaParams,
  extraInvalidateOnDelete: [["admin", "albums"]],
});

export const ADMIN_MEDIA_QUERY_KEY = mediaHooks.QUERY_KEY;

export function useAdminMedia(opts?: UseAdminMediaOpts, enabled = true) {
  const params = opts ? buildMediaParams(opts) : new URLSearchParams();
  const qs = params.toString();
  const scope = opts?.scope ?? "all";
  const endpoint =
    scope === "site-assets"
      ? "/api/admin/site-media"
      : scope === "my-media"
        ? "/api/admin/user-media"
        : "/api/admin/media";
  return useQuery({
    queryKey: [...ADMIN_MEDIA_QUERY_KEY, scope, qs],
    queryFn: async () => {
      if (scope !== "all") {
        return fetchJson<AdminMediaListResponse>(`${endpoint}${qs ? `?${qs}` : ""}`);
      }

      const pageSize = opts?.limit ?? 24;
      const pageOffset = opts?.offset ?? 0;
      const fullParams = opts ? buildMediaParams(opts) : new URLSearchParams();
      // For combined "all", fetch each scope fully, then paginate after merge/sort.
      fullParams.set("limit", "10000");
      fullParams.set("offset", "0");
      const fullQs = fullParams.toString();
      const suffix = fullQs ? `?${fullQs}` : "";
      const [familyTree, siteAssets, myMedia] = await Promise.all([
        fetchJson<AdminMediaListResponse>(`/api/admin/media${suffix}`),
        fetchJson<AdminMediaListResponse>(`/api/admin/site-media${suffix}`),
        fetchJson<AdminMediaListResponse>(`/api/admin/user-media${suffix}`),
      ]);
      const merged = [...familyTree.media, ...siteAssets.media, ...myMedia.media].sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
      const page = merged.slice(pageOffset, pageOffset + pageSize);
      return {
        media: page,
        total: merged.length,
        hasMore: pageOffset + page.length < merged.length,
      };
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}
export function useAdminMediaItem(id: string, scope: AdminMediaScope = "family-tree") {
  const endpoint =
    scope === "site-assets"
      ? "/api/admin/site-media"
      : scope === "my-media"
        ? "/api/admin/user-media"
        : "/api/admin/media";
  return useQuery({
    queryKey: [...ADMIN_MEDIA_QUERY_KEY, "detail", scope, id],
    queryFn: () => fetchJson<{ media: unknown }>(`${endpoint}/${id}`),
    enabled: !!id,
  });
}
export const useCreateMedia = mediaHooks.useCreate;
export const useUpdateMedia = mediaHooks.useUpdate;
export const useDeleteMedia = mediaHooks.useDelete;
