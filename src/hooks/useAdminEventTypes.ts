"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, fetchJson, patchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/event-types";
const KEY = ["admin", "event-types"] as const;

export interface AdminEventType {
  id: string;
  tag: string;
  label: string;
  ownerScope: "INDI" | "FAM" | "BOTH";
  isCustom: boolean;
  sortOrder: number;
  fileUuid: string | null;
  color: string;
}

export interface AdminEventTypesResponse {
  eventTypes: AdminEventType[];
}

export function useAdminEventTypes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminEventTypesResponse>(BASE),
  });
}

export function useCreateEventType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      tag: string;
      label: string;
      ownerScope?: "INDI" | "FAM" | "BOTH";
      color?: string;
      sortOrder?: number;
    }) => postJson<{ eventType: AdminEventType }>(BASE, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateEventType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      label?: string;
      ownerScope?: "INDI" | "FAM" | "BOTH";
      color?: string;
      sortOrder?: number;
    }) => patchJson<{ eventType: AdminEventType }>(`${BASE}/${id}`, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteEventType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
