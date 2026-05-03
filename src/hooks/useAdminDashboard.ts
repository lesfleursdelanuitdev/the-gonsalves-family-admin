"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import type {
  AdminDashboardSnapshot,
  DashboardActivityItem,
  DashboardNeedsAttentionRow,
} from "@/lib/admin/admin-dashboard-snapshot";

export type AdminDashboardResponse =
  | ({
      configured: true;
      unreadMessages: number;
    } & AdminDashboardSnapshot)
  | {
      configured: false;
      unreadMessages: number;
      setupMessage: string;
      totals: null;
      recentUpdatesCount: number;
      activity: DashboardActivityItem[];
      needsAttention: DashboardNeedsAttentionRow[];
      needsAttentionTotal: number;
    };

const KEY = ["admin", "dashboard"] as const;

export function useAdminDashboard() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminDashboardResponse>("/api/admin/dashboard"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
