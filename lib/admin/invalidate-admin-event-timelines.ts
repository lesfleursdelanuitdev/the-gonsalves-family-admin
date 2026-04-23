import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";

export function invalidateAdminEventTimelines(
  qc: QueryClient,
  targets: { individualIds: readonly string[]; familyIds: readonly string[] },
) {
  for (const id of new Set(targets.individualIds.filter(Boolean))) {
    void qc.invalidateQueries({ queryKey: [...ADMIN_INDIVIDUALS_QUERY_KEY, "events", id] });
  }
  for (const id of new Set(targets.familyIds.filter(Boolean))) {
    void qc.invalidateQueries({ queryKey: [...ADMIN_FAMILIES_QUERY_KEY, "events", id] });
  }
}
