"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, deleteJson, fetchJson, patchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/roles";
const KEY = ["admin", "roles"] as const;
const ROLE_QUERY_RETRY_LIMIT = 2;

function shouldRetryRoleQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < ROLE_QUERY_RETRY_LIMIT;
}

export interface AdminRoleListItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissionCount: number;
  assignmentCount: number;
}

export interface AdminRolesListResponse {
  roles: AdminRoleListItem[];
  total: number;
  hasMore: boolean;
}

export interface AdminRolePermission {
  id: string;
  roleId: string;
  entity: string;
  action: string;
  scope: string;
  createdAt: string;
}

export interface AdminRoleDetailResponse {
  role: AdminRoleListItem & {
    permissions: AdminRolePermission[];
    assignments: Array<{
      id: string;
      userId: string;
      roleId: string;
      treeId: string | null;
      createdAt: string;
      user: { id: string; username: string; email: string; name: string | null; isActive: boolean };
      tree: { id: string; name: string } | null;
    }>;
  };
}

export function useAdminRoles(opts?: { q?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: [...KEY, qs],
    queryFn: () => fetchJson<AdminRolesListResponse>(`${BASE}${qs ? `?${qs}` : ""}`),
    retry: shouldRetryRoleQuery,
  });
}

export function useAdminRole(roleId: string | null) {
  return useQuery({
    queryKey: [...KEY, "detail", roleId ?? ""],
    queryFn: () => fetchJson<AdminRoleDetailResponse>(`${BASE}/${roleId}`),
    enabled: !!roleId,
    retry: shouldRetryRoleQuery,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key?: string; name: string; description?: string; scope: string }) =>
      postJson<{ role: AdminRoleListItem }>(BASE, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; key?: string; description?: string; scope?: string }) =>
      patchJson<{ role: AdminRoleListItem }>(`${BASE}/${id}`, body),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: [...KEY, "detail", vars.id] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteJson(`${BASE}/${roleId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCreateRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { roleId: string; entity: string; action: string; scope: string }) =>
      postJson<{ permission: AdminRolePermission }>(`${BASE}/${body.roleId}/permissions`, body),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: [...KEY, "detail", vars.roleId] });
    },
  });
}

export function useDeleteRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionId }: { roleId: string; permissionId: string }) =>
      deleteJson(`${BASE}/${roleId}/permissions/${permissionId}`),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: [...KEY, "detail", vars.roleId] });
    },
  });
}

export function useAssignUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId, treeId }: { userId: string; roleId: string; treeId?: string | null }) =>
      postJson<{ userRole: unknown }>(`/api/admin/users/${userId}/roles`, { roleId, treeId: treeId ?? null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, userRoleId }: { userId: string; userRoleId: string }) =>
      deleteJson(`/api/admin/users/${userId}/roles/${userRoleId}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

