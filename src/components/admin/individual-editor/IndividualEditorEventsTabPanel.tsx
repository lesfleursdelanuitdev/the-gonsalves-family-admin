"use client";

import Link from "next/link";
import { IconHeartbeat, IconSkull } from "@tabler/icons-react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { IndividualAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import type { LivingMode } from "@/lib/admin/admin-individual-living";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { cn } from "@/lib/utils";

const EVENT_SOURCE_LABELS: Record<string, string> = {
  individual: "Self",
  family: "Family",
  spouseDeath: "Spouse",
  childBirth: "Child birth",
  childDeath: "Child death",
  childMarriage: "Child marriage",
  grandchildBirth: "Grandchild birth",
  parentDeath: "Parent",
  siblingDeath: "Sibling",
  grandparentDeath: "Grandparent",
};

export type IndividualEditorEventsTabPanelProps = {
  hidden: boolean;
  /** When true, birth/death editors are omitted (shown elsewhere). */
  omitBirthDeath?: boolean;
  /** When true, living status block is omitted (shown in Basic info). */
  omitLivingBlock?: boolean;
  birth: KeyFactFormState;
  onBirthChange: (next: KeyFactFormState) => void;
  death: KeyFactFormState;
  onDeathChange: (next: KeyFactFormState) => void;
  livingStatus: { text: string; deceased: boolean };
  livingMode: LivingMode;
  onLivingModeChange: (mode: LivingMode) => void;
  individualId: string;
  individualNewEventLabel: string;
  eventsLoading: boolean;
  eventsErr: string | null;
  timelineEvents: IndividualDetailEvent[];
  paginatedTimelineEvents: IndividualDetailEvent[];
  eventPagination: PaginationState;
  eventPageCount: number;
  onEventPaginationChange: (updater: Updater<PaginationState>) => void;
};

export function IndividualEditorEventsTabPanel({
  hidden,
  omitBirthDeath = false,
  omitLivingBlock = false,
  birth,
  onBirthChange,
  death,
  onDeathChange,
  livingStatus,
  livingMode,
  onLivingModeChange,
  individualId,
  individualNewEventLabel,
  eventsLoading,
  eventsErr,
  timelineEvents,
  paginatedTimelineEvents,
  eventPagination,
  eventPageCount,
  onEventPaginationChange,
}: IndividualEditorEventsTabPanelProps) {
  return (
    <div role="region" aria-label="Life events" hidden={hidden} className="space-y-8 pt-2">
      {!omitBirthDeath ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Birth & death</CardTitle>
            <p className="text-sm text-muted-foreground">
              Clear all date and place fields on an event to remove it from this person&apos;s record.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
          <KeyFactSection title="Birth" fact={birth} onChange={onBirthChange} defaultOpen />
          <KeyFactSection title="Death" fact={death} onChange={onDeathChange} defaultOpen />
          </CardContent>
        </Card>
      ) : null}

      {!omitLivingBlock ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Living status</CardTitle>
            <p
              className={cn(
                "flex items-center gap-2 text-lg font-semibold",
                livingStatus.deceased ? "text-destructive" : "text-green-600 dark:text-green-500",
              )}
            >
              {livingStatus.deceased ? (
                <IconSkull size={24} stroke={1.5} className="shrink-0" aria-hidden />
              ) : (
                <IconHeartbeat size={24} stroke={1.5} className="shrink-0" aria-hidden />
              )}
              {livingStatus.text}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="living-mode">Mode</Label>
              <select
                id="living-mode"
                className={selectClassName}
                value={livingMode}
                onChange={(e) => onLivingModeChange(e.target.value as LivingMode)}
              >
                <option value="auto">Automatic (death + 120-year rule)</option>
                <option value="living">Force living</option>
                <option value="deceased">Force deceased</option>
              </select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Other life events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Residences, occupations, marriages, and other milestones. Open a row to edit it in Events.
            </p>
          </div>
          {individualId ? (
            <Link
              href={`/admin/events/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add another life event
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {!individualId ? (
            <p className="text-sm text-muted-foreground">
              Save this person first to load events and attach new ones to their record.
            </p>
          ) : eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : eventsErr ? (
            <p className="text-sm text-destructive">{eventsErr}</p>
          ) : timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other events yet.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedTimelineEvents.map((e, i) => (
                  <div
                    key={
                      e.eventId ??
                      `ev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.familyId ?? ""}`
                    }
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {e.eventType}
                      {e.customType ? ` · ${e.customType}` : ""}
                    </p>
                    <div className="mt-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2">
                          <GedcomEventTypeIcon eventType={e.eventType} />
                          <span className="font-semibold text-base-content">{labelGedcomEventType(e.eventType)}</span>
                        </span>
                        <span className="badge badge-ghost badge-sm inline-flex items-center px-2.5 py-1 font-normal">
                          {EVENT_SOURCE_LABELS[e.source] ?? e.source}
                        </span>
                      </div>
                      <p className="text-sm">{formatEventDate(e)}</p>
                      <p className="text-sm text-muted-foreground">{e.placeName || e.placeOriginal || "—"}</p>
                      {e.value ? <p className="text-xs">{e.value}</p> : null}
                      <IndividualAdminEventContext e={e} />
                      {e.eventId ? (
                        <p className="pt-1">
                          <Link href={`/admin/events/${e.eventId}`} className="link link-primary text-xs font-medium">
                            Open in Events admin
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {timelineEvents.length > INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE ? (
                <div className="flex justify-end pt-1">
                  <DataViewerPagination
                    pagination={eventPagination}
                    pageCount={eventPageCount}
                    filteredTotal={timelineEvents.length}
                    onPaginationChange={onEventPaginationChange}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
