"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, fetchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/backups";
const KEY = ["admin", "backups"] as const;

export type BackupStatus = "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
export type BackupTrigger = "MANUAL" | "SCHEDULED";

export interface AdminBackup {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: BackupStatus;
  trigger: BackupTrigger;
  filePath: string | null;
  fileSize: string | null;
  schemaVersion: string;
  manifest: Record<string, unknown> | null;
  errorMessage: string | null;
}

export interface AdminBackupsResponse {
  backups: AdminBackup[];
}

export function useAdminBackups() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminBackupsResponse>(BASE),
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ backup: AdminBackup }>(BASE, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
