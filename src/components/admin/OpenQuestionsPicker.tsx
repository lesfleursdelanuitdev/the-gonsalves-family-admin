"use client";

import { useId, useMemo, useState } from "react";
import {
  useAdminOpenQuestions,
  type AdminOpenQuestionListItem,
} from "@/hooks/useAdminOpenQuestions";
import { NOTE_FULLTEXT_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { summarizeOpenQuestionLinks } from "@/lib/admin/open-question-display";
import { individualSearchDisplayName } from "@/lib/gedcom/individual-search-display";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { MediaPicker } from "@/components/admin/media-picker";
import { NotePicker } from "@/components/admin/NotePicker";
import { OpenQuestionStatusBadge } from "@/components/admin/OpenQuestionStatusBadge";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";
import { useAdminSources, type AdminSourceListItem } from "@/hooks/useAdminSources";
import type { AdminNoteListItem } from "@/hooks/useAdminNotes";
import { selectClassName } from "@/components/data-viewer/constants";

export type OpenQuestionsPickerMode =
  | "questionText"
  | "individual"
  | "family"
  | "event"
  | "media"
  | "source"
  | "note";

export type OpenQuestionsPickerProps = {
  selectedIds?: Set<string>;
  excludeIds?: Set<string>;
  onPick: (openQuestion: AdminOpenQuestionListItem) => void;
  limit?: number;
  idPrefix?: string;
  className?: string;
};

const MODE_OPTIONS: { value: OpenQuestionsPickerMode; label: string }[] = [
  { value: "questionText", label: "Question text" },
  { value: "individual", label: "Linked person" },
  { value: "family", label: "Linked family" },
  { value: "event", label: "Linked event" },
  { value: "media", label: "Linked media" },
  { value: "source", label: "Linked source" },
  { value: "note", label: "Linked note" },
];

export function OpenQuestionsPicker({
  selectedIds,
  excludeIds,
  onPick,
  limit = 15,
  idPrefix: idPrefixProp,
  className,
}: OpenQuestionsPickerProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `oqp-${auto}-`;

  const [statusFilter, setStatusFilter] = useState<"" | "open" | "resolved" | "archived">("");
  const [mode, setMode] = useState<OpenQuestionsPickerMode>("questionText");
  const [rawQuestionSearch, setRawQuestionSearch] = useState("");
  const debouncedQuestionSearch = useDebouncedValue(rawQuestionSearch.trim(), NOTE_FULLTEXT_DEBOUNCE_MS);

  const [pickedIndividualId, setPickedIndividualId] = useState<string | null>(null);
  const [pickedIndividualLabel, setPickedIndividualLabel] = useState<string | null>(null);
  const [pickedFamilyId, setPickedFamilyId] = useState<string | null>(null);
  const [pickedFamilyLabel, setPickedFamilyLabel] = useState<string | null>(null);
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const [pickedEventLabel, setPickedEventLabel] = useState<string | null>(null);
  const [pickedMediaId, setPickedMediaId] = useState<string | null>(null);
  const [pickedMediaLabel, setPickedMediaLabel] = useState<string | null>(null);
  const [pickedSourceId, setPickedSourceId] = useState<string | null>(null);
  const [pickedSourceLabel, setPickedSourceLabel] = useState<string | null>(null);
  const [rawSourceSearch, setRawSourceSearch] = useState("");
  const debouncedSourceSearch = useDebouncedValue(rawSourceSearch.trim(), NOTE_FULLTEXT_DEBOUNCE_MS);
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(null);
  const [pickedNoteLabel, setPickedNoteLabel] = useState<string | null>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");

  const listOpts = useMemo(() => {
    const textQ = debouncedQuestionSearch.length > 0 ? { q: debouncedQuestionSearch } : {};
    const base = {
      limit,
      offset: 0 as const,
      ...(statusFilter ? { status: statusFilter as "open" | "resolved" | "archived" } : {}),
      ...textQ,
    };
    if (mode === "questionText") {
      return { ...base };
    }
    if (mode === "individual" && pickedIndividualId) {
      return { ...base, linkedIndividualId: pickedIndividualId };
    }
    if (mode === "family" && pickedFamilyId) {
      return { ...base, linkedFamilyId: pickedFamilyId };
    }
    if (mode === "event" && pickedEventId) {
      return { ...base, linkedEventId: pickedEventId };
    }
    if (mode === "media" && pickedMediaId) {
      return { ...base, linkedMediaId: pickedMediaId };
    }
    if (mode === "source" && pickedSourceId) {
      return { ...base, linkedSourceId: pickedSourceId };
    }
    if (mode === "note" && pickedNoteId) {
      return { ...base, linkedNoteId: pickedNoteId };
    }
    return { ...base };
  }, [
    mode,
    limit,
    statusFilter,
    debouncedQuestionSearch,
    pickedIndividualId,
    pickedFamilyId,
    pickedEventId,
    pickedMediaId,
    pickedSourceId,
    pickedNoteId,
  ]);

  const sourceSearchEnabled = debouncedSourceSearch.length >= 1;
  const sourcesQuery = useAdminSources({
    q: sourceSearchEnabled ? debouncedSourceSearch : undefined,
    limit: 25,
    offset: 0,
  });

  const listEnabled = useMemo(() => {
    if (mode === "questionText") return true;
    if (mode === "individual") return Boolean(pickedIndividualId);
    if (mode === "family") return Boolean(pickedFamilyId);
    if (mode === "event") return Boolean(pickedEventId);
    if (mode === "media") return Boolean(pickedMediaId);
    if (mode === "source") return Boolean(pickedSourceId);
    if (mode === "note") return Boolean(pickedNoteId);
    return false;
  }, [mode, pickedIndividualId, pickedFamilyId, pickedEventId, pickedMediaId, pickedSourceId, pickedNoteId]);

  const listQuery = useAdminOpenQuestions(listOpts);

  const visibleRows = useMemo(() => {
    const xs = listQuery.data?.openQuestions ?? [];
    if (!excludeIds?.size) return xs;
    return xs.filter((row) => {
      const id = String((row as Record<string, unknown>).id ?? "");
      return !excludeIds.has(id);
    });
  }, [listQuery.data?.openQuestions, excludeIds]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor={`${p}status`}>Status</Label>
        <select
          id={`${p}status`}
          className={selectClassName}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="archived">Archived</option>
        </select>
        <p className="text-xs text-muted-foreground">Applied together with the text filter and lookup mode below.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${p}q`}>Question / details / resolution</Label>
        <Input
          id={`${p}q`}
          value={rawQuestionSearch}
          onChange={(e) => setRawQuestionSearch(e.target.value)}
          placeholder="Substring (optional) — case-insensitive; matches question, details, or resolution"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          In &quot;Question text&quot; mode, leave this empty to list by status only. In linked-record modes, use it to
          narrow results after you pick a person, family, event, etc.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Open question lookup mode">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={mode === opt.value}
            className={cn(
              buttonVariants({ variant: mode === opt.value ? "default" : "outline", size: "sm" }),
            )}
            onClick={() => setMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "questionText" ? (
        <p className="text-sm text-muted-foreground">
          Results use status and the text field above. Switch to another tab if you need to find questions linked to a
          specific record, then use the same text field to narrow further.
        </p>
      ) : null}

      {mode === "individual" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Find a person, then list open questions linked to them.</p>
          {pickedIndividualId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="font-medium">{pickedIndividualLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPickedIndividualId(null);
                  setPickedIndividualLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          <IndividualSearchPicker
            idPrefix={`${p}ind`}
            label="Find person"
            onPick={(ind: AdminIndividualListItem) => {
              setPickedIndividualId(ind.id);
              setPickedIndividualLabel(individualSearchDisplayName(ind));
            }}
          />
        </div>
      ) : null}

      {mode === "family" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Find a family, then list open questions linked to it.</p>
          {pickedFamilyId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="font-medium">{pickedFamilyLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPickedFamilyId(null);
                  setPickedFamilyLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          <FamilySearchPicker
            idPrefix={`${p}fam`}
            label="Find family"
            onPick={(fam: AdminFamilyListItem) => {
              setPickedFamilyId(fam.id);
              setPickedFamilyLabel(familyUnionPrimaryLine(fam) || fam.xref || fam.id);
            }}
          />
        </div>
      ) : null}

      {mode === "event" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Find an event, then list open questions linked to it.</p>
          {pickedEventId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="font-medium">{pickedEventLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPickedEventId(null);
                  setPickedEventLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          <EventPicker
            idPrefix={`${p}ev`}
            requireEventType={false}
            eventType={eventTypeFilter}
            onEventTypeChange={setEventTypeFilter}
            linkScope={eventLinkKind}
            onLinkScopeChange={setEventLinkKind}
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
            onPick={(ev: AdminEventListItem) => {
              setPickedEventId(ev.id);
              setPickedEventLabel(formatNoteEventPickerLabel(ev));
            }}
          />
        </div>
      ) : null}

      {mode === "source" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Find a source by title or author, then list open questions linked to it.
          </p>
          {pickedSourceId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="font-medium">{pickedSourceLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPickedSourceId(null);
                  setPickedSourceLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${p}src-q`}>Search sources</Label>
            <Input
              id={`${p}src-q`}
              value={rawSourceSearch}
              onChange={(e) => setRawSourceSearch(e.target.value)}
              placeholder="Title, author, or xref"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {!pickedSourceId ? (
            !sourceSearchEnabled ? (
              <p className="text-xs text-muted-foreground">Type at least one character to search sources.</p>
            ) : sourcesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                Searching…
              </div>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-base-content/10 p-2 text-sm">
                {(sourcesQuery.data?.sources ?? []).map((src: AdminSourceListItem) => {
                  const label = src.title?.trim() || src.xref?.trim() || src.id;
                  return (
                    <li key={src.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-base-content/[0.04]"
                        onClick={() => {
                          setPickedSourceId(src.id);
                          setPickedSourceLabel(label);
                        }}
                      >
                        <span className="min-w-0 truncate">{label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">Select</span>
                      </button>
                    </li>
                  );
                })}
                {(sourcesQuery.data?.sources ?? []).length === 0 ? (
                  <li className="px-2 py-4 text-center text-muted-foreground">No sources matched.</li>
                ) : null}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      {mode === "note" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Find a note by text, then list open questions linked to it.</p>
          {pickedNoteId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="line-clamp-2 font-medium">{pickedNoteLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  setPickedNoteId(null);
                  setPickedNoteLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : (
            <NotePicker
              idPrefix={`${p}nq`}
              onPick={(n: AdminNoteListItem) => {
                const preview = n.content.trim().replace(/\s+/g, " ").slice(0, 120);
                setPickedNoteId(n.id);
                setPickedNoteLabel(preview || n.xref?.trim() || n.id);
              }}
            />
          )}
        </div>
      ) : null}

      {mode === "media" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose a media record; then list open questions that reference it.
          </p>
          {pickedMediaId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-base-content/15 bg-base-content/[0.04] px-3 py-2 text-sm">
              <span className="text-muted-foreground">Filter:</span>
              <span className="font-medium">{pickedMediaLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setPickedMediaId(null);
                  setPickedMediaLabel(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : null}
          {/*
            `document` target: MediaPickerModal returns selection via `onAttach` without persisting a junction
            (same pattern as OpenQuestionForm linked media).
          */}
          <MediaPicker
            targetType="document"
            targetId="open-questions-picker"
            mode="single"
            allowedTypes={["photo", "document", "video", "audio"]}
            triggerLabel={pickedMediaId ? "Change media" : "Choose media"}
            triggerClassName="shrink-0"
            onAttach={(items) => {
              const m = items[0];
              if (!m) return;
              setPickedMediaId(m.id);
              setPickedMediaLabel(m.title?.trim() || m.fileRef || m.id);
            }}
          />
        </div>
      ) : null}

      {!listEnabled ? (
        <p className="text-xs text-muted-foreground">Choose a linked record filter to load questions.</p>
      ) : listQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          Loading open questions…
        </div>
      ) : listQuery.isError ? (
        <p className="text-sm text-destructive">
          {listQuery.error instanceof Error ? listQuery.error.message : "Request failed."}
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open questions matched.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {visibleRows.map((raw) => {
            const o = raw as Record<string, unknown>;
            const id = String(o.id ?? "");
            const question = String(o.question ?? "");
            const linked = summarizeOpenQuestionLinks(o);
            const isSelected = selectedIds?.has(id) ?? false;

            return (
              <li key={id} className="rounded-lg border border-base-content/12 bg-base-100/60 p-3 shadow-sm">
                <p className="mb-2 line-clamp-3 font-medium leading-snug text-base-content">{question || "—"}</p>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <OpenQuestionStatusBadge status={String(o.status ?? "open")} />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  <span className="font-medium text-base-content/80">Linked: </span>
                  {linked}
                </p>
                <Button type="button" size="sm" variant="secondary" disabled={isSelected} onClick={() => onPick(raw)}>
                  {isSelected ? "Added" : "Select"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
