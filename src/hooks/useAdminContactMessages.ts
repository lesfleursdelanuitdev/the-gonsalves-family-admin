"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";
import { patchJson, deleteJson } from "@/lib/infra/api";
import type { PublicIntakeStatus } from "@ligneous/prisma";

export interface AdminContactMessageListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  subject: string | null;
  status: PublicIntakeStatus;
  createdAt: string;
  reviewedAt: string | null;
  _count: { replies: number };
}

export interface AdminContactMessageReply {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  repliedBy: { id: string; name: string | null; username: string };
}

export interface AdminContactMessageDetail {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  subject: string | null;
  message: string;
  status: PublicIntakeStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string | null; username: string } | null;
  replies: AdminContactMessageReply[];
}

export interface AdminContactMessagesListResponse {
  messages: AdminContactMessageListItem[];
  total: number;
  hasMore: boolean;
}

function buildParams(opts: {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.status) p.set("status", opts.status);
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.offset) p.set("offset", String(opts.offset));
  return p;
}

const hooks = createAdminCrudHooks<
  { q?: string; status?: string; limit?: number; offset?: number },
  AdminContactMessagesListResponse
>({
  base: "/api/admin/contact-messages",
  queryKey: ["admin", "contact-messages"],
  buildParams,
});

export const useAdminContactMessages = hooks.useList;
export const useDeleteContactMessage = hooks.useDelete;

export function useAdminContactMessage(id: string) {
  return useQuery<{ message: AdminContactMessageDetail }>({
    queryKey: ["admin", "contact-messages", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contact-messages/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ message: AdminContactMessageDetail }>;
    },
    enabled: Boolean(id),
  });
}

export function useSetContactMessageStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PublicIntakeStatus }) =>
      patchJson<{ message: AdminContactMessageDetail }>(
        `/api/admin/contact-messages/${id}`,
        { action: "set_status", status },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "contact-messages", data.message.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
    },
  });
}

export function useSaveContactMessageNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      patchJson<{ message: AdminContactMessageDetail }>(
        `/api/admin/contact-messages/${id}`,
        { action: "set_notes", notes },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "contact-messages", data.message.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
    },
  });
}

export function useSendContactMessageReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subject, body }: { id: string; subject: string; body: string }) =>
      patchJson<{ message: AdminContactMessageDetail }>(
        `/api/admin/contact-messages/${id}`,
        { action: "reply", subject, body },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["admin", "contact-messages", data.message.id], data);
      void qc.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
    },
  });
}
