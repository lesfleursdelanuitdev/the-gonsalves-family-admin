"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";

const BASE = "/api/admin/branches";
const KEY = ["admin", "branches"] as const;

export interface AdminBranch {
  id: string;
  branchHash: string;
  name: string;
  size: number;
  isMain: boolean;
  founderIds: string[];
  topSurnames: string[];
  earliestYear: number | null;
  latestYear: number | null;
  computedAt: string;
}

export interface AdminBranchesResponse {
  branches: AdminBranch[];
  stats: {
    totalBranches: number;
    totalIndividualsInBranches: number;
    lastComputedAt: string | null;
    lastError: string | null;
  };
}

export function useAdminBranches() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => fetchJson<AdminBranchesResponse>(BASE),
  });
}
