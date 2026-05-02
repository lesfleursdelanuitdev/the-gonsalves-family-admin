"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import {
  EntityGedcomProfileMediaSection,
  type ProfileMediaSelectionShape,
} from "@/components/admin/EntityGedcomProfileMediaSection";
import { MediaPicker } from "@/components/admin/media-picker";
import { NoteLinkedRecordsPicker } from "@/components/admin/NoteLinkedRecordsPicker";
import { ADMIN_EVENTS_QUERY_KEY, useCreateEvent, useUpdateEvent } from "@/hooks/useAdminEvents";
import { selectClassName } from "@/components/data-viewer/constants";
import { ApiError } from "@/lib/infra/api";
import { eventPageDisplayTitle } from "@/lib/gedcom/event-page-title";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { PersonEditorLayout } from "@/components/admin/individual-editor/PersonEditorLayout";
import { PersonEditorMobileFormHeader } from "@/components/admin/individual-editor/PersonEditorMobileFormHeader";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { EVENT_EDITOR_NAV, type EventEditorSectionId } from "@/components/admin/event-editor/event-editor-nav";
import type { EventEditorAccordionKey } from "@/components/admin/event-editor/EventEditorResponsiveSection";
import { EventEditorResponsiveSection } from "@/components/admin/event-editor/EventEditorResponsiveSection";
import { EventEditorSidebarNav } from "@/components/admin/event-editor/EventEditorSidebarNav";
import { EventEditorMobileSectionSelect } from "@/components/admin/event-editor/EventEditorMobileSectionSelect";
import { EventEditorStickySaveBar } from "@/components/admin/event-editor/EventEditorStickySaveBar";
import {
  eventDateSummary,
  eventDetailsSummary,
  eventLinkedSummary,
  eventMediaSummary,
  eventPlaceSummary,
  eventTypeSummary,
} from "@/components/admin/event-editor/event-editor-summaries";

const FORM_ID = "admin-event-editor-form";

const HUMAN_PRESET_TYPES = [
  { value: "BIRT", label: "Birth" },
  { value: "DEAT", label: "Death" },
  { value: "MARR", label: "Marriage" },
  { value: "DIV", label: "Divorce" },
  { value: "RESI", label: "Residence" },
  { value: "OCCU", label: "Occupation" },
  { value: EVENT_FORM_CUSTOM_TAG, label: "Custom" },
] as const;

