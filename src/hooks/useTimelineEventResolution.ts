"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { sortEventsChronologically } from "@ligneous/timeline-view";
import type { IndividualDetailEvent } from "@ligneous/gedcom-events";
import type { AdminIndividualEventsResponse } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyEventsResponse } from "@/hooks/useAdminFamilyEvents";
import type { AdminNoteEventsResponse } from "@/hooks/useAdminNoteEvents";
import { ADMIN_FAMILIES_API_BASE, ADMIN_FAMILIES_QUERY_KEY } from "@/hooks/admin-families-shared";
import { ADMIN_INDIVIDUALS_QUERY_KEY } from "@/hooks/useAdminIndividuals";
import type { TimelineEventRule, TimelineEventRuleFilters, TimelineGlobalFilters } from "@/lib/admin/story-creator/story-types";

export type TimelineResolutionResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; events: IndividualDetailEvent[]; ruleCount: number; unsupportedRuleCount: number }
  | { status: "error"; errorMessage: string };

function applyRuleFilters(
  events: IndividualDetailEvent[],
  filters: TimelineEventRuleFilters | undefined,
): IndividualDetailEvent[] {
  if (!filters) return events;
  let out = events;
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const types = new Set(filters.eventTypes.map((t) => t.toUpperCase()));
    out = out.filter((e) => types.has(e.eventType.toUpperCase()));
  }
  if (filters.startYear != null) {
    const sy = filters.startYear;
    out = out.filter((e) => e.year == null || e.year >= sy);
  }
  if (filters.endYear != null) {
    const ey = filters.endYear;
    out = out.filter((e) => e.year == null || e.year <= ey);
  }
  return out;
}

function applyGlobalFilters(
  events: IndividualDetailEvent[],
  filters: TimelineGlobalFilters | undefined,
): IndividualDetailEvent[] {
  if (!filters) return events;
  let out = events;
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    const types = new Set(filters.eventTypes.map((t) => t.toUpperCase()));
    out = out.filter((e) => types.has(e.eventType.toUpperCase()));
  }
  if (filters.startYear != null) {
    const sy = filters.startYear;
    out = out.filter((e) => e.year == null || e.year >= sy);
  }
  if (filters.endYear != null) {
    const ey = filters.endYear;
    out = out.filter((e) => e.year == null || e.year <= ey);
  }
  if (filters.includeUndated === false) {
    out = out.filter((e) => e.year != null);
  }
  return out;
}

function deduplicateKey(event: IndividualDetailEvent): string {
  // eventId is the stable DB-backed key; fall back to a composite for synthetic rows.
  return (
    event.eventId ??
    `${event.eventType}::${event.year ?? ""}::${event.placeOriginal ?? ""}::${event.source}`
  );
}

type ResolvedRuleSet = { events: IndividualDetailEvent[]; rule: TimelineEventRule };

function mergeRuleSets(sets: ResolvedRuleSet[]): IndividualDetailEvent[] {
  const visited = new Set<string>();
  const merged: IndividualDetailEvent[] = [];
  for (const { events, rule } of sets) {
    const filtered = applyRuleFilters(events, rule.filters);
    for (const event of filtered) {
      const key = deduplicateKey(event);
      if (!visited.has(key)) {
        visited.add(key);
        merged.push(event);
      }
    }
  }
  return merged;
}

const INDIVIDUALS_BASE = "/api/admin/individuals";
const FAMILIES_BASE = ADMIN_FAMILIES_API_BASE;
const NOTES_BASE = "/api/admin/notes";

/**
 * Preview renderer resolution hook.
 *
 * Resolves `personEvents`, `familyEvents`, `memberEvents`, and `noteEvents` rules
 * via existing admin APIs. `relativeEvents` rules require server-side graph
 * traversal and are counted but not resolved in the preview. The visited-set
 * deduplication ensures no event appears twice regardless of how many rules
 * produce it.
 */
export function useTimelineEventResolution(
  rules: TimelineEventRule[],
  globalFilters?: TimelineGlobalFilters,
): TimelineResolutionResult {
  // Separate supported rules (resolvable in preview) from unsupported ones.
  const supportedRules = rules.filter((r) => r.kind !== "relativeEvents");
  const unsupportedRuleCount = rules.length - supportedRules.length;

  // Build one query descriptor per supported rule.
  const queries = useQueries({
    queries: supportedRules.map((rule) => {
      if (rule.kind === "personEvents") {
        return {
          queryKey: [...ADMIN_INDIVIDUALS_QUERY_KEY, "events", rule.personId],
          queryFn: () =>
            fetchJson<AdminIndividualEventsResponse>(`${INDIVIDUALS_BASE}/${rule.personId}/events`),
          enabled: !!rule.personId,
        };
      }
      if (rule.kind === "noteEvents") {
        return {
          queryKey: ["admin", "notes", "events", rule.noteId],
          queryFn: () =>
            fetchJson<AdminNoteEventsResponse>(`${NOTES_BASE}/${rule.noteId}/events`),
          enabled: !!rule.noteId,
        };
      }
      // familyEvents and memberEvents both use the family events endpoint.
      // memberEvents are distinguished server-side by event.source === "member".
      return {
        queryKey: [...ADMIN_FAMILIES_QUERY_KEY, "events", rule.familyId],
        queryFn: () =>
          fetchJson<AdminFamilyEventsResponse>(`${FAMILIES_BASE}/${rule.familyId}/events`),
        enabled: !!rule.familyId,
      };
    }),
  });

  return useMemo((): TimelineResolutionResult => {
    if (rules.length === 0) return { status: "idle" };

    const anyLoading = queries.some((q) => q.isLoading || q.isFetching);
    if (anyLoading) return { status: "loading" };

    const anyError = queries.find((q) => q.error);
    if (anyError) {
      return {
        status: "error",
        errorMessage:
          anyError.error instanceof Error ? anyError.error.message : "Failed to load events.",
      };
    }

    // Pair each query result back with its rule so we can apply local filters.
    const ruleSets: ResolvedRuleSet[] = supportedRules.map((rule, i) => {
      const data = queries[i]?.data;
      return { rule, events: (data?.events as IndividualDetailEvent[] | undefined) ?? [] };
    });

    const merged = mergeRuleSets(ruleSets);
    const sorted = sortEventsChronologically(merged);
    const events = applyGlobalFilters(sorted, globalFilters);

    return {
      status: "ready",
      events,
      ruleCount: rules.length,
      unsupportedRuleCount,
    };
  }, [rules, globalFilters, queries, supportedRules, unsupportedRuleCount]);
}
