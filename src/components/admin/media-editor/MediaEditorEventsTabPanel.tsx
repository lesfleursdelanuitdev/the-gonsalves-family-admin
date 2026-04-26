"use client";

import { EventPicker } from "@/components/admin/EventPicker";
import { MediaLinkSection } from "@/components/admin/media-editor/MediaLinkSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import type { StagedEventMedia } from "@/components/admin/media-editor/media-editor-types";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";

export type MediaEditorEventsTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mediaIdOrNew: string;
  stagedEvents: StagedEventMedia[];
  stagedEventIdSet: Set<string>;
  submitting: boolean;
  onRemoveEvent: (row: StagedEventMedia) => void;
  onPickEvent: (row: AdminEventListItem) => void;
  formatRowLabel: (event: AdminEventListItem) => string;
  eventTypeFilter: string;
  setEventTypeFilter: (v: string) => void;
  eventLinkKind: "individual" | "family";
  onEventLinkScopeChange: (v: "individual" | "family") => void;
  eventIndivGiven: string;
  eventIndivLast: string;
  setEventIndivGiven: (v: string) => void;
  setEventIndivLast: (v: string) => void;
  eventFamP1Given: string;
  eventFamP1Last: string;
  eventFamP2Given: string;
  eventFamP2Last: string;
  setEventFamP1Given: (v: string) => void;
  setEventFamP1Last: (v: string) => void;
  setEventFamP2Given: (v: string) => void;
  setEventFamP2Last: (v: string) => void;
};

export function MediaEditorEventsTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mediaIdOrNew,
  stagedEvents,
  stagedEventIdSet,
  submitting,
  onRemoveEvent,
  onPickEvent,
  formatRowLabel,
  eventTypeFilter,
  setEventTypeFilter,
  eventLinkKind,
  onEventLinkScopeChange,
  eventIndivGiven,
  eventIndivLast,
  setEventIndivGiven,
  setEventIndivLast,
  eventFamP1Given,
  eventFamP1Last,
  eventFamP2Given,
  eventFamP2Last,
  setEventFamP1Given,
  setEventFamP1Last,
  setEventFamP2Given,
  setEventFamP2Last,
}: MediaEditorEventsTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <MediaLinkSection
        description="Pick the GEDCOM event tag, whether it is tied to a person or a family, then narrow by name (same rules as the Events list). Family events use two partner fields."
        label="Linked events"
        pills={
          <>
            {stagedEvents.map((t) => (
              <MediaEditorPill
                key={t.eventId}
                label={t.label}
                onRemove={() => void onRemoveEvent(t)}
                disabled={submitting}
              />
            ))}
            {stagedEvents.length === 0 ? (
              <span className="text-sm text-muted-foreground">None linked.</span>
            ) : null}
          </>
        }
      >
        <EventPicker
          idPrefix={`media-ev-${mediaIdOrNew}`}
          requireEventType
          eventType={eventTypeFilter}
          onEventTypeChange={setEventTypeFilter}
          linkScope={eventLinkKind}
          onLinkScopeChange={onEventLinkScopeChange}
          indGiven={eventIndivGiven}
          indLast={eventIndivLast}
          onIndGivenChange={setEventIndivGiven}
          onIndLastChange={setEventIndivLast}
          famP1Given={eventFamP1Given}
          famP1Last={eventFamP1Last}
          famP2Given={eventFamP2Given}
          famP2Last={eventFamP2Last}
          onFamP1GivenChange={setEventFamP1Given}
          onFamP1LastChange={setEventFamP1Last}
          onFamP2GivenChange={setEventFamP2Given}
          onFamP2LastChange={setEventFamP2Last}
          excludeEventIds={stagedEventIdSet}
          formatRowLabel={formatRowLabel}
          onPick={(row) => void onPickEvent(row)}
          limit={ADMIN_LIST_MAX_LIMIT}
          linkScopeAsRadios
          partner1Legend="Partner 1"
          partner2Legend="Partner 2"
        />
      </MediaLinkSection>
    </div>
  );
}
