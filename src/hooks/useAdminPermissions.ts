"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, deleteJson, fetchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/permissions";
const KEY = ["admin", "permissions"] as const;
const RETRY_LIMIT = 2;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < RETRY_LIMIT;
}

export interface AdminPermissionItem {
  id: string;
  entity: string;
  action: string;
  scope: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  roleUsageCount: number;
}

export interface AdminPermissionsListResponse {
  permissions: AdminPermissionItem[];
  total: number;
  hasMore: boolean;
}

export function useAdminPermissions(opts?: { q?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: [...KEY, qs],
    queryFn: () => fetchJson<AdminPermissionsListResponse>(`${BASE}${qs ? `?${qs}` : ""}`),
    retry: shouldRetry,
  });
}

export function useCreatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { entity: string; action: string; scope: string; description?: string }) =>
      postJson<{ permission: AdminPermissionItem }>(BASE, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeletePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permissionId: string) => deleteJson(`${BASE}/${permissionId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
