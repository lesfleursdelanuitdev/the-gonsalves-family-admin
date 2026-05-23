"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson } from "@/lib/infra/api";
import type {
  InternalDuplicatePair,
  InternalDuplicateResolution,
  InternalDuplicateScanSummary,
} from "@/lib/admin/gedcom-internal-scan";

export type { InternalDuplicatePair, InternalDuplicateResolution, InternalDuplicateScanSummary };

const BASE = "/api/admin/merge-records/scans";
export const SCANS_QUERY_KEY = ["admin", "internal-duplicate-scans"] as const;

export type ScanListItem = {
  id: string;
  status: string;
  scanType: string;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  appliedAt: string | null;
  summary: InternalDuplicateScanSummary;
  pairsCount: number;
};

export type ScanDetail = ScanListItem & {
  pairs: InternalDuplicatePair[];
  resolutions: Record<string, InternalDuplicateResolution>;
};

export type ScanRunResult = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  summary: InternalDuplicateScanSummary;
  pairsCount: number;
};

export type ScanApplyResult = {
  ok: boolean;
  merged: number;
  skipped: number;
  errors: { pairId: string; error: string }[];
};

export function useInternalScans() {
  return useQuery({
    queryKey: [...SCANS_QUERY_KEY, "list"],
    queryFn: () => fetchJson<{ scans: ScanListItem[] }>(BASE),
  });
}

export function useInternalScan(id: string | null) {
  return useQuery({
    queryKey: [...SCANS_QUERY_KEY, "detail", id ?? ""],
    queryFn: () => fetchJson<ScanDetail>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useRunInternalScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<ScanRunResult>(`${BASE}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: SCANS_QUERY_KEY }),
  });
}

export function usePatchScanResolutions(scanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resolutions: Record<string, InternalDuplicateResolution>) =>
      patchJson<{ ok: boolean; resolutions: Record<string, InternalDuplicateResolution> }>(
        `${BASE}/${scanId}/resolutions`,
        { resolutions },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...SCANS_QUERY_KEY, "detail", scanId] });
    },
  });
}

export function useApplyScan(scanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<ScanApplyResult>(`${BASE}/${scanId}/apply`),
    onSuccess: () => qc.invalidateQueries({ queryKey: SCANS_QUERY_KEY }),
  });
}

export function useDiscardScan(scanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ ok: boolean }>(`${BASE}/${scanId}/discard`),
    onSuccess: () => qc.invalidateQueries({ queryKey: SCANS_QUERY_KEY }),
  });
}
