"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson, deleteJson } from "@/lib/infra/api";

const BASE = "/api/admin/individual-relationships";
const KEY = ["admin", "relationships"] as const;

export interface AdminRelationshipParticipant {
  id: string;
  individualId: string;
  roleId: string;
  sortOrder: number;
  individual: {
    id: string;
    xref: string;
    fullName: string | null;
  };
  role: {
    id: string;
    key: string;
    label: string;
  };
}

export interface AdminRelationshipType {
  id: string;
  key: string;
  label: string;
  isSymmetric: boolean;
  gedcomRelaAtoB: string | null;
  gedcomRelaBtoA: string | null;
  roles: { id: string; key: string; label: string; reciprocalRoleKey: string | null }[];
}

export interface AdminRelationship {
  id: string;
  fileUuid: string;
  notes: string | null;
  updatedAt: string;
  relationshipType: AdminRelationshipType;
  participants: AdminRelationshipParticipant[];
}

export interface AdminRelationshipsResponse {
  relationships: AdminRelationship[];
}

export interface RelationshipMutationInput {
  relationshipTypeId: string;
  notes: string | null;
  participants: { individualId: string; roleId: string; sortOrder: number }[];
}

export function useAdminRelationships() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminRelationshipsResponse>(BASE),
  });
}

export function useAdminRelationship(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => fetchJson<{ relationship: AdminRelationship }>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useCreateAdminRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RelationshipMutationInput) =>
      postJson<{ relationship: AdminRelationship }>(BASE, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAdminRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: RelationshipMutationInput & { id: string }) =>
      patchJson<{ relationship: AdminRelationship }>(`${BASE}/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAdminRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson<{ ok: boolean }>(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
