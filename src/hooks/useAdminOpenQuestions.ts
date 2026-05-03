"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJson, fetchJson, patchJson, postJson } from "@/lib/infra/api";
import type { OpenQuestionEntityType } from "@/lib/admin/open-questions";

const QK = ["admin", "open-questions"] as const;

export type AdminOpenQuestionListItem = Record<string, unknown>;

export interface AdminOpenQuestionsListResponse {
  openQuestions: AdminOpenQuestionListItem[];
  total: number;
  hasMore: boolean;
}

export interface UseAdminOpenQuestionsOpts {
  status?: "open" | "resolved" | "archived" | "";
  q?: string;
  limit?: number;
  offset?: number;
}

function buildParams(opts: UseAdminOpenQuestionsOpts): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  return params;
}

export function useAdminOpenQuestions(opts: UseAdminOpenQuestionsOpts) {
  const params = buildParams(opts);
  return useQuery({
    queryKey: [...QK, "list", opts.status ?? "", opts.q ?? "", opts.limit ?? 50, opts.offset ?? 0] as const,
    queryFn: () =>
      fetchJson<AdminOpenQuestionsListResponse>(`/api/admin/open-questions?${params.toString()}`),
  });
}

export function useAdminOpenQuestion(id: string) {
  return useQuery({
    queryKey: [...QK, "detail", id] as const,
    queryFn: () => fetchJson<{ openQuestion: AdminOpenQuestionListItem }>(`/api/admin/open-questions/${id}`),
    enabled: Boolean(id),
  });
}

export function useOpenQuestionsByEntity(entityType: OpenQuestionEntityType, entityId: string) {
  const params = new URLSearchParams();
  params.set("entityType", entityType);
  params.set("entityId", entityId);
  return useQuery({
    queryKey: [...QK, "by-entity", entityType, entityId] as const,
    queryFn: () =>
      fetchJson<{ openQuestions: AdminOpenQuestionListItem[] }>(
        `/api/admin/open-questions/by-entity?${params.toString()}`,
      ),
    enabled: Boolean(entityId),
  });
}

export function useCreateOpenQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      question: string;
      details?: string | null;
      initialLinks?: { entityType: OpenQuestionEntityType; entityId: string }[];
    }) => postJson<{ openQuestion: AdminOpenQuestionListItem }>("/api/admin/open-questions", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function usePatchOpenQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      patchJson<{ openQuestion: AdminOpenQuestionListItem }>(`/api/admin/open-questions/${id}`, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: QK });
      void qc.invalidateQueries({ queryKey: [...QK, "detail", vars.id] as const });
    },
  });
}

export function useDeleteOpenQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`/api/admin/open-questions/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QK });
    },
  });
}
