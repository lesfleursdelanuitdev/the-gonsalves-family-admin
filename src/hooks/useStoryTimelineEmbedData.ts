"use client";

import { useMemo } from "react";
import { useAdminFamilyEvents } from "@/hooks/useAdminFamilyEvents";
import { useAdminIndividualEvents } from "@/hooks/useAdminIndividuals";
import { useAdminNoteEvents } from "@/hooks/useAdminNoteEvents";
import { useTimelineEventResolution } from "@/hooks/useTimelineEventResolution";
import { sortEventsChronologically } from "@ligneous/timeline-view";
import type { TimelineDataContract } from "@ligneous/timeline-view";
import type { StoryTimelineEmbedPayload } from "@/lib/admin/story-creator/story-types";

export function useStoryTimelineEmbedData(embed: StoryTimelineEmbedPayload): TimelineDataContract {
  const scope = embed.scope ?? null;
  const entityId = embed.entityId ?? null;
  const rules = embed.rules ?? [];
  const globalFilters = embed.globalFilters;

  // Rule-based resolution (EventsListPicker custom mode — takes priority when rules are present)
  const ruleResolution = useTimelineEventResolution(rules, globalFilters);

  // Legacy entity-scoped queries
  const indResult = useAdminIndividualEvents(entityId ?? "", {
    enabled: rules.length === 0 && scope === "individual" && !!entityId,
  });
  const famResult = useAdminFamilyEvents(entityId ?? "", {
    enabled: rules.length === 0 && scope === "family" && !!entityId,
  });
  const noteResult = useAdminNoteEvents(entityId ?? "", {
    enabled: rules.length === 0 && scope === "note" && !!entityId,
  });

  return useMemo((): TimelineDataContract => {
    // Rule-based path
    if (rules.length > 0) {
      if (ruleResolution.status === "idle" || ruleResolution.status === "loading") return { status: "loading" };
      if (ruleResolution.status === "error") {
        return { status: "error", errorMessage: ruleResolution.errorMessage };
      }
      const events = sortEventsChronologically((ruleResolution as { status: "ready"; events: unknown[] }).events as never[] ?? []);
      return {
        status: "ready",
        events,
        timelineSubject: { kind: "none" },
        hasAnyPreviewMedia: false,
      };
    }

    // Legacy entity-scoped path
    if (!scope || !entityId) {
      return { status: "error", errorMessage: "No entity selected." };
    }

    const result = scope === "individual" ? indResult : scope === "family" ? famResult : noteResult;

    if (result.isLoading || result.isFetching) return { status: "loading" };
    if (result.error) {
      return {
        status: "error",
        errorMessage: result.error instanceof Error ? result.error.message : "Failed to load events.",
      };
    }
    if (!result.data) return { status: "loading" };

    const rawEvents = result.data.events ?? [];
    const events = sortEventsChronologically(rawEvents);
    const timelineSubject = result.data.timelineSubject ?? { kind: "none" };
    const hasAnyPreviewMedia = events.some((e) => Boolean(e.previewMediaFileRef?.trim()));

    return { status: "ready", events, timelineSubject, hasAnyPreviewMedia };
  }, [scope, entityId, rules, ruleResolution, indResult, famResult, noteResult]);
}
