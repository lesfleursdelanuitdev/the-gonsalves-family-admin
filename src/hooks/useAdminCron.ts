"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson } from "@/lib/infra/api";
import type {
  CronJobStatus,
  CronLastRun,
  SiteHealthSummary,
  BackupSummary,
} from "@/lib/admin/cron-jobs";

const BASE = "/api/admin/cron";
const KEY = ["admin", "cron"] as const;

export type { CronJobStatus, CronLastRun, SiteHealthSummary, BackupSummary };

export function useAdminCron() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<{ jobs: CronJobStatus[] }>(BASE),
  });
}

export function useTriggerCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      postJson<{ ok: boolean; lastRun: CronLastRun }>(`${BASE}/${jobId}/trigger`, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
