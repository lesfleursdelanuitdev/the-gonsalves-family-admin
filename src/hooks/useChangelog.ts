"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/lib/infra/api";

export interface ChangelogBatch {
  batchId: string;
  summary: string | null;
  createdAt: string;
  userId: string;
  username: string;
  userName: string | null;
  entryCount: number;
  entityTypes: string[];
  operations: string[];
}

export interface ChangelogListResponse {
  batches: ChangelogBatch[];
  total: number;
  hasMore: boolean;
}

export interface ChangelogEntry {
  id: string;
  entityType: string;
  entityId: string;
  entityXref: string | null;
  operation: string;
  changeset: unknown;
  createdAt: string;
}

export interface ChangelogBatchDetail {
  batchId: string;
  summary: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; username: string; name: string | null };
  undoneAt: string | null;
  undoneBy: string | null;
  entries: ChangelogEntry[];
}

export interface UseChangelogListOpts {
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

const CHANGELOG_KEY = ["admin", "changelog"] as const;

function buildParams(opts: UseChangelogListOpts): string {
  const p = new URLSearchParams();
  if (opts.entityType) p.set("entityType", opts.entityType);
  if (opts.entityId) p.set("entityId", opts.entityId);
  if (opts.userId) p.set("userId", opts.userId);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function useChangelogList(opts: UseChangelogListOpts = {}) {
  const qs = buildParams(opts);
  return useQuery({
    queryKey: [...CHANGELOG_KEY, "list", qs],
    queryFn: () => fetchJson<ChangelogListResponse>(`/api/admin/changelog${qs}`),
  });
}

export function useChangelogBatch(batchId: string) {
  return useQuery({
    queryKey: [...CHANGELOG_KEY, "batch", batchId],
    queryFn: () => fetchJson<ChangelogBatchDetail>(`/api/admin/changelog/${batchId}`),
    enabled: !!batchId,
  });
}

export function useEntityHistory(entityType: string, entityId: string) {
  return useChangelogList({ entityType, entityId, limit: 50 });
}

export function useUndoBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) =>
      postJson<{ success: boolean; undoBatchId: string }>(
        `/api/admin/changelog/${batchId}/undo`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CHANGELOG_KEY] });
      qc.invalidateQueries({ queryKey: ["admin", "individuals"] });
      qc.invalidateQueries({ queryKey: ["admin", "families"] });
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "notes"] });
      qc.invalidateQueries({ queryKey: ["admin", "sources"] });
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
    },
  });
}
