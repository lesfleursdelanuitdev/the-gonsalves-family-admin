"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, fetchJson, patchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/attribute-types";
const KEY = ["admin", "attribute-types"] as const;

export interface AdminAttributeType {
  id: string;
  tag: string;
  label: string;
  ownerScope: "INDI" | "FAM" | "BOTH";
  isCustom: boolean;
  sortOrder: number;
  fileUuid: string | null;
  color: string;
}

export interface AdminAttributeTypesResponse {
  attributeTypes: AdminAttributeType[];
}

export function useAdminAttributeTypes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminAttributeTypesResponse>(BASE),
  });
}

export function useCreateAttributeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      tag: string;
      label: string;
      ownerScope?: "INDI" | "FAM" | "BOTH";
      color?: string;
      sortOrder?: number;
    }) => postJson<{ attributeType: AdminAttributeType }>(BASE, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateAttributeType() {
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
    }) => patchJson<{ attributeType: AdminAttributeType }>(`${BASE}/${id}`, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteAttributeType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
