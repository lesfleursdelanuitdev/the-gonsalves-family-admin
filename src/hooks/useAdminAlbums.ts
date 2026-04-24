"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminAlbumListItem {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminAlbumsListResponse {
  albums: AdminAlbumListItem[];
  total: number;
  hasMore: boolean;
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
