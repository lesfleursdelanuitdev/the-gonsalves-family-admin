"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type { AdminPlaceSuggestionRow } from "@/lib/forms/admin-place-suggestions";

export type AdminPlacesSuggestResponse = {
  places: AdminPlaceSuggestionRow[];
  total: number;
  hasMore: boolean;
};

const SUGGEST_STALE_MS = 60_000;

export function useAdminPlaceSuggestions(
  q: string,
  opts?: { minLength?: number; limit?: number; enabled?: boolean },
) {
  const minLength = opts?.minLength ?? 2;
  const limit = opts?.limit ?? 15;
  const trimmed = q.trim();
  const enabled =
    (opts?.enabled !== false) && trimmed.length >= minLength;

  const params = new URLSearchParams();
  params.set("q", trimmed);
  params.set("limit", String(limit));
  params.set("offset", "0");

  return useQuery({
    queryKey: ["admin", "places", "suggest", trimmed, limit] as const,
    queryFn: () =>
      fetchJson<AdminPlacesSuggestResponse>(`/api/admin/places?${params.toString()}`),
    enabled,
    staleTime: SUGGEST_STALE_MS,
  });
}
