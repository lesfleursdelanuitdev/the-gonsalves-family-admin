"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, fetchJson, patchJson, postJson } from "@/lib/infra/api";

const BASE = "/api/admin/relationship-types";
const KEY = ["admin", "relationship-types"] as const;

export interface AdminRelationshipTypeRole {
  id: string;
  key: string;
  label: string;
  reciprocalRoleKey: string | null;
}

export interface AdminRelationshipType {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isSymmetric: boolean;
  gedcomRelaAtoB: string | null;
  gedcomRelaBtoA: string | null;
  treeId: string | null;
  roles: AdminRelationshipTypeRole[];
}

export interface AdminRelationshipTypesResponse {
  relationshipTypes: AdminRelationshipType[];
  schemaReady?: boolean;
  setupMessage?: string;
}

export function useAdminRelationshipTypes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminRelationshipTypesResponse>(BASE),
  });
}

export function useCreateRelationshipType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      key: string;
      label: string;
      description?: string | null;
      isSymmetric?: boolean;
      gedcomRelaAtoB?: string | null;
      gedcomRelaBtoA?: string | null;
      roles: Array<{ key: string; label: string; reciprocalRoleKey?: string | null }>;
    }) => postJson<{ relationshipType: AdminRelationshipType }>(BASE, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateRelationshipType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      label?: string;
      description?: string | null;
      isSymmetric?: boolean;
      gedcomRelaAtoB?: string | null;
      gedcomRelaBtoA?: string | null;
    }) => patchJson<{ relationshipType: AdminRelationshipType }>(`${BASE}/${id}`, body),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: KEY });
      await qc.invalidateQueries({ queryKey: [...KEY, "detail", vars.id] });
    },
  });
}

export function useDeleteRelationshipType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

