"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { patchJson, deleteJson } from "@/lib/infra/api";
import type { AccessRequestStatus, AccessRequestType, ResourceType, PermissionType } from "@ligneous/prisma";

export interface AdminAccessRequestUser {
  id: string;
  name: string | null;
  username: string;
  email: string;
  createdAt: string;
}

export interface AdminAccessRequestListItem {
  id: string;
  requestType: AccessRequestType;
  status: AccessRequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  user: AdminAccessRequestUser;
}

export interface AdminAccessRequestDetail {
  id: string;
  requestType: AccessRequestType;
  resourceType: ResourceType | null;
  resourceId: string | null;
  requestedPermissionType: PermissionType | null;
  status: AccessRequestStatus;
  notes: string | null;
  responseNotes: string | null;
  requestedAt: string;
  respondedAt: string | null;
  respondedBy: string | null;
  user: AdminAccessRequestUser;
  responder: { id: string; name: string | null; username: string } | null;
}

export interface AdminAccessRequestsListResponse {
  requests: AdminAccessRequestListItem[];
  total: number;
  hasMore: boolean;
}

function buildParams(opts: {
  q?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.type) p.set("type", opts.type);
  if (opts.status) p.set("status", opts.status);
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.offset) p.set("offset", String(opts.offset));
  return p;
}

const hooks = createAdminCrudHooks<
  { q?: string; type?: string; status?: string; limit?: number; offset?: number },
  AdminAccessRequestsListResponse
>({
  base: "/api/admin/access-requests",
  queryKey: ["admin", "access-requests"],
  buildParams,
});

export const useAdminAccessRequests = hooks.useList;
export const useDeleteAccessRequest = hooks.useDelete;

export function useAdminAccessRequest(id: string) {
  return useQuery<{ request: AdminAccessRequestDetail }>({
    queryKey: ["admin", "access-requests", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/access-requests/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ request: AdminAccessRequestDetail }>;
    },
    enabled: Boolean(id),
  });
}

export function useSetAccessRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, responseNotes }: { id: string; status: AccessRequestStatus; responseNotes?: string }) =>
      patchJson<{ request: AdminAccessRequestDetail }>(
        `/api/admin/access-requests/${id}`,
        { action: "set_status", status, responseNotes },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "access-requests", data.request.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    },
  });
}

export function useSaveAccessRequestResponseNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      patchJson<{ request: AdminAccessRequestDetail }>(
        `/api/admin/access-requests/${id}`,
        { action: "set_response_notes", notes },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "access-requests", data.request.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    },
  });
}

export function useBulkDeleteAccessRequest() {
  return async (id: string) => deleteJson(`/api/admin/access-requests/${id}`);
}
