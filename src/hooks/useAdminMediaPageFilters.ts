"use client";

import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
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

export function adminMediaPageFilterStateToQueryOpts(applied: AdminMediaPageFilterState): UseAdminMediaOpts {
  const opts: UseAdminMediaOpts = { limit: ADMIN_LIST_MAX_LIMIT, offset: 0 };
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
