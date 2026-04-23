"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson, deleteJson } from "@/lib/infra/api";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";
const BASE = "/api/admin/users";
const KEY = ["admin", "users"] as const;

export interface AdminUserListEntry {
  user: {
    id: string;
    username: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
  role: string;
}

export interface AdminUsersListResponse {
  users: AdminUserListEntry[];
  total: number;
  hasMore: boolean;
}

export function useAdminUsers(opts?: { q?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: [...KEY, opts?.q ?? "", opts?.limit ?? 50, opts?.offset ?? 0],
    queryFn: () => fetchJson<AdminUsersListResponse>(`${BASE}${qs ? `?${qs}` : ""}`),
  });
}

export interface UserDetailLink {
  id: string;
  individualId: string | null;
  individualXref: string;
  individualName: string | null;
  individualNameForms?: Array<{
    givenNames: Array<{ givenName: { givenName: string } }>;
    surnames: Array<{ surname: { surname: string } }>;
  }> | null;
  verified: boolean;
}

export interface UserDetailResponse {
  user: {
    id: string;
    username: string;
    email: string;
    name: string | null;
    isWebsiteOwner: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
  role: "owner" | "maintainer" | "contributor" | "none";
  profile: unknown;
  links: UserDetailLink[];
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => fetchJson<UserDetailResponse>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useCreateUserLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      individualXref,
      verified,
    }: {
      userId: string;
      individualXref: string;
      verified?: boolean;
    }) => postJson(`${BASE}/${userId}/links`, { individualXref, verified }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, userId] });
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...ADMIN_INDIVIDUALS_QUERY_KEY, "user-links"] });
    },
  });
}

export function useDeleteUserLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, linkId }: { userId: string; linkId: string }) =>
      deleteJson(`${BASE}/${userId}/links/${linkId}`),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, userId] });
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...ADMIN_INDIVIDUALS_QUERY_KEY, "user-links"] });
    },
  });
}

export interface CreateUserResponse {
  user: { id: string; username: string; email: string; name: string | null; isWebsiteOwner: boolean; isActive: boolean; createdAt: string; updatedAt: string };
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; email: string; name?: string; password: string }) =>
      postJson<CreateUserResponse>(`${BASE}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; email?: string; isActive?: boolean }) =>
      patchJson(`${BASE}/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: "owner" | "maintainer" | "contributor" | "none" }) =>
      postJson(`${BASE}/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
