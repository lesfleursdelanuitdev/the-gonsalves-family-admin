"use client";

import { useQuery } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { fetchJson } from "@/lib/infra/api";

export interface AdminAlbumListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverMediaId: string | null;
  /** From linked `gedcom_media_v2` when `coverMediaId` is set (admin tree). */
  coverFileRef: string | null;
  coverForm: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface AdminAlbumsListResponse {
  albums: AdminAlbumListItem[];
  total: number;
  hasMore: boolean;
}

export type AdminAlbumDetail = AdminAlbumListItem & {
  createdAt: string;
};

export interface AdminAlbumDetailResponse {
  album: AdminAlbumDetail;
}

export function useAdminAlbum(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "albums", "detail", id],
    queryFn: () => fetchJson<AdminAlbumDetailResponse>(`/api/admin/albums/${id}`),
    enabled: Boolean(id),
  });
}

function buildAlbumsParams(opts: { q?: string; limit?: number; offset?: number }): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return params;
}

const albumsHooks = createAdminCrudHooks<{ q?: string; limit?: number; offset?: number }, AdminAlbumsListResponse>({
  base: "/api/admin/albums",
  queryKey: ["admin", "albums"],
  buildParams: buildAlbumsParams,
});

export const useAdminAlbums = albumsHooks.useList;
export const useCreateAlbum = albumsHooks.useCreate;