const SIMPLE_TAG_SET: Set<string> = new Set(
  HUMAN_PRESET_TYPES.filter((o) => o.value !== EVENT_FORM_CUSTOM_TAG).map((o) => o.value),
);

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseMediaIdsCsv(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function DisclosureToggle({ open, onClick, children }: { open: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="text-sm font-medium text-primary hover:text-primary/90" onClick={onClick}>
      {children}
      <span className="ml-1 text-primary/80" aria-hidden>
        {open ? "∧" : "∨"}
      </span>
    </button>
  );
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
  const isDesktop = useMediaQueryMinLg();

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

  const [showEventTechnical, setShowEventTechnical] = useState(false);
  const [showDateAdvanced, setShowDateAdvanced] = useState(false);
  const [showPlaceAdvanced, setShowPlaceAdvanced] = useState(false);
  const [showDetailsAdvanced, setShowDetailsAdvanced] = useState(false);
  const [showGedcomAdvanced, setShowGedcomAdvanced] = useState(false);

  const [activeSection, setActiveSection] = useState<EventEditorSectionId>("event-type");
  const [mobileExpanded, setMobileExpanded] = useState<EventEditorAccordionKey | null>("event-type");

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

  const humanTypeSelectValue = useMemo(() => {
    if (eventTypeChoice === EVENT_FORM_CUSTOM_TAG) return EVENT_FORM_CUSTOM_TAG;
    if (SIMPLE_TAG_SET.has(eventTypeChoice)) return eventTypeChoice;
    return EVENT_FORM_CUSTOM_TAG;
  }, [eventTypeChoice]);

  const onHumanTypeChange = (v: string) => {
    if (v === EVENT_FORM_CUSTOM_TAG) {
      setEventTypeChoice(EVENT_FORM_CUSTOM_TAG);
      setCustomEventTag((t) => (t.trim() ? t : "EVEN"));
    } else {
      setEventTypeChoice(v);
      setCustomEventTag("");
    }
  };

  const approximateDate =
    datePlace.dateSpecifier === "ABOUT" ||
    datePlace.dateSpecifier === "ABT" ||
    datePlace.dateSpecifier === "CALCULATED" ||
    datePlace.dateSpecifier === "CAL" ||
    datePlace.dateSpecifier === "ESTIMATED" ||
    datePlace.dateSpecifier === "EST";

  const onApproximateChange = (checked: boolean) => {
    setDatePlace((d) => ({
      ...d,
      dateSpecifier: checked ? "ABOUT" : "EXACT",
    }));
  };

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
        onSuccess: async () => {
          invalidateAdminEventTimelines(queryClient, timelineInvalidateTargets);
          await queryClient.invalidateQueries({ queryKey: ADMIN_EVENTS_QUERY_KEY });
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
    "Add a life event with optional details and links to people, families, and media.";

  const cancelHref = mode === "edit" && eventId ? `/admin/events/${eventId}` : "/admin/events";

  const goToSection = useCallback((id: EventEditorSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onMobileToggle = useCallback((key: EventEditorAccordionKey) => {
    setMobileExpanded((cur) => (cur === key ? null : key));
  }, []);

  useEffect(() => {
    if (!isDesktop || typeof IntersectionObserver === "undefined") return;
    const idList = EVENT_EDITOR_NAV.map((n) => n.id) as EventEditorSectionId[];
    const obs = new IntersectionObserver(
      (entries) => {
        let best: EventEditorSectionId | null = null;
        let bestRatio = 0;
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const id = ent.target.id as EventEditorSectionId;
          if (!idList.includes(id)) continue;
          if (ent.intersectionRatio > bestRatio) {
            bestRatio = ent.intersectionRatio;
            best = id;
          }
        }
        if (best != null && bestRatio >= 0.12) setActiveSection(best);
      },
      { root: null, rootMargin: "-10% 0px -45% 0px", threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] },
    );
    for (const id of idList) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [isDesktop]);

  const typeSummary = useMemo(
    () => eventTypeSummary({ eventTypeChoice, customEventTag, customType }),
    [eventTypeChoice, customEventTag, customType],
  );
  const dateSumm = useMemo(() => eventDateSummary(datePlace), [datePlace]);
  const placeSumm = useMemo(() => eventPlaceSummary(datePlace), [datePlace]);
  const detailsSumm = useMemo(() => eventDetailsSummary(value), [value]);
  const linkedSumm = useMemo(() => eventLinkedSummary(selectedLinks), [selectedLinks]);
  const mediaCountCsv = useMemo(() => parseMediaIdsCsv(mediaIdsCsv).length, [mediaIdsCsv]);
  const mediaDisplayCount = mode === "edit" ? eventMediaItems.length : mediaCountCsv;
  const mediaSumm = useMemo(() => eventMediaSummary(mediaDisplayCount), [mediaDisplayCount]);
  const advancedSumm = "GEDCOM tags, raw IDs, and full date/place editors";

  const desktopBackAndHeader = hideBackLink && isDesktop && (
    <header className="space-y-3 border-b border-base-content/10 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Link
            href="/admin/events"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to events
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          href="/admin/individuals"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-primary hover:text-primary/90")}
        >
          View tree
        </Link>
      </div>
    </header>
  );

  const typeBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-human-type">What happened?</Label>
        <select
          id="event-human-type"
          className={cn(selectClassName, "w-full max-w-md")}
          value={humanTypeSelectValue}
          onChange={(e) => onHumanTypeChange(e.target.value)}
        >
          {HUMAN_PRESET_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {eventTypeChoice === EVENT_FORM_CUSTOM_TAG ? (
        <div className="space-y-2">
          <Label htmlFor="event-custom-describe">
            {customEventTag.trim().toUpperCase() === "EVEN" || !customEventTag.trim()
              ? "Describe this event"
              : "Event description (optional)"}
          </Label>
          <Input
            id="event-custom-describe"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="e.g. Military service, graduation dinner…"
            className="max-w-xl"
          />
          {humanTypeSelectValue === EVENT_FORM_CUSTOM_TAG &&
          customEventTag.trim() &&
          customEventTag.trim().toUpperCase() !== "EVEN" ? (
            <p className="text-xs text-muted-foreground">
              Technical tag <span className="font-mono">{customEventTag.trim().toUpperCase()}</span> — adjust in
              advanced if needed.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <DisclosureToggle open={showEventTechnical} onClick={() => setShowEventTechnical((o) => !o)}>
          Show technical details (GEDCOM tag, TYPE)
        </DisclosureToggle>
        {showEventTechnical ? (
          <div className="mt-3 space-y-4 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-4">
            <div className="space-y-2">
              <Label htmlFor="event-type-gedcom">GEDCOM tag</Label>
              <select
                id="event-type-gedcom"
                className={cn(selectClassName, "w-full max-w-md font-mono uppercase")}
                value={eventTypeChoice}
                onChange={(e) => {
                  const v = e.target.value;
                  setEventTypeChoice(v);
                  if (v !== EVENT_FORM_CUSTOM_TAG) setCustomEventTag("");
                }}
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
                  placeholder="e.g. EVEN or _MILIT"
                  className="max-w-md font-mono uppercase"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="event-type-field">TYPE (optional)</Label>
              <Input
                id="event-type-field"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="GEDCOM TYPE / description"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const dateBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-date-simple">When did it happen?</Label>
        <Input
          id="event-date-simple"
          value={datePlace.dateOriginal}
          onChange={(e) => setDatePlace((d) => ({ ...d, dateOriginal: e.target.value }))}
          placeholder="e.g. 12 Mar 1980 or 1924"
          className="max-w-xl"
          autoComplete="off"
        />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox
          id="event-approx"
          checked={approximateDate}
          onCheckedChange={(v) => onApproximateChange(v === true)}
        />
        <Label htmlFor="event-approx" className="cursor-pointer font-normal leading-snug">
          Approximate date
        </Label>
      </div>
      <div>
        <DisclosureToggle open={showDateAdvanced} onClick={() => setShowDateAdvanced((o) => !o)}>
          Show advanced date options
        </DisclosureToggle>
        {showDateAdvanced ? (
          <div className="mt-3">
            <GedcomDateInput
              idPrefix="event-adv-"
              value={datePlace}
              onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
              eventStyleHints
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const placeBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-place-simple">Where did it happen?</Label>
        <Input
          id="event-place-simple"
          value={datePlace.placeOriginal}
          onChange={(e) => setDatePlace((d) => ({ ...d, placeOriginal: e.target.value }))}
          placeholder="e.g. Lisbon, Portugal"
          className="max-w-xl"
          autoComplete="off"
        />
      </div>
      <div>
        <DisclosureToggle open={showPlaceAdvanced} onClick={() => setShowPlaceAdvanced((o) => !o)}>
          Show advanced place options
        </DisclosureToggle>
        {showPlaceAdvanced ? (
          <div className="mt-3">
            <GedcomPlaceInput
              idPrefix="event-adv-"
              value={datePlace}
              onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
              eventStyleHints
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  const detailsBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-description">Additional details</Label>
        <textarea
          id="event-description"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          className="flex min-h-[120px] w-full max-w-2xl rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Add a description…"
        />
      </div>
      <div>
        <DisclosureToggle open={showDetailsAdvanced} onClick={() => setShowDetailsAdvanced((o) => !o)}>
          Show advanced fields
        </DisclosureToggle>
        {showDetailsAdvanced ? (
          <div className="mt-3 space-y-3 rounded-lg border border-base-content/10 bg-base-content/[0.02] p-4">
            <div className="space-y-2">
              <Label htmlFor="event-cause">Cause</Label>
              <Input id="event-cause" value={cause} onChange={(e) => setCause(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-agency">Agency</Label>
              <Input id="event-agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const linkedBody = (
    <div className="space-y-4">
      {selectedLinks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records linked yet.</p>
      ) : null}
      <NoteLinkedRecordsPicker
        value={selectedLinks}
        onChange={setSelectedLinks}
        allowedLinkKinds={["individual", "family"]}
        linkingHint="Search for a person or family, then pick a row to attach. Saving replaces all links for this event."
        addLinkButtonLabel="Add person or family"
        idleBuildersHint='No search open yet. Use "Add person or family" to link a record.'
      />
    </div>
  );

  const profileMediaSelection = (initialEvent?.profileMediaSelection ?? null) as ProfileMediaSelectionShape;

  const mediaBody = (
    <div className="space-y-4">
      {mode === "edit" && eventId ? (
        <EntityGedcomProfileMediaSection
          entity="event"
          entityId={eventId}
          heading="Event cover image"
          profileMediaSelection={profileMediaSelection}
          invalidateQueryKeys={[[...ADMIN_EVENTS_QUERY_KEY, "detail", eventId]]}
          emptyHint="No event cover image set."
          chooseTriggerLabel="Choose event cover image"
          onAfterMutation={() => {
            router.refresh();
          }}
        />
      ) : null}
      {mode === "edit" && eventId ? (
        <>
          {eventMediaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media added yet.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
              </p>
              <AssociatedMediaThumbnailGrid items={eventMediaItems} />
            </>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ViewAsAlbumLink
              entityType="event"
              entityId={eventId}
              label="View event media"
              count={eventMediaItems.length}
            />
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
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex min-h-11 items-center justify-center gap-2 border-dashed",
              )}
            >
              <Plus className="size-4" aria-hidden />
              Add media
            </Link>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Save the event first, then you can attach media from the archive.</p>
      )}
      {mode === "edit" && eventId ? (
        <CollapsibleFormSection title="Bulk media IDs (advanced)" defaultOpen={false}>
          <p className="text-xs text-muted-foreground">
            Comma- or space-separated media record UUIDs. On save, this list replaces all event–media links; leave empty
            to remove all.
          </p>
          <textarea
            id="event-media-ids"
            value={mediaIdsCsv}
            onChange={(e) => setMediaIdsCsv(e.target.value)}
            rows={3}
            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Optional — for power users"
          />
        </CollapsibleFormSection>
      ) : null}
    </div>
  );

  const advancedBody = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        GEDCOM and technical fields. Use this when you need precise tags, structured date/place, or bulk media IDs.
      </p>
      {!showGedcomAdvanced ? (
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowGedcomAdvanced(true)}>
          Show advanced details
        </Button>
      ) : (
        <div className="space-y-6">
          <CollapsibleFormSection title="Event type (GEDCOM)" defaultOpen>
            <div className="space-y-2">
              <Label>GEDCOM tag</Label>
              <select
                className={cn(selectClassName, "w-full max-w-md font-mono uppercase")}
                value={eventTypeChoice}
                onChange={(e) => {
                  const v = e.target.value;
                  setEventTypeChoice(v);
                  if (v !== EVENT_FORM_CUSTOM_TAG) setCustomEventTag("");
                }}
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
                <Label htmlFor="adv-custom-tag">Custom tag</Label>
                <Input
                  id="adv-custom-tag"
                  value={customEventTag}
                  onChange={(e) => setCustomEventTag(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="adv-type">TYPE</Label>
              <Input id="adv-type" value={customType} onChange={(e) => setCustomType(e.target.value)} />
            </div>
          </CollapsibleFormSection>
          <CollapsibleFormSection title="Full date editor" defaultOpen={false}>
            <GedcomDateInput
              idPrefix="event-full-"
              value={datePlace}
              onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
              eventStyleHints
            />
          </CollapsibleFormSection>
          <CollapsibleFormSection title="Full place editor" defaultOpen={false}>
            <GedcomPlaceInput
              idPrefix="event-full-"
              value={datePlace}
              onChange={(patch) => setDatePlace({ ...datePlace, ...patch })}
              eventStyleHints
            />
          </CollapsibleFormSection>
          <CollapsibleFormSection title="Cause and agency" defaultOpen={false}>
            <div className="space-y-2">
              <Label>Cause</Label>
              <Input value={cause} onChange={(e) => setCause(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Agency</Label>
              <Input value={agency} onChange={(e) => setAgency(e.target.value)} />
            </div>
          </CollapsibleFormSection>
          {mode === "edit" && eventId ? (
            <div className="space-y-2">
              <Label>Event id</Label>
              <p className="font-mono text-xs text-muted-foreground">{eventId}</p>
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowGedcomAdvanced(false)}>
            Hide advanced details
          </Button>
        </div>
      )}
    </div>
  );

  const allSections = (desktop: boolean) => (
    <>
      <EventEditorResponsiveSection
        id="event-type"
        sectionKey="event-type"
        title="1. Event type"
        description="What happened?"
        icon={EVENT_EDITOR_NAV[0]!.icon}
        summary={typeSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {typeBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-date"
        sectionKey="event-date"
        title="2. Date"
        description="When did it happen?"
        icon={EVENT_EDITOR_NAV[1]!.icon}
        summary={dateSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {dateBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-place"
        sectionKey="event-place"
        title="3. Place"
        description="Where did it happen?"
        icon={EVENT_EDITOR_NAV[2]!.icon}
        summary={placeSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {placeBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-details"
        sectionKey="event-details"
        title="4. Details"
        description="Additional details about this event."
        icon={EVENT_EDITOR_NAV[3]!.icon}
        summary={detailsSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {detailsBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-linked"
        sectionKey="event-linked"
        title="5. Linked records"
        description="Link this event to individuals or families."
        icon={EVENT_EDITOR_NAV[4]!.icon}
        summary={linkedSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {linkedBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-media"
        sectionKey="event-media"
        title="6. Media"
        description="Photos or documents for this event."
        icon={EVENT_EDITOR_NAV[5]!.icon}
        summary={mediaSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {mediaBody}
      </EventEditorResponsiveSection>
      <EventEditorResponsiveSection
        id="event-advanced"
        sectionKey="event-advanced"
        title="7. Advanced details"
        description="GEDCOM and technical fields."
        icon={EVENT_EDITOR_NAV[6]!.icon}
        summary={advancedSumm}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {advancedBody}
      </EventEditorResponsiveSection>
    </>
  );

  return (
    <div className="w-full space-y-6 pb-32">
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
      ) : null}

      {desktopBackAndHeader}

      <form id={FORM_ID} onSubmit={handleSubmit} className="w-full space-y-6">
        {errMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
            {errStatus != null ? ` (${errStatus})` : ""}
          </p>
        ) : null}

        {hideBackLink && !isDesktop ? (
          <div className="space-y-3">
            <PersonEditorMobileFormHeader title={title} backHref="/admin/events" treeHref="/admin/individuals" />
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        ) : null}

        {isDesktop ? (
          <PersonEditorLayout
            mobileNav={
              <EventEditorMobileSectionSelect items={EVENT_EDITOR_NAV} value={activeSection} onChange={goToSection} />
            }
            sidebar={
              <EventEditorSidebarNav items={EVENT_EDITOR_NAV} activeId={activeSection} onSelect={goToSection} />
            }
          >
            {allSections(true)}
          </PersonEditorLayout>
        ) : (
          <div className="space-y-3">{allSections(false)}</div>
        )}

        {!hideBackLink ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={cancelHref} className={cn(buttonVariants({ variant: "outline" }))}>
              Cancel
            </Link>
            <Button type="submit" disabled={isPending || !resolvedEventType}>
              {isPending ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create event" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </form>

      {hideBackLink ? (
        <EventEditorStickySaveBar mode={mode} pending={isPending} cancelHref={cancelHref} formId={FORM_ID} />
      ) : null}
    </div>
  );
}
