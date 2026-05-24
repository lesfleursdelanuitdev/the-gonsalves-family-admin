"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";

const BASE = "/api/admin/lineages";
const KEY = ["admin", "lineages"] as const;

export interface AdminLineage {
  id: string;
  lineageHash: string;
  name: string;
  surname: string;
  size: number;
  founderIds: string[];
  topSurnames: string[];
  earliestYear: number | null;
  latestYear: number | null;
  computedAt: string;
}

export interface AdminLineagesResponse {
  lineages: AdminLineage[];
  stats: {
    totalLineages: number;
    totalMemberships: number;
    bridgeChildren: number | null;
    lastComputedAt: string | null;
    lastError: string | null;
  };
}

export function useAdminLineages() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminLineagesResponse>(BASE),
  });
}
