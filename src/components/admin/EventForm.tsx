"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Image, Link2, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import {
  EVENT_FORM_CUSTOM_TAG,
  EVENT_TYPE_TAG_LIST,
  createEmptyEventFormDefaults,
  eventFormDefaultsToKeyFactState,
  eventRecordToFormDefaults,
} from "@/lib/forms/event-form-initial";
import type { KeyFactFormState } from "@/lib/forms/individual-editor-form";
import { gedcomDateSpecifierNeedsRange } from "@/lib/gedcom/gedcom-date-specifiers";
import {
  eventDetailToSelectedLinks,
  noteLinksToEventCreatePayload,
  unionEventLinkTargets,
} from "@/lib/forms/event-form-links";
import { invalidateAdminEventTimelines } from "@/lib/admin/invalidate-admin-event-timelines";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { GedcomDateInput } from "@/components/admin/GedcomDateInput";
import { GedcomPlaceInput } from "@/components/admin/GedcomPlaceInput";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { MediaPicker } from "@/components/admin/media-picker";
import { NoteLinkedRecordsPicker } from "@/components/admin/NoteLinkedRecordsPicker";
import { ADMIN_EVENTS_QUERY_KEY, useCreateEvent, useUpdateEvent } from "@/hooks/useAdminEvents";
import { selectClassName } from "@/components/data-viewer/constants";
import { ApiError } from "@/lib/infra/api";
import { eventPageDisplayTitle } from "@/lib/gedcom/event-page-title";

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseMediaIdsCsv(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

type EventEditorTab = "event" | "records" | "media";

const EVENT_EDITOR_TAB_ITEMS: { id: EventEditorTab; label: string; icon: LucideIcon }[] = [
  { id: "event", label: "Event", icon: CalendarDays },
  { id: "records", label: "Linked records", icon: Link2 },
  { id: "media", label: "Linked media", icon: Image },
];

export interface EventFormProps {
  mode: "create" | "edit";
  eventId?: string;
  /** Required when mode is `edit` (raw event from GET). */
  initialEvent?: Record<string, unknown> | null;
  /** Create mode only: seed link chips (e.g. query params on `/admin/events/new`). */
  prefillLinks?: SelectedNoteLink[];
  hideBackLink?: boolean;
}

export function EventForm({
  mode,
  eventId,
  initialEvent,
  prefillLinks,
  hideBackLink = false,
}: EventFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const defaults = useMemo(() => {
    if (mode === "edit" && initialEvent) {
      return eventRecordToFormDefaults(initialEvent);
    }
    const base = createEmptyEventFormDefaults();
    if (mode === "create" && prefillLinks?.length) {
      return { ...base, selectedLinks: [...prefillLinks] };
    }
    return base;
  }, [mode, initialEvent, prefillLinks]);

  const [eventTypeChoice, setEventTypeChoice] = useState(defaults.eventTypeChoice);
  const [customEventTag, setCustomEventTag] = useState(defaults.customEventTag);
  const [customType, setCustomType] = useState(defaults.customType);
  const [value, setValue] = useState(defaults.value);
  const [cause, setCause] = useState(defaults.cause);
  const [agency, setAgency] = useState(defaults.agency);

  const [datePlace, setDatePlace] = useState<KeyFactFormState>(() => eventFormDefaultsToKeyFactState(defaults));

  const [selectedLinks, setSelectedLinks] = useState<SelectedNoteLink[]>(defaults.selectedLinks);
  const [mediaIdsCsv, setMediaIdsCsv] = useState(defaults.mediaIdsCsv);
  const [editorTab, setEditorTab] = useState<EventEditorTab>("event");

  const linkedRecordCount = selectedLinks.length;
  const linkedMediaCount = useMemo(() => parseMediaIdsCsv(mediaIdsCsv).length, [mediaIdsCsv]);

  const eventMediaItems = useMemo(() => {
    if (mode !== "edit" || !initialEvent) return [];
    const rows = initialEvent.eventMedia as { media: Record<string, unknown> }[] | undefined;
    return Array.isArray(rows) ? rows : [];
  }, [mode, initialEvent]);

  const linkedEventMediaIds = useMemo(() => new Set(parseMediaIdsCsv(mediaIdsCsv)), [mediaIdsCsv]);

  const syncedMediaIdsCsv = useMemo(() => {
    if (mode !== "edit" || !initialEvent) return null;
    return eventRecordToFormDefaults(initialEvent).mediaIdsCsv;
  }, [mode, initialEvent]);

  useEffect(() => {
    if (syncedMediaIdsCsv == null) return;
    setMediaIdsCsv(syncedMediaIdsCsv);
  }, [syncedMediaIdsCsv]);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isPending = createEvent.isPending || updateEvent.isPending;
  const err = createEvent.error ?? updateEvent.error;
  const errMsg = err?.message;
  const errStatus = err instanceof ApiError ? err.status : undefined;

  const showRange = gedcomDateSpecifierNeedsRange(datePlace.dateSpecifier);
  const resolvedEventType =
    eventTypeChoice === EVENT_FORM_CUSTOM_TAG ? customEventTag.trim().toUpperCase() : eventTypeChoice;

  const buildDatePayload = (): Record<string, unknown> | undefined => {
    const year = parseYm(datePlace.y);
    const month = parseYm(datePlace.m);
    const day = parseYm(datePlace.d);
    const endYear = parseYm(datePlace.ey);
    const endMonth = parseYm(datePlace.em);
    const endDay = parseYm(datePlace.ed);
    const orig = datePlace.dateOriginal.trim();
    const isDefaultExact =
      datePlace.dateSpecifier === "EXACT" &&
      !orig &&
      year == null &&
      month == null &&
      day == null &&
      endYear == null &&
      endMonth == null &&
      endDay == null;
    if (isDefaultExact) return undefined;
    return {
      dateType: datePlace.dateSpecifier,
      calendar: "GREGORIAN",
      original: orig || undefined,
      year,
      month,
      day,
      endYear: showRange ? endYear : null,
      endMonth: showRange ? endMonth : null,
      endDay: showRange ? endDay : null,
    };
  };

  const buildPlacePayload = (): Record<string, unknown> | undefined => {
    const name = datePlace.placeName.trim();
    const county = datePlace.placeCounty.trim();
    const state = datePlace.placeState.trim();
    const country = datePlace.placeCountry.trim();
    const original = datePlace.placeOriginal.trim();
    const lat = datePlace.placeLat.trim();
    const lng = datePlace.placeLng.trim();
    if (!name && !county && !state && !country && !original && !lat && !lng) return undefined;
    return {
      original: original || undefined,
      name: name || undefined,
      county: county || undefined,
      state: state || undefined,
      country: country || undefined,
      latitude: lat ? Number(lat) : undefined,
      longitude: lng ? Number(lng) : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedEventType) return;

    const date = buildDatePayload();
    const place = buildPlacePayload();
    const links = noteLinksToEventCreatePayload(selectedLinks);
    const timelineInvalidateTargets =
      mode === "edit" && initialEvent
        ? unionEventLinkTargets(links, noteLinksToEventCreatePayload(eventDetailToSelectedLinks(initialEvent)))
        : links;

    const mediaIds = parseMediaIdsCsv(mediaIdsCsv);

    if (mode === "create") {
      createEvent.mutate(
        {
          eventType: resolvedEventType,
          customType: customType.trim() || null,
          value: value.trim() || null,
          cause: cause.trim() || null,
          agency: agency.trim() || null,
          ...(date ? { date } : {}),
          ...(place ? { place } : {}),
          links,
          ...(mediaIds.length > 0 ? { mediaIds } : {}),
        },
        {
          onSuccess: (data) => {
            invalidateAdminEventTimelines(queryClient, timelineInvalidateTargets);
            const ev = data as { event?: { id?: string } };
            const newId = ev?.event?.id;
            if (newId) router.push(`/admin/events/${newId}`);
            else router.push("/admin/events");
          },
        },
      );
      return;
    }

    if (!eventId) return;

    updateEvent.mutate(
      {
        id: eventId,
        eventType: resolvedEventType,
        customType: customType.trim() || null,
        value: value.trim() || null,
        cause: cause.trim() || null,
        agency: agency.trim() || null,
        date: date ?? null,
        place: place ?? null,
        links,
        mediaIds,
      },
      {
        onSuccess: () => {
          invalidateAdminEventTimelines(queryClient, timelineInvalidateTargets);
          router.push(`/admin/events/${eventId}`);
        },
      },
    );
  };

  const headlineTitle = useMemo(() => {
    if (mode !== "edit" || !initialEvent) return "";
    return eventPageDisplayTitle({
      eventType: resolvedEventType,
      customType: customType.trim() || null,
      individualEvents:
        (initialEvent.individualEvents as { individual: Record<string, unknown> }[]) ?? [],
      familyEvents: (initialEvent.familyEvents as { family: Record<string, unknown> }[]) ?? [],
      selectedLinks,
    });
  }, [mode, initialEvent, resolvedEventType, customType, selectedLinks]);

  const title = mode === "create" ? "New event" : `Edit ${headlineTitle}`;

  useEffect(() => {
    const app = "Gonsalves Family Admin";
    if (mode === "create") {
      document.title = `New event · ${app}`;
      return () => {
        document.title = app;
      };
    }
    document.title = `Edit ${headlineTitle} · ${app}`;
    return () => {
      document.title = app;
    };
  }, [mode, headlineTitle]);

  const subtitle =
    mode === "create"
      ? "Add a life event with optional structured date, place, and links to individuals or families."
      : "Update this event. Saving replaces date, place, individual/family links, and linked media IDs.";

  const cancelHref = mode === "edit" && eventId ? `/admin/events/${eventId}` : "/admin/events";

  return (
    <div className="space-y-6">
      {!hideBackLink ? (
        <div className="flex items-center gap-2">
          <Link
            href={cancelHref}
            aria-label="Back"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-8">
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
            {errStatus != null ? ` (${errStatus})` : ""}
          </p>
        ) : null}

        <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
          <div
            className="flex gap-0 overflow-x-auto overscroll-x-contain"
            role="tablist"
            aria-label="Event editor sections"
          >
            {EVENT_EDITOR_TAB_ITEMS.map((t) => {
              const Icon = t.icon;
              const selected = editorTab === t.id;
              const tabLabel =
                t.id === "records"
                  ? `Linked records (${linkedRecordCount})`
                  : t.id === "media"
                    ? `Linked media (${linkedMediaCount})`
                    : t.label;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`event-editor-panel-${t.id}`}
                  id={`event-editor-tab-${t.id}`}
                  title={tabLabel}
                  className={cn(
                    "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                    selected
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
                  )}
                  onClick={() => setEditorTab(t.id)}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="sr-only md:hidden">{tabLabel}</span>
                  <span className="hidden md:inline">{tabLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="event-editor-panel-event"
          role="tabpanel"
          aria-labelledby="event-editor-tab-event"
          hidden={editorTab !== "event"}
          className="space-y-8 pt-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Event type</CardTitle>
              <CardDescription>GEDCOM tag and optional description (TYPE subtag for EVEN, etc.).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-type-select">GEDCOM tag</Label>
                <select
                  id="event-type-select"
                  className={cn(selectClassName, "w-full max-w-md")}
                  value={eventTypeChoice}
                  onChange={(e) => setEventTypeChoice(e.target.value)}
                >
                  {EVENT_TYPE_TAG_LIST.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag} — {GEDCOM_EVENT_TYPE_LABELS[tag] ?? tag}
                    </option>
                  ))}
                  <option value={EVENT_FORM_CUSTOM_TAG}>Custom tag…</option>
                </select>
              </div>
              {eventTypeChoice === EVENT_FORM_CUSTOM_TAG ? (
                <div className="space-y-2">
                  <Label htmlFor="event-custom-tag">Custom tag</Label>
                  <Input
                    id="event-custom-tag"
                    value={customEventTag}
                    onChange={(e) => setCustomEventTag(e.target.value)}
                    placeholder="e.g. _MILIT or EVEN"
                    className="max-w-md font-mono uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored as the event type (GEDCOM 5.5 custom tags often use a leading underscore).
                  </p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="event-custom-type">Description / TYPE (optional)</Label>
                <Input
                  id="event-custom-type"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. occupation title for OCCU, or TYPE subtag for EVEN"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Date</CardTitle>
              <CardDescription>
                Defaults to exact; change the specifier for about, before/after, or ranges. Clear all fields to remove the
                date on save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GedcomDateInput
                idPrefix="event-"
                value={datePlace}
                onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
                eventStyleHints
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Place</CardTitle>
              <CardDescription>
                Structured fields map to the place record; clear all to remove on save.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GedcomPlaceInput
                idPrefix="event-"
                value={datePlace}
                onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
                eventStyleHints
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Other details</CardTitle>
              <CardDescription>Value, cause, and agency fields when relevant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-value">Value</Label>
                <Input id="event-value" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-cause">Cause</Label>
                <Input id="event-cause" value={cause} onChange={(e) => setCause(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-agency">Agency</Label>
                <Input id="event-agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div
          id="event-editor-panel-records"
          role="tabpanel"
          aria-labelledby="event-editor-tab-records"
          hidden={editorTab !== "records"}
          className="space-y-8 pt-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Linked records</CardTitle>
              <CardDescription>Individuals and families this event is attached to.</CardDescription>
            </CardHeader>
            <CardContent>
              <NoteLinkedRecordsPicker
                value={selectedLinks}
                onChange={setSelectedLinks}
                allowedLinkKinds={["individual", "family"]}
                linkingHint="Each search block is independent; pick a row to attach. Saving replaces all links. You can leave this empty."
              />
            </CardContent>
          </Card>
        </div>

        <div
          id="event-editor-panel-media"
          role="tabpanel"
          aria-labelledby="event-editor-tab-media"
          hidden={editorTab !== "media"}
          className="space-y-8 pt-2"
        >
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg">Linked media</CardTitle>
                <CardDescription>
                  Choose existing archive items or add new uploads. Saving still sends the full media ID list below
                  (picker links immediately; refresh updates the grid and the textarea).
                </CardDescription>
              </div>
              {mode === "edit" && eventId ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MediaPicker
                    targetType="event"
                    targetId={eventId}
                    mode="multiple"
                    triggerLabel="Choose from archive"
                    excludeMediaIds={linkedEventMediaIds}
                    onAttach={async () => {
                      await queryClient.invalidateQueries({
                        queryKey: [...ADMIN_EVENTS_QUERY_KEY, "detail", eventId],
                      });
                      router.refresh();
                    }}
                  />
                  <Link
                    href={`/admin/media/new?returnTo=${encodeURIComponent(`/admin/events/${eventId}/edit`)}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                  >
                    Add media
                  </Link>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "edit" && eventId ? (
                <>
                  {eventMediaItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No media linked to this event yet.</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
                      </p>
                      <AssociatedMediaThumbnailGrid items={eventMediaItems} />
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Save the new event first, then use the archive picker or paste media UUIDs below.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="event-media-ids">Linked media IDs (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Comma- or space-separated <span className="font-mono">gedcom_media_v2</span> UUIDs. On save, this
                  list replaces all event–media links; leave empty to remove all.
                </p>
                <textarea
                  id="event-media-ids"
                  value={mediaIdsCsv}
                  onChange={(e) => setMediaIdsCsv(e.target.value)}
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Link href={cancelHref} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </Link>
          <Button type="submit" disabled={isPending || !resolvedEventType}>
            {isPending ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create event" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
