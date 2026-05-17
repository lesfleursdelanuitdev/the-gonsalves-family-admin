"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { ADMIN_FAMILIES_API_BASE, ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import type { FamilyDetailEvent } from "@/lib/detail/family-detail-events";
import type { TimelineSubject } from "@ligneous/gedcom-events";

/** Matches API `GET /api/admin/families/[id]/events`. */
export type AdminFamilyEventRow = FamilyDetailEvent;

export type AdminFamilyEventsResponse = {
  events: FamilyDetailEvent[];
  timelineSubject?: TimelineSubject;
};

export function useAdminFamilyEvents(id: string, opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false && !!id;
  return useQuery({
    queryKey: [...ADMIN_FAMILIES_QUERY_KEY, "events", id],
    queryFn: () => fetchJson<AdminFamilyEventsResponse>(`${ADMIN_FAMILIES_API_BASE}/${id}/events`),
    enabled,
  });
}
