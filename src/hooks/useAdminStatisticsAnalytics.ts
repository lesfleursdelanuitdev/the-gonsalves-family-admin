"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type {
  GivenNamesAnalyticsResponse,
  SurnamesAnalyticsResponse,
} from "@/lib/admin/admin-statistics-analytics";

export type AdminStatisticsAnalyticsResponse = {
  configured: true;
  treeId: string;
  givenNames: GivenNamesAnalyticsResponse;
  surnames: SurnamesAnalyticsResponse;
};

export function useAdminStatisticsAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "statistics-analytics"] as const,
    queryFn: () => fetchJson<AdminStatisticsAnalyticsResponse>("/api/admin/statistics-analytics"),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
