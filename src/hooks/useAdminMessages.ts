"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson, deleteJson } from "@/lib/infra/api";

const BASE = "/api/admin/messages";
const KEY = ["admin", "messages"] as const;

export interface AdminMessageListItem {
  id: string;
  subject: string | null;
  createdAt: string | Date;
  isRead: boolean;
  sender: { name: string | null; username: string };
  recipient: { name: string | null; username: string };
}

export interface AdminMessagesListResponse {
  messages: AdminMessageListItem[];
  total: number;
  hasMore: boolean;
}

export function useAdminMessages(opts?: {
  q?: string;
  filter?: "inbox" | "sent" | "all";
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.filter) params.set("filter", opts.filter);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();

  return useQuery({
    queryKey: [...KEY, opts?.filter ?? "all", opts?.q ?? "", opts?.limit ?? 50, opts?.offset ?? 0],
    queryFn: () => fetchJson<AdminMessagesListResponse>(`${BASE}${qs ? `?${qs}` : ""}`),
  });
}

export function useAdminMessage(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => fetchJson<{ message: unknown }>(`${BASE}/${id}`),
    enabled: !!id,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { recipientId: string; subject?: string; content: string }) =>
      postJson(`${BASE}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      patchJson(`${BASE}/${id}`, { isRead }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJson(`${BASE}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
