"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type LucideIcon, Eye, FileText, Link2, ListTree, User, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { NotesPicker } from "@/components/admin/NotesPicker";
import { Timeline } from "@/components/admin/timeline/Timeline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAdminFamilyEvents } from "@/hooks/useAdminFamilyEvents";
import { useAdminIndividualEvents } from "@/hooks/useAdminIndividuals";
import { useAdminNoteEvents } from "@/hooks/useAdminNoteEvents";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { sortEventsChronologically } from "@/lib/timeline/timeline-chronology";
import type { TimelineSubject } from "@/lib/timeline/timeline-friendly-description";
import {
  canonicalTimelineSearchString,
  parseTimelineUrlState,
  serializeTimelineUrlState,
  type TimelineChromeOnly,
  type TimelineScope,
  type TimelineUrlState,
} from "@/lib/timeline/timeline-url-state";
import { cn } from "@/lib/utils";

function chromeFromParsed(parsed: TimelineUrlState): TimelineChromeOnly {
  return {
    viewMode: parsed.viewMode,
    orient: parsed.orient,
    activeView: parsed.activeView,
    anim: parsed.anim,
    vStyle: parsed.vStyle,
    hStyle: parsed.hStyle,
    heightPx: parsed.heightPx,
    widthPx: parsed.widthPx,
    widthPct: parsed.widthPct,
    previewWidthUnit: parsed.previewWidthUnit,
    pag: parsed.pag,
    perPage: parsed.perPage,
    page: parsed.page,
    autoplayPxPerSec: parsed.autoplayPxPerSec,
    autoplayLoop: parsed.autoplayLoop,
    showImages: parsed.showImages,
    animRevealMinRatio: parsed.animRevealMinRatio,
    renderer: parsed.renderer,
    perCol: parsed.perCol,
    numColumns: parsed.numColumns,
    columnChunkMode: parsed.columnChunkMode,
    cardWidthPx: parsed.cardWidthPx,
    gapPx: parsed.gapPx,
    showArrows: parsed.showArrows,
  };
}

function scopeLabel(s: TimelineScope): string {
  if (s === "individual") return "Person";
  if (s === "family") return "Family";
  return "Note";
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

function EventsFetchProgress() {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15"
      role="progressbar"
      aria-valuetext="Loading events"
    >
      <div className="absolute inset-y-0 left-0 w-[34%] rounded-full bg-primary admin-timeline-events-progress-thumb" />
    </div>
  );
}

