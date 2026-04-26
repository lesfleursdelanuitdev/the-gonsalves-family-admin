"use client";

import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { useFilterState } from "@/hooks/useFilterState";
import type { UseAdminNotesOpts } from "@/hooks/useAdminNotes";

export interface AdminNotesPageFilterState {
  isTopLevel: string;
  contentContains: string;
  linkedGiven: string;
  linkedLast: string;
}

export const ADMIN_NOTES_PAGE_FILTER_DEFAULTS: AdminNotesPageFilterState = {
  isTopLevel: "",
  contentContains: "",
  linkedGiven: "",
  linkedLast: "",
};

export function adminNotesPageFilterStateToQueryOpts(applied: AdminNotesPageFilterState): UseAdminNotesOpts {
  const opts: UseAdminNotesOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  if (applied.isTopLevel === "true" || applied.isTopLevel === "false") {
    opts.isTopLevel = applied.isTopLevel;
  }
  const cc = applied.contentContains.trim();
  if (cc) opts.contentContains = cc;
  const lg = applied.linkedGiven.trim();
  const ll = applied.linkedLast.trim();
  if (lg) opts.linkedGiven = lg;
  if (ll) opts.linkedLast = ll;
  return opts;
}

export function useAdminNotesPageFilters() {
  return useFilterState(ADMIN_NOTES_PAGE_FILTER_DEFAULTS, adminNotesPageFilterStateToQueryOpts);
}
