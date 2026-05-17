"use client";

import { useMemo } from "react";
import { useAdminFamilyEvents } from "@/hooks/useAdminFamilyEvents";
import { useAdminIndividualEvents } from "@/hooks/useAdminIndividuals";
import { useAdminNoteEvents } from "@/hooks/useAdminNoteEvents";
import { sortEventsChronologically } from "@ligneous/timeline-view";
import type { TimelineDataContract } from "@ligneous/timeline-view";
import type { StoryTimelineEmbedPayload } from "@/lib/admin/story-creator/story-types";

export function useStoryTimelineEmbedData(embed: StoryTimelineEmbedPayload): TimelineDataContract {
  const scope = embed.scope ?? null;
  const entityId = embed.entityId ?? null;

  const indResult = useAdminIndividualEvents(entityId ?? "", {
    enabled: scope === "individual" && !!entityId,
  });
  const famResult = useAdminFamilyEvents(entityId ?? "", {
    enabled: scope === "family" && !!entityId,
  });
  const noteResult = useAdminNoteEvents(entityId ?? "", {
    enabled: scope === "note" && !!entityId,
  });

  return useMemo((): TimelineDataContract => {
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
  }, [scope, entityId, indResult, famResult, noteResult]);
}
