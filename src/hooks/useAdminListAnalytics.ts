"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";

function buildAnalyticsQueryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export function useAdminListAnalytics(
  segment: string,
  enabled: boolean,
  query?: Record<string, string | number | undefined>,
) {
  const qs = buildAnalyticsQueryString(query);

  return useQuery({
    queryKey: ["admin", "analytics", "segment", segment, qs] as const,
    queryFn: () => fetchJson<unknown>(`/api/admin/analytics/${encodeURIComponent(segment)}${qs}`),
    enabled,
    staleTime: 2 * 60_000,
    retry: 1,
  });
}
