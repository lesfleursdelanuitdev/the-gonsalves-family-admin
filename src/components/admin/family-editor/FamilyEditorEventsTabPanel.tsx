"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { KeyFactSection } from "@/components/admin/individual-editor/KeyFactSection";
import { FamilyAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { FAMILY_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import type { AdminFamilyEventRow } from "@/hooks/useAdminFamilyEvents";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { cn } from "@/lib/utils";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";

const EVENT_SOURCE_LABELS: Record<string, string> = {
  familyRecord: "Family record",
  member: "Member",
};

export type FamilyEditorEventsTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  marriageFact: KeyFactFormState;
  setMarriageFact: Dispatch<SetStateAction<KeyFactFormState>>;
  divorceFact: KeyFactFormState;
  setDivorceFact: Dispatch<SetStateAction<KeyFactFormState>>;
  isDivorced: boolean;
  setIsDivorced: (v: boolean) => void;
  onSaveMarriageAndDivorce: () => void | Promise<void>;
  saveMarriageDisabled: boolean;
  familyId: string;
  familyNewEventLabel: string;
  eventsLoading: boolean;
  eventsErr: string | null;
  events: AdminFamilyEventRow[];
  paginatedEvents: AdminFamilyEventRow[];
  eventPagination: PaginationState;
  eventPageCount: number;
  onEventPaginationChange: (updater: Updater<PaginationState>) => void;
};

export function FamilyEditorEventsTabPanel({
  hidden,
  mode,
  marriageFact,
  setMarriageFact,
  divorceFact,
  setDivorceFact,
  isDivorced,
  setIsDivorced,
  onSaveMarriageAndDivorce,
  saveMarriageDisabled,
  familyId,
  familyNewEventLabel,
  eventsLoading,
  eventsErr,
  events,
  paginatedEvents,
  eventPagination,
  eventPageCount,
  onEventPaginationChange,
}: FamilyEditorEventsTabPanelProps) {
  return (
    <div
      id="family-editor-panel-events"
      role="tabpanel"
      aria-labelledby="family-editor-tab-events"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Marriage & Divorce</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marriage (MARR) and divorce (DIV) are stored as family events with linked date and place rows; marriage
            details are also denormalized on the family record for lists and search.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeyFactSection title="Marriage date & place" fact={marriageFact} onChange={setMarriageFact} defaultOpen />
          <KeyFactSection title="Divorce date & place" fact={divorceFact} onChange={setDivorceFact} defaultOpen />
          <div className="flex min-h-11 items-start gap-3 sm:min-h-0">
            <Checkbox
              id="family-is-divorced"
              checked={isDivorced}
              onCheckedChange={(v) => setIsDivorced(v === true)}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor="family-is-divorced" className="cursor-pointer font-normal leading-snug">
              Divorced (flag on family record; can be used with or without a structured divorce event above)
            </Label>
          </div>
          {mode !== "create" ? (
            <Button type="button" onClick={() => void onSaveMarriageAndDivorce()} disabled={saveMarriageDisabled}>
              Save marriage & divorce
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Marriage and divorce are applied when you choose{" "}
              <span className="font-medium text-base-content/90">Create new family</span> below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Other events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Events on this family record and each member&apos;s own individual events. Marriage and divorce above are
              saved separately; open an event here to edit it in Events admin.
            </p>
          </div>
          {familyId ? (
            <Link
              href={`/admin/events/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add event
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : eventsErr ? (
            <p className="text-sm text-destructive">{eventsErr}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other events yet.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedEvents.map((e, i) => (
                  <div
                    key={
                      e.eventId ??
                      `fev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.memberId ?? ""}`
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
                      <FamilyAdminEventContext e={e} />
                      {e.eventId ? (
                        <p className="pt-1">
                          <Link
                            href={`/admin/events/${e.eventId}`}
                            className="link link-primary text-xs font-medium"
                          >
                            Open in Events admin
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {events.length > FAMILY_DETAIL_EVENTS_PAGE_SIZE ? (
                <div className="flex justify-end pt-1">
                  <DataViewerPagination
                    pagination={eventPagination}
                    pageCount={eventPageCount}
                    filteredTotal={events.length}
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
