"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { GEDCOM_EVENT_TYPE_LABELS } from "@/lib/gedcom/gedcom-event-labels";
import {
  EVENT_FORM_CUSTOM_TAG,
  EVENT_TYPE_TAG_LIST,
  createEmptyEventFormDefaults,
  eventRecordToFormDefaults,
} from "@/lib/forms/event-form-initial";
import {
  GEDCOM_DATE_SPECIFIER_OPTIONS,
  gedcomDateSpecifierNeedsRange,
} from "@/lib/gedcom/gedcom-date-specifiers";
import {
  eventDetailToSelectedLinks,
  noteLinksToEventCreatePayload,
  unionEventLinkTargets,
} from "@/lib/forms/event-form-links";
import { invalidateAdminEventTimelines } from "@/lib/admin/invalidate-admin-event-timelines";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { NoteLinkedRecordsPicker } from "@/components/admin/NoteLinkedRecordsPicker";
import { useCreateEvent, useUpdateEvent } from "@/hooks/useAdminEvents";
import { selectClassName } from "@/components/data-viewer/constants";
import { ApiError } from "@/lib/infra/api";

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseMediaIdsCsv(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

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

  const [dateSpecifier, setDateSpecifier] = useState(defaults.dateSpecifier);
  const [dateOriginal, setDateOriginal] = useState(defaults.dateOriginal);
  const [y, setY] = useState(defaults.y);
  const [m, setM] = useState(defaults.m);
  const [d, setD] = useState(defaults.d);
  const [ey, setEy] = useState(defaults.ey);
  const [em, setEm] = useState(defaults.em);
  const [ed, setEd] = useState(defaults.ed);

  const [placeName, setPlaceName] = useState(defaults.placeName);
  const [placeCounty, setPlaceCounty] = useState(defaults.placeCounty);
  const [placeState, setPlaceState] = useState(defaults.placeState);
  const [placeCountry, setPlaceCountry] = useState(defaults.placeCountry);
  const [placeOriginal, setPlaceOriginal] = useState(defaults.placeOriginal);
  const [placeLat, setPlaceLat] = useState(defaults.placeLat);
  const [placeLng, setPlaceLng] = useState(defaults.placeLng);

  const [selectedLinks, setSelectedLinks] = useState<SelectedNoteLink[]>(defaults.selectedLinks);
  const [mediaIdsCsv, setMediaIdsCsv] = useState(defaults.mediaIdsCsv);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const isPending = createEvent.isPending || updateEvent.isPending;
  const err = createEvent.error ?? updateEvent.error;
  const errMsg = err?.message;
  const errStatus = err instanceof ApiError ? err.status : undefined;

  const showRange = gedcomDateSpecifierNeedsRange(dateSpecifier);
  const resolvedEventType =
    eventTypeChoice === EVENT_FORM_CUSTOM_TAG ? customEventTag.trim().toUpperCase() : eventTypeChoice;

  const buildDatePayload = (): Record<string, unknown> | undefined => {
    const year = parseYm(y);
    const month = parseYm(m);
    const day = parseYm(d);
    const endYear = parseYm(ey);
    const endMonth = parseYm(em);
    const endDay = parseYm(ed);
    const orig = dateOriginal.trim();
    const isDefaultExact =
      dateSpecifier === "EXACT" &&
      !orig &&
      year == null &&
      month == null &&
      day == null &&
      endYear == null &&
      endMonth == null &&
      endDay == null;
    if (isDefaultExact) return undefined;
    return {
      dateType: dateSpecifier,
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
    const name = placeName.trim();
    const county = placeCounty.trim();
    const state = placeState.trim();
    const country = placeCountry.trim();
    const original = placeOriginal.trim();
    const lat = placeLat.trim();
    const lng = placeLng.trim();
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

  const title = mode === "create" ? "New event" : "Edit event";
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

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        {errMsg ? (
          <p className="text-sm text-destructive">
            {errMsg}
            {errStatus != null ? ` (${errStatus})` : ""}
          </p>
        ) : null}

        <section className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/20 p-4">
          <h2 className="text-sm font-semibold text-base-content">Event type</h2>
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
                className="font-mono uppercase max-w-md"
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
        </section>

        <section className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/20 p-4">
          <h2 className="text-sm font-semibold text-base-content">Date</h2>
          <p className="text-xs text-muted-foreground">
            Defaults to exact; change the specifier for about, before/after, or ranges. Clear all fields to remove the
            date on save.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date-specifier">Specifier</Label>
              <select
                id="date-specifier"
                className={selectClassName}
                value={dateSpecifier}
                onChange={(e) => setDateSpecifier(e.target.value)}
              >
                {GEDCOM_DATE_SPECIFIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="date-original">Original text (optional)</Label>
              <Input
                id="date-original"
                value={dateOriginal}
                onChange={(e) => setDateOriginal(e.target.value)}
                placeholder="e.g. ABT 1900 or BET 1900 AND 1910"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date-y">Year</Label>
              <Input id="date-y" inputMode="numeric" value={y} onChange={(e) => setY(e.target.value)} placeholder="e.g. 1924" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-m">Month</Label>
              <Input id="date-m" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} placeholder="1–12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-d">Day</Label>
              <Input id="date-d" inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} placeholder="1–31" />
            </div>
          </div>
          {showRange ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">End of range</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="date-ey">End year</Label>
                  <Input id="date-ey" inputMode="numeric" value={ey} onChange={(e) => setEy(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-em">End month</Label>
                  <Input id="date-em" inputMode="numeric" value={em} onChange={(e) => setEm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-ed">End day</Label>
                  <Input id="date-ed" inputMode="numeric" value={ed} onChange={(e) => setEd(e.target.value)} />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/20 p-4">
          <h2 className="text-sm font-semibold text-base-content">Place</h2>
          <p className="text-xs text-muted-foreground">Structured fields map to the place record; clear all to remove on save.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-city">City / locality</Label>
              <Input id="place-city" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-county">County</Label>
              <Input id="place-county" value={placeCounty} onChange={(e) => setPlaceCounty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-state">State / province</Label>
              <Input id="place-state" value={placeState} onChange={(e) => setPlaceState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-country">Country</Label>
              <Input id="place-country" value={placeCountry} onChange={(e) => setPlaceCountry(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-original">Full place text (optional)</Label>
            <Input
              id="place-original"
              value={placeOriginal}
              onChange={(e) => setPlaceOriginal(e.target.value)}
              placeholder="Overrides composed line for storage / hash when provided"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="place-lat">Latitude</Label>
              <Input id="place-lat" value={placeLat} onChange={(e) => setPlaceLat(e.target.value)} placeholder="decimal" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="place-lng">Longitude</Label>
              <Input id="place-lng" value={placeLng} onChange={(e) => setPlaceLng(e.target.value)} placeholder="decimal" />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/20 p-4">
          <h2 className="text-sm font-semibold text-base-content">Other details</h2>
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
        </section>

        <NoteLinkedRecordsPicker
          value={selectedLinks}
          onChange={setSelectedLinks}
          allowedLinkKinds={["individual", "family"]}
          linkingHint="Link this event to one or more individuals and/or families. Each search block is independent; pick a row to attach. You can leave this empty."
        />

        <section className="space-y-3 rounded-lg border border-base-content/12 bg-base-200/20 p-4">
          <h2 className="text-sm font-semibold text-base-content">Media</h2>
          <p className="text-xs text-muted-foreground">
            Optional: paste UUIDs of media records in this tree (from the Media list or a media detail URL),
            separated by commas or spaces. On edit, saving replaces the full set; leave empty to remove all links.
          </p>
          <div className="space-y-2">
            <Label htmlFor="event-media-ids">Linked media IDs</Label>
            <textarea
              id="event-media-ids"
              value={mediaIdsCsv}
              onChange={(e) => setMediaIdsCsv(e.target.value)}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono text-xs"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            />
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
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
