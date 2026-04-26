"use client";

import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { useFilterState } from "@/hooks/useFilterState";
import type { UseAdminFamiliesOpts } from "@/hooks/useAdminFamilies";

export interface AdminFamiliesPageFilterState {
  partnerCount: string;
  p1Given: string;
  p1Last: string;
  p2Given: string;
  p2Last: string;
  childrenOp: string;
  childrenCount: string;
  hasMarriageDate: string;
}

export const ADMIN_FAMILIES_PAGE_FILTER_DEFAULTS: AdminFamiliesPageFilterState = {
  partnerCount: "",
  p1Given: "",
  p1Last: "",
  p2Given: "",
  p2Last: "",
  childrenOp: "",
  childrenCount: "",
  hasMarriageDate: "",
};

export function adminFamiliesPageFilterStateToQueryOpts(
  applied: AdminFamiliesPageFilterState,
): UseAdminFamiliesOpts {
  const opts: UseAdminFamiliesOpts = {
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  };
  if (applied.partnerCount === "one" || applied.partnerCount === "two") {
    opts.partnerCount = applied.partnerCount;
  }
  const p1g = applied.p1Given.trim();
  const p1l = applied.p1Last.trim();
  const p2g = applied.p2Given.trim();
  const p2l = applied.p2Last.trim();
  if (p1g) opts.p1Given = p1g;
  if (p1l) opts.p1Last = p1l;
  if (p2g) opts.p2Given = p2g;
  if (p2l) opts.p2Last = p2l;
  if (applied.childrenOp === "gt" || applied.childrenOp === "lt" || applied.childrenOp === "eq") {
    opts.childrenOp = applied.childrenOp;
    const cc = applied.childrenCount.trim();
    if (cc) opts.childrenCount = cc;
  }
  if (applied.hasMarriageDate === "true" || applied.hasMarriageDate === "false") {
    opts.hasMarriageDate = applied.hasMarriageDate;
  }
  return opts;
}

export function useAdminFamiliesPageFilters() {
  return useFilterState(ADMIN_FAMILIES_PAGE_FILTER_DEFAULTS, adminFamiliesPageFilterStateToQueryOpts);
}
