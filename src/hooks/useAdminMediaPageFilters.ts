"use client";

import type { UseAdminMediaOpts } from "@/hooks/useAdminMedia";
import { useFilterState } from "@/hooks/useFilterState";

export interface AdminMediaPageFilterState {
  mediaCategory: string;
  titleContains: string;
  fileRefContains: string;
  fileTypeContains: string;
  linkedGiven: string;
  linkedLast: string;
  q: string;
}

export const ADMIN_MEDIA_PAGE_FILTER_DEFAULTS: AdminMediaPageFilterState = {
  mediaCategory: "",
  titleContains: "",
  fileRefContains: "",
  fileTypeContains: "",
  linkedGiven: "",
  linkedLast: "",
  q: "",
};

/**
 * Filter-only query opts (no `limit`/`offset`). Pagination is owned by the page so the
 * server returns a single page at a time instead of the full dataset.
 */
export function adminMediaPageFilterStateToQueryOpts(applied: AdminMediaPageFilterState): UseAdminMediaOpts {
  const opts: UseAdminMediaOpts = {};
  const q = applied.q.trim();
  if (q) opts.q = q;
  if (
    applied.mediaCategory === "photo" ||
    applied.mediaCategory === "document" ||
    applied.mediaCategory === "video" ||
    applied.mediaCategory === "audio"
  ) {
    opts.mediaCategory = applied.mediaCategory;
  }
  const tc = applied.titleContains.trim();
  if (tc) opts.titleContains = tc;
  const fr = applied.fileRefContains.trim();
  if (fr) opts.fileRefContains = fr;
  const ft = applied.fileTypeContains.trim();
  if (ft) opts.fileTypeContains = ft;
  const lg = applied.linkedGiven.trim();
  const ll = applied.linkedLast.trim();
  if (lg) opts.linkedGiven = lg;
  if (ll) opts.linkedLast = ll;
  return opts;
}

export function useAdminMediaPageFilters() {
  return useFilterState(ADMIN_MEDIA_PAGE_FILTER_DEFAULTS, adminMediaPageFilterStateToQueryOpts);
}
