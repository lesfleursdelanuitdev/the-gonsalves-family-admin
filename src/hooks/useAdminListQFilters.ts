"use client";

import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { useFilterState } from "@/hooks/useFilterState";

/** Draft + applied state for list pages that only filter via API `q` (tags, albums, places, dates, …). */
export interface AdminListQFilterState {
  q: string;
}

export const ADMIN_LIST_Q_FILTER_DEFAULTS: AdminListQFilterState = {
  q: "",
};

/** Query options passed to `useAdminTags`, `useAdminPlaces`, etc. */
export interface AdminListQQueryOpts {
  q?: string;
  limit: number;
  offset: number;
}

export function adminListQFilterStateToQueryOpts(applied: AdminListQFilterState): AdminListQQueryOpts {
  const q = applied.q.trim();
  return {
    ...(q ? { q } : {}),
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
}

export function adminListQActiveFilterCount(applied: AdminListQFilterState): number {
  return applied.q.trim() ? 1 : 0;
}

export function useAdminListQFilters() {
  return useFilterState(ADMIN_LIST_Q_FILTER_DEFAULTS, adminListQFilterStateToQueryOpts);
}
