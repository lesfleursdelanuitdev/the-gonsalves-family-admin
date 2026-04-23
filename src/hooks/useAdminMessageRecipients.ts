"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";

const KEY = ["admin", "messages", "recipients"] as const;

export interface MessageRecipientOption {
  id: string;
  username: string;
  name: string | null;
}

export function useAdminMessageRecipients() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<{ users: MessageRecipientOption[] }>("/api/admin/messages/recipients"),
  });
}