export function TimelineCreator() {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/timelines";
  const searchParams = useSearchParams();
  const urlHydratedRef = useRef(false);

  const [scope, setScope] = useState<TimelineScope | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityLabel, setEntityLabel] = useState("");
  const [chrome, setChrome] = useState<TimelineChromeOnly>(() =>
    chromeFromParsed(parseTimelineUrlState(new URLSearchParams())),
  );
  /** When false and `entityId` is set, search UI is hidden; summary + “Change” stays visible. */
  const [pickerExpanded, setPickerExpanded] = useState(true);

  /** Apply URL → local state before paint so URL-sync effect sees matching state. */
  useLayoutEffect(() => {
    const next = parseTimelineUrlState(new URLSearchParams(searchParams.toString()));
    // Sync client state from Next searchParams (external URL); batch updates are intentional.
    /* eslint-disable react-hooks/set-state-in-effect -- URL is the source of truth for deep links */
    setScope(next.scope);
    setEntityId(next.entityId);
    setChrome(chromeFromParsed(next));
    setPickerExpanded(!next.entityId);
    /* eslint-enable react-hooks/set-state-in-effect */
    urlHydratedRef.current = true;
  }, [searchParams]);

  const replaceQuery = useCallback(
    (state: TimelineUrlState) => {
      router.replace(`${pathname}${serializeTimelineUrlState(state)}`, { scroll: false });
    },
    [pathname, router],
  );

  /** Local state → URL (never call `router.replace` inside a `setState` updater). */
  useEffect(() => {
    if (!urlHydratedRef.current) return;
    const nextQs = serializeTimelineUrlState({ scope, entityId, ...chrome });
    const curCanon = canonicalTimelineSearchString(searchParams.toString());
    const nextCanon = canonicalTimelineSearchString(nextQs);
    if (curCanon === nextCanon) return;
    replaceQuery({ scope, entityId, ...chrome });
  }, [chrome, entityId, replaceQuery, scope, searchParams]);

  const onChromeChange = useCallback((patch: Partial<TimelineChromeOnly>) => {
    setChrome((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelection = useCallback((s: TimelineScope, id: string, label: string) => {
    setScope(s);
    setEntityId(id);
    setEntityLabel(label);
    setChrome((c) => ({ ...c, page: 0 }));
  }, []);

  const applySelection = useCallback((s: TimelineScope, id: string, label: string) => {
    setSelection(s, id, label);
    setPickerExpanded(false);
  }, [setSelection]);

  const clearSelection = useCallback(() => {
    const empty = parseTimelineUrlState(new URLSearchParams());
    setScope(null);
    setEntityId(null);
    setEntityLabel("");
    setChrome(chromeFromParsed(empty));
    setPickerExpanded(true);
  }, []);

  const indEvents = useAdminIndividualEvents(entityId ?? "", { enabled: scope === "individual" && !!entityId });
  const famEvents = useAdminFamilyEvents(entityId ?? "", { enabled: scope === "family" && !!entityId });
  const noteEvents = useAdminNoteEvents(entityId ?? "", { enabled: scope === "note" && !!entityId });

  const rawEvents: IndividualDetailEvent[] = useMemo(() => {
    if (scope === "individual" && entityId) return indEvents.data?.events ?? [];
    if (scope === "family" && entityId) return famEvents.data?.events ?? [];
    if (scope === "note" && entityId) return noteEvents.data?.events ?? [];
    return [];
  }, [scope, entityId, indEvents.data?.events, famEvents.data?.events, noteEvents.data?.events]);

  const sortedEvents = useMemo(() => sortEventsChronologically(rawEvents), [rawEvents]);

  const hasAnyPreviewMedia = useMemo(
    () => sortedEvents.some((ev) => Boolean(ev.previewMediaFileRef?.trim())),
    [sortedEvents],
  );

  useEffect(() => {
    if (!hasAnyPreviewMedia && chrome.showImages) {
      setChrome((c) => ({ ...c, showImages: false }));
    }
  }, [hasAnyPreviewMedia, chrome.showImages]);

  const timelineSubject = useMemo((): TimelineSubject => {
    if (scope === "individual" && entityId) {
      return (
        indEvents.data?.timelineSubject ?? {
          kind: "individual",
          displayName: entityLabel.trim() || "Unknown",
          sex: null,
        }
      );
    }
    if (scope === "family" && entityId) {
      return (
        famEvents.data?.timelineSubject ?? {
          kind: "family",
          husbandName: null,
          wifeName: null,
          husbandSex: null,
          wifeSex: null,
        }
      );
    }
    if (scope === "note" && entityId) {
      return noteEvents.data?.timelineSubject ?? { kind: "none" };
    }
    return { kind: "none" };
  }, [
    scope,
    entityId,
    entityLabel,
    indEvents.data?.timelineSubject,
    famEvents.data?.timelineSubject,
    noteEvents.data?.timelineSubject,
  ]);

  const eventsLoading =
    (scope === "individual" && !!entityId && (indEvents.isLoading || indEvents.isFetching)) ||
    (scope === "family" && !!entityId && (famEvents.isLoading || famEvents.isFetching)) ||
    (scope === "note" && !!entityId && (noteEvents.isLoading || noteEvents.isFetching));

  const err =
    (scope === "individual" && entityId && indEvents.error?.message) ||
    (scope === "family" && entityId && famEvents.error?.message) ||
    (scope === "note" && entityId && noteEvents.error?.message) ||
    null;

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only origin for copyable absolute URL */
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const deepLink = useMemo(() => {
    const qs = serializeTimelineUrlState({ scope, entityId, ...chrome });
    if (!origin) return `${pathname}${qs}`;
    return `${origin}${pathname}${qs}`;
  }, [scope, entityId, chrome, pathname, origin]);

  const noteSelectedIds = useMemo(() => {
    if (scope === "note" && entityId) return new Set([entityId]);
    return undefined;
  }, [scope, entityId]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <Card
        className={cn(
          "border-base-content/[0.12] bg-base-content/[0.04] shadow-sm",
          "hover:border-base-content/[0.16] hover:bg-base-content/[0.055] hover:shadow-md",
        )}
      >
        <CardHeader className="space-y-0 pb-4">
          <SectionHeading
            icon={ListTree}
            title="What to chart"
            description="Pick a scope, then search and select one record."
            actions={
              entityId && pickerExpanded ? (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPickerExpanded(false)}>
                  <X className="size-4" aria-hidden />
                  Close picker
                </Button>
              ) : entityId && !pickerExpanded ? (
                <Button type="button" variant="default" size="sm" onClick={() => setPickerExpanded(true)}>
                  Change selection
                </Button>
              ) : null
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {entityId && scope && !pickerExpanded ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-base-content/10 bg-base-content/[0.04] px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                {scope === "individual" ? (
                  <User className="size-5" aria-hidden />
                ) : scope === "family" ? (
                  <Users className="size-5" aria-hidden />
                ) : (
                  <FileText className="size-5" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected</p>
                <p className="truncate text-sm font-semibold text-foreground">{entityLabel || entityId}</p>
                <p className="font-mono text-xs text-muted-foreground">{scopeLabel(scope)} · {entityId}</p>
              </div>
            </div>
          ) : null}

          {pickerExpanded || !entityId ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(["individual", "family", "note"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={scope === s ? "default" : "outline"}
                    onClick={() => {
                      setScope(s);
                      setEntityId(null);
                      setEntityLabel("");
                      setChrome((c) => ({ ...c, page: 0 }));
                      setPickerExpanded(true);
                    }}
                  >
                    {scopeLabel(s)}
                  </Button>
                ))}
              </div>

              {scope ? (
                <div className="space-y-3">
                  {entityId ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Selected:</span>
                      <span className="font-medium">{entityLabel || entityId}</span>
                      <span className="font-mono text-xs text-muted-foreground">{entityId}</span>
                      <button
                        type="button"
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto h-8")}
                        onClick={clearSelection}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Search below and pick a row to load events.</p>
                  )}

                  {scope === "individual" ? (
                    <div className="space-y-2">
                      <Label>Person</Label>
                      <IndividualSearchPicker
                        idPrefix="timeline-ind"
                        onPick={(ind: AdminIndividualListItem) => {
                          const label = ind.fullName?.trim() || ind.xref || ind.id;
                          applySelection("individual", ind.id, label);
                        }}
                      />
                    </div>
                  ) : null}
                  {scope === "family" ? (
                    <div className="space-y-2">
                      <Label>Family</Label>
                      <FamilySearchPicker
                        idPrefix="timeline-fam"
                        onPick={(fam: AdminFamilyListItem) => {
                          applySelection("family", fam.id, fam.xref || fam.id);
                        }}
                      />
                    </div>
                  ) : null}
                  {scope === "note" ? (
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <NotesPicker
                        idPrefix="timeline-note"
                        selectedIds={noteSelectedIds}
                        onPick={(note: AdminNoteListItem) => {
                          const label = note.xref?.trim() || note.id;
                          applySelection("note", note.id, label);
                        }}
                        limit={12}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select Person, Family, or Note above.</p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {scope && entityId ? (
        <Card
          className={cn(
            "border-base-content/[0.12] bg-base-content/[0.04] shadow-sm",
            "hover:border-base-content/[0.16] hover:bg-base-content/[0.055] hover:shadow-md",
          )}
        >
          <CardHeader className="space-y-3 pb-2">
            <SectionHeading
              icon={Eye}
              title="Preview"
              description="Chronological GEDCOM events linked to this record."
            />
            {eventsLoading ? <EventsFetchProgress /> : null}
          </CardHeader>
          <CardContent className="min-w-0">
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground">Loading events…</p>
            ) : err ? (
              <p className="text-sm text-destructive">{err}</p>
            ) : sortedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events linked to this record.</p>
            ) : (
              <div className="min-w-0 pt-1">
                <p className="mb-3 text-xs text-muted-foreground">
                  {sortedEvents.length} event{sortedEvents.length === 1 ? "" : "s"} · chronological order
                </p>
                <Timeline
                  events={sortedEvents}
                  chrome={chrome}
                  onChromeChange={onChromeChange}
                  timelineSubject={timelineSubject}
                  hasAnyPreviewMedia={hasAnyPreviewMedia}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card
        className={cn(
          "border-base-content/[0.12] bg-base-content/[0.04] shadow-sm",
          "hover:border-base-content/[0.16] hover:bg-base-content/[0.055] hover:shadow-md",
        )}
      >
        <CardHeader className="pb-2">
          <SectionHeading
            icon={Link2}
            title="Deep link"
            description="Copy this URL to reopen the same entity and layout. Query params use entityType (individual, family, or note) and entityUuid (record id)."
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={deepLink}
            />
            <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(deepLink)}>
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
