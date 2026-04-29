"use client";

import Link from "next/link";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { FamilyAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { FAMILY_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import type { AdminFamilyEventRow } from "@/hooks/useAdminFamilyEvents";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
const EVENT_SOURCE_LABELS: Record<string, string> = {
  familyRecord: "Family record",
  member: "Member",
};

export function FamilyEditorOtherFamilyEventsPanel({
  eventsLoading,
  eventsErr,
  events,
  paginatedEvents,
  eventPagination,
  eventPageCount,
  onEventPaginationChange,
}: {
  eventsLoading: boolean;
  eventsErr: string | null;
  events: AdminFamilyEventRow[];
  paginatedEvents: AdminFamilyEventRow[];
  eventPagination: PaginationState;
  eventPageCount: number;
  onEventPaginationChange: (updater: Updater<PaginationState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-1">
        <h3 className="text-base font-semibold text-foreground">Other family events</h3>
        <p className="text-sm text-muted-foreground">
          Additional GEDCOM events on this family record. Add custom events from the Relationship timeline.
        </p>
      </div>
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
                className="rounded-lg border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
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
                      <Link href={`/admin/events/${e.eventId}`} className="link link-primary text-xs font-medium">
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
    </div>
  );
}
