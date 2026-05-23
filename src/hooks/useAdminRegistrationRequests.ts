"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { patchJson, deleteJson } from "@/lib/infra/api";
import type { PublicIntakeStatus } from "@ligneous/prisma";

export interface AdminRegistrationRequestListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  preferredUsername: string;
  status: PublicIntakeStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AdminRegistrationRequestDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  preferredUsername: string;
  requestDetails: string;
  status: PublicIntakeStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string | null; username: string } | null;
}

export interface AdminRegistrationRequestsListResponse {
  requests: AdminRegistrationRequestListItem[];
  total: number;
  hasMore: boolean;
}

function buildParams(opts: {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.status) p.set("status", opts.status);
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.offset) p.set("offset", String(opts.offset));
  return p;
}

const hooks = createAdminCrudHooks<
  { q?: string; status?: string; limit?: number; offset?: number },
  AdminRegistrationRequestsListResponse
>({
  base: "/api/admin/registration-requests",
  queryKey: ["admin", "registration-requests"],
  buildParams,
});

export const useAdminRegistrationRequests = hooks.useList;
export const useDeleteRegistrationRequest = hooks.useDelete;

export function useAdminRegistrationRequest(id: string) {
  return useQuery<{ request: AdminRegistrationRequestDetail }>({
    queryKey: ["admin", "registration-requests", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/registration-requests/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ request: AdminRegistrationRequestDetail }>;
    },
    enabled: Boolean(id),
  });
}

export function useSetRegistrationRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicIntakeStatus }) =>
      patchJson<{ request: AdminRegistrationRequestDetail }>(
        `/api/admin/registration-requests/${id}`,
        { action: "set_status", status },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "registration-requests", data.request.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "registration-requests"] });
    },
  });
}

export function useSaveRegistrationRequestNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      patchJson<{ request: AdminRegistrationRequestDetail }>(
        `/api/admin/registration-requests/${id}`,
        { action: "set_notes", notes },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "registration-requests", data.request.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "registration-requests"] });
    },
  });
}

export function useBulkDeleteRegistrationRequest() {
  return async (id: string) => deleteJson(`/api/admin/registration-requests/${id}`);
}
