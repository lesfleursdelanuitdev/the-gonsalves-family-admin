"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { patchJson, deleteJson } from "@/lib/infra/api";
import type { ContributionType, ContributionAttachmentKind, PublicIntakeStatus } from "@ligneous/prisma";

export interface AdminContributionListItem {
  id: string;
  contributorFirstName: string;
  contributorLastName: string;
  contributorEmail: string;
  type: ContributionType;
  status: PublicIntakeStatus;
  createdAt: string;
  reviewedAt: string | null;
  _count: { attachments: number; individuals: number };
}

export interface AdminContributionAttachment {
  id: string;
  kind: ContributionAttachmentKind;
  fileName: string | null;
  mimeType: string | null;
  byteSize: string | null; // BigInt serialised as string
  caption: string | null;
  createdAt: string;
}

export interface AdminContributionIndividual {
  id: string;
  individualXref: string;
  individualNameSnapshot: string | null;
  birthDateSnapshot: string | null;
  sortOrder: number;
  individual: { id: string };
}

export interface AdminContributionDetail {
  id: string;
  contributorFirstName: string;
  contributorLastName: string;
  contributorEmail: string;
  type: ContributionType;
  content: string;
  status: PublicIntakeStatus;
  relatedIndividualXref: string | null;
  relatedFamilyXref: string | null;
  relatedPlace: string | null;
  relatedDate: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string | null; username: string } | null;
  individuals: AdminContributionIndividual[];
  attachments: AdminContributionAttachment[];
}

export interface AdminContributionsListResponse {
  contributions: AdminContributionListItem[];
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
  AdminContributionsListResponse
>({
  base: "/api/admin/contributions",
  queryKey: ["admin", "contributions"],
  buildParams,
});

export const useAdminContributions = hooks.useList;
export const useDeleteContribution = hooks.useDelete;

export function useAdminContribution(id: string) {
  return useQuery<{ contribution: AdminContributionDetail }>({
    queryKey: ["admin", "contributions", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contributions/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ contribution: AdminContributionDetail }>;
    },
    enabled: Boolean(id),
  });
}

export function useSetContributionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicIntakeStatus }) =>
      patchJson<{ contribution: AdminContributionDetail }>(
        `/api/admin/contributions/${id}`,
        { action: "set_status", status },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "contributions", data.contribution.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "contributions"] });
    },
  });
}

export function useSaveContributionNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      patchJson<{ contribution: AdminContributionDetail }>(
        `/api/admin/contributions/${id}`,
        { action: "set_notes", notes },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "contributions", data.contribution.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "contributions"] });
    },
  });
}

export function useBulkDeleteContribution() {
  return async (id: string) => deleteJson(`/api/admin/contributions/${id}`);
}
