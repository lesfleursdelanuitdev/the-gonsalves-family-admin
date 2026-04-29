"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson, deleteJson } from "@/lib/infra/api";

export interface AdminCrudHooksConfig<TOpts> {
  /** API path, e.g. "/api/admin/notes" */
  base: string;
  /** React Query key prefix, e.g. ["admin", "notes"] */
  queryKey: readonly string[];
  /** Build URLSearchParams from list opts */
  buildParams: (opts: TOpts) => URLSearchParams;
  /** Additional query key prefixes to invalidate after a successful delete (e.g. album lists when deleting media). */
  extraInvalidateOnDelete?: readonly (readonly string[])[];
}

/** Optional React Query overrides for {@link createAdminCrudHooks} `useList`. */
export type AdminCrudListQueryOptions<TListResponse> = Pick<
  UseQueryOptions<TListResponse, Error, TListResponse, readonly string[]>,
  "enabled" | "placeholderData"
>;

export function createAdminCrudHooks<TOpts, TListResponse>(
  config: AdminCrudHooksConfig<TOpts>,
) {
  const { base, queryKey, buildParams, extraInvalidateOnDelete } = config;

  function useList(opts?: TOpts, queryOpts?: AdminCrudListQueryOptions<TListResponse>) {
    const params = opts ? buildParams(opts) : new URLSearchParams();
    const qs = params.toString();
    return useQuery({
      queryKey: [...queryKey, qs],
      queryFn: () => fetchJson<TListResponse>(`${base}${qs ? `?${qs}` : ""}`),
      enabled: queryOpts?.enabled,
      placeholderData: queryOpts?.placeholderData,
    });
  }

  function useDetail<T = unknown>(id: string, detailSegment = "detail") {
    return useQuery({
      queryKey: [...queryKey, detailSegment, id],
      queryFn: () => fetchJson<T>(`${base}/${id}`),
      enabled: !!id,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: Record<string, unknown>) => postJson(`${base}`, body),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
        patchJson(`${base}/${id}`, body),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => deleteJson(`${base}/${id}`),
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey });
        if (extraInvalidateOnDelete?.length) {
          for (const k of extraInvalidateOnDelete) {
            await qc.invalidateQueries({ queryKey: [...k] });
          }
        }
      },
    });
  }

  return {
    BASE: base,
    QUERY_KEY: queryKey,
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
  };
}
