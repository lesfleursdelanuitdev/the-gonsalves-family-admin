"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { ADMIN_FAMILIES_API_BASE, ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import type { FamilyDetailEvent } from "@/lib/detail/family-detail-events";

/** Matches API `GET /api/admin/families/[id]/events`. */
export type AdminFamilyEventRow = FamilyDetailEvent;

export function useAdminFamilyEvents(id: string) {
  return useQuery({
    queryKey: [...ADMIN_FAMILIES_QUERY_KEY, "events", id],
    queryFn: () => fetchJson<{ events: FamilyDetailEvent[] }>(`${ADMIN_FAMILIES_API_BASE}/${id}/events`),
    enabled: !!id,
  });
}
