"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/lib/infra/api";
import type { SiteHealthRunPayload, CheckRecordsPayload, BatchPayload } from "@/lib/health/types";

const LATEST_KEY = ["admin", "site-health", "latest"] as const;
const checkRecordsKey = (key: string) => ["admin", "site-health", "records", key] as const;

export function useLatestHealthRun() {
  return useQuery({
    queryKey: LATEST_KEY,
    queryFn: () => fetchJson<SiteHealthRunPayload | null>("/api/admin/site-health/latest"),
    staleTime: 60_000,
  });
}

export function useRunHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<SiteHealthRunPayload>("/api/admin/site-health/run", {}),
    onSuccess: (data) => {
      qc.setQueryData(LATEST_KEY, data);
    },
  });
}

export function useCheckRecords(checkKey: string, enabled: boolean) {
  return useQuery({
    queryKey: checkRecordsKey(checkKey),
    queryFn: () => fetchJson<CheckRecordsPayload>(`/api/admin/site-health/checks/${checkKey}/records`),
    enabled,
    staleTime: 30_000,
  });
}

export function useBatchAction(checkKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      postJson<BatchPayload>(`/api/admin/site-health/checks/${checkKey}/batch`, ids ? { ids } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LATEST_KEY });
      void qc.invalidateQueries({ queryKey: checkRecordsKey(checkKey) });
    },
  });
}

export type IndividualRefsPayload = {
  events: number;
  notes: number;
  sources: number;
  media: number;
  stories: number;
  openQuestions: number;
  total: number;
};

export function useIndividualReferences(id: string | null) {
  return useQuery({
    queryKey: ["admin", "individuals", id, "references"] as const,
    queryFn: () => fetchJson<IndividualRefsPayload>(`/api/admin/individuals/${id}/references`),
    enabled: id != null,
    staleTime: 60_000,
  });
}

export function useSuppress(checkKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, reason }: { recordId: string; reason?: string }) =>
      postJson("/api/admin/site-health/suppress", { checkKey, recordId, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LATEST_KEY });
      void qc.invalidateQueries({ queryKey: checkRecordsKey(checkKey) });
    },
  });
}
