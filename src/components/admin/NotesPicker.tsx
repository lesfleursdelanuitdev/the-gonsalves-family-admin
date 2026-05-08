"use client";

import { useId, useMemo, useState } from "react";
import { useAdminNotes, type AdminNoteListItem } from "@/hooks/useAdminNotes";
import { NOTE_FULLTEXT_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { notePickerContentPreviewLines } from "@/lib/admin/note-picker-preview";
import { notePickerLinkedBlocks } from "@/lib/admin/note-picker-linked-summary";
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
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";
import type { AdminFamilyListItem } from "@/hooks/useAdminFamilies";
import type { AdminEventListItem } from "@/hooks/useAdminEvents";

export type NotesPickerMode = "search" | "xref" | "individual" | "family" | "event";

export type NotesPickerProps = {
  selectedIds?: Set<string>;
  excludeIds?: Set<string>;
  onPick: (note: AdminNoteListItem) => void;
  limit?: number;
  idPrefix?: string;
  className?: string;
};

const MODE_OPTIONS: { value: NotesPickerMode; label: string }[] = [
  { value: "search", label: "Search text" },
  { value: "xref", label: "XREF" },
  { value: "individual", label: "Linked person" },
  { value: "family", label: "Linked family" },
  { value: "event", label: "Linked event" },
];

export function NotesPicker({
  selectedIds,
  excludeIds,
  onPick,
  limit = 15,
  idPrefix: idPrefixProp,
  className,
}: NotesPickerProps) {
  const auto = useId().replace(/:/g, "");
  const p = idPrefixProp ?? `nsp-${auto}-`;

  const [mode, setMode] = useState<NotesPickerMode>("search");
  const [rawSearch, setRawSearch] = useState("");
  const [rawXref, setRawXref] = useState("");
  const debouncedSearch = useDebouncedValue(rawSearch.trim(), NOTE_FULLTEXT_DEBOUNCE_MS);
  const debouncedXref = useDebouncedValue(rawXref.trim(), NOTE_FULLTEXT_DEBOUNCE_MS);

  const [pickedIndividualId, setPickedIndividualId] = useState<string | null>(null);
  const [pickedIndividualLabel, setPickedIndividualLabel] = useState<string | null>(null);
  const [pickedFamilyId, setPickedFamilyId] = useState<string | null>(null);
  const [pickedFamilyLabel, setPickedFamilyLabel] = useState<string | null>(null);
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const [pickedEventLabel, setPickedEventLabel] = useState<string | null>(null);

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");

  const listOpts = useMemo(() => {
    const base = { limit, offset: 0 } as const;
    if (mode === "search" && debouncedSearch.length >= 2) {
      return { ...base, q: debouncedSearch };
    }
    if (mode === "xref" && debouncedXref.length >= 1) {
      return { ...base, q: debouncedXref };
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
    return { ...base };
  }, [
    mode,
    limit,
    debouncedSearch,
    debouncedXref,
    pickedIndividualId,
    pickedFamilyId,
    pickedEventId,
  ]);

  const listEnabled = useMemo(() => {
    if (mode === "search") return debouncedSearch.length >= 2;
    if (mode === "xref") return debouncedXref.length >= 1;
    if (mode === "individual") return !!pickedIndividualId;
    if (mode === "family") return !!pickedFamilyId;
    if (mode === "event") return !!pickedEventId;
    return false;
  }, [mode, debouncedSearch, debouncedXref, pickedIndividualId, pickedFamilyId, pickedEventId]);

  const listQuery = useAdminNotes(listOpts, { enabled: listEnabled });

  const visibleNotes = useMemo(() => {
    const xs = listQuery.data?.notes ?? [];
    if (!excludeIds?.size) return xs;
    return xs.filter((n) => !excludeIds.has(n.id));
  }, [listQuery.data?.notes, excludeIds]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Note lookup mode">
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

      {mode === "search" ? (
        <div className="space-y-2">
          <Label htmlFor={`${p}search`}>Search note text</Label>
          <Input
            id={`${p}search`}
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder='e.g. madeira migration "sugar estate"'
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            PostgreSQL full-text on note content (words in any order, quoted phrases).
          </p>
        </div>
      ) : null}

      {mode === "xref" ? (
        <div className="space-y-2">
          <Label htmlFor={`${p}xref`}>Note XREF</Label>
          <Input
            id={`${p}xref`}
            value={rawXref}
            onChange={(e) => setRawXref(e.target.value)}
            placeholder="e.g. N12"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Matches note <code className="rounded bg-base-300/50 px-1">xref</code> (substring, case-insensitive) via the
            same search endpoint as text.
          </p>
        </div>
      ) : null}

      {mode === "individual" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Find a person, then list notes linked to that individual.
          </p>
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
          <p className="text-sm text-muted-foreground">
            Find a family, then list notes linked to that family.
          </p>
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
          <p className="text-sm text-muted-foreground">
            Find an event, then list notes linked to that event.
          </p>
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

      {!listEnabled ? (
        <p className="text-xs text-muted-foreground">
          {mode === "search"
            ? "Type at least 2 characters to search."
            : mode === "xref"
              ? "Type at least 1 character to match XREF."
              : mode === "individual"
                ? "Pick a person to load linked notes."
                : mode === "family"
                  ? "Pick a family to load linked notes."
                  : "Pick an event to load linked notes."}
        </p>
      ) : listQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
          Loading notes…
        </div>
      ) : listQuery.isError ? (
        <p className="text-sm text-destructive">
          {listQuery.error instanceof Error ? listQuery.error.message : "Request failed."}
        </p>
      ) : visibleNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes matched.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {visibleNotes.map((note) => {
            const preview = notePickerContentPreviewLines(note.content, 3, 180);
            const blocks = notePickerLinkedBlocks(note);
            const isSelected = selectedIds?.has(note.id) ?? false;

            return (
              <li
                key={note.id}
                className="rounded-lg border border-base-content/12 bg-base-100/60 p-3 shadow-sm"
              >
                <pre className="mb-2 max-h-28 overflow-hidden whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-base-content/90">
                  {preview || "(empty note)"}
                </pre>

                {blocks.length > 0 ? (
                  <div className="mb-2 space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-medium text-base-content/80">Linked to</p>
                    {blocks.map((b) => (
                      <div key={b.heading}>
                        <span className="font-medium text-muted-foreground">{b.heading}: </span>
                        <span>
                          {b.lines.join("; ")}
                          {b.overflow ? <span className="text-base-content/70"> +{b.overflow}</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-2 text-xs italic text-muted-foreground">Not linked to records yet.</p>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isSelected}
                  onClick={() => onPick(note)}
                >
                  {isSelected ? "Added" : "Add note"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
