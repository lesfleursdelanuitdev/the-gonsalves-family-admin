"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
  StoryBlockDesign,
  StoryBlockRowAlignment,
  StoryBlockRowLayout,
  StoryBlockWidthMode,
  StoryBlockWidthUnit,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlock,
  StoryContainerBlockProps,
  StoryAuthorCredit,
  StoryDocument,
  StoryDocumentKind,
  StoryLinkedPlace,
  StoryBlockTextPlacement,
  StoryDocumentMetaPatch,
  StoryEmbedBlock,
  StoryEmbedHeightPreset,
  StoryEmbedLayoutAlign,
  StoryEmbedLinkMode,
  StoryEmbedWidthPreset,
  StoryGeneralEmbedKind,
  StoryImageMediaRef,
  StoryMediaBlock,
  StoryRichTextBlock,
  StoryDividerBlock,
  StoryDividerVariant,
  StoryRichTextTextPreset,
  StoryContainerPreset,
} from "@/lib/admin/story-creator/story-types";
import { getStoryDividerPreset, getStoryRichTextPreset } from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";
import { normalizeStorySlugInput, normalizeStorySlugInputLive, slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { fetchJson } from "@/lib/infra/api";
import { legacyCoverImageRef } from "@/lib/admin/story-creator/story-images-resolve";
import { formatPlaceSuggestionLabel, type AdminPlaceSuggestionRow } from "@/lib/forms/admin-place-suggestions";
import { StoryPlaceSearchPicker } from "@/components/admin/story-creator/StoryPlaceSearchPicker";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import {
  effectiveContainerRowLayout,
  effectiveRowLayout,
  effectiveRowLayoutForRichText,
  mergeStoryRowLayout,
} from "@/lib/admin/story-creator/story-block-layout";
import { standaloneMediaEmbedLayoutPatch } from "@/lib/admin/story-creator/story-media-embed-layout-sync";
import { STORY_TEXT_PLACEMENT_OPTIONS } from "@/lib/admin/story-creator/story-block-text-layout";
import type { StoryDividerMetaPatch, StoryRichTextMetaPatch } from "@/lib/admin/story-creator/story-doc-mutators";
import {
  normalizeColumnWidthPercents,
  resolveColumnGapRem,
  resolveColumnStackGapRem,
  resolveColumnStackJustify,
  resolveColumnWidthPercents,
  STORY_COLUMN_STACK_GAP_PRESETS,
  STORY_COLUMN_STACK_JUSTIFY_PRESETS,
  STORY_COLUMNS_GAP_PRESETS,
  STORY_COLUMNS_WIDTH_PRESETS,
} from "@/lib/admin/story-creator/story-columns-layout";
import { MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bug,
  ChevronRight,
  Copy,
  ImageIcon,
  Info,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";
import { familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { MediaEditorPill } from "@/components/admin/media-editor/MediaEditorPill";
import { MediaPicker } from "@/components/admin/media-picker";
import {
  STORY_AUTHOR_PREFIX_OPTIONS,
  effectiveStoryAuthorPrefixMode,
  formatStoryAuthorLine,
  getStoryAuthorCredits,
} from "@/lib/admin/story-creator/story-author-display";
import { storyDocumentWithSaveTimestamp } from "@/lib/admin/story-creator/story-storage";
import { ApiError, postJson } from "@/lib/infra/api";
import { ADMIN_PICKER_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminAlbums, type AdminAlbumListItem } from "@/hooks/useAdminAlbums";
import { useStoryMediaById } from "@/hooks/useStoryMediaById";
import { mediaThumbSrc, resolveMediaImageSrc } from "@/lib/admin/mediaPreview";
import { toast } from "sonner";

export type StoryInspectorTab = "block" | "story" | "debug";

/** `sidebar`: desktop right rail. `sheet-block` / `sheet-story`: mobile full-width panels without tab chrome. */
export type StoryInspectorLayout = "sidebar" | "sheet-block" | "sheet-story";

const HEIGHT_OPTIONS: { value: StoryEmbedHeightPreset; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Full aspect, no cap" },
  { value: "compact", label: "Compact", hint: "Short" },
  { value: "default", label: "Default", hint: "Medium" },
  { value: "tall", label: "Tall", hint: "Large" },
  { value: "hero", label: "Hero", hint: "Up to ~75vh" },
];

const LINK_OPTIONS: { value: StoryEmbedLinkMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "same_window", label: "Same window" },
  { value: "new_tab", label: "New tab" },
];

const OTHER_EMBED_KINDS: StoryGeneralEmbedKind[] = ["document", "timeline", "map", "tree", "graph"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">{children}</p>;
}

function basenameFromFileRef(ref: string | null | undefined): string | undefined {
  if (ref == null || !String(ref).trim()) return undefined;
  const s = String(ref).replace(/\\/g, "/");
  const idx = s.lastIndexOf("/");
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function StoryTextPlacementGrid({
  heading,
  value,
  onPick,
  touchComfort,
}: {
  heading: string;
  value: StoryBlockTextPlacement;
  onPick: (v: StoryBlockTextPlacement) => void;
  touchComfort?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{heading}</FieldLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STORY_TEXT_PLACEMENT_OPTIONS.map(({ value: v, label }) => (
          <button
            key={v}
            type="button"
            title={label}
            onClick={() => onPick(v)}
            className={cn(
              "rounded-lg border text-center text-[11px] font-semibold uppercase tracking-wide transition-colors",
              touchComfort ? "min-h-[44px] px-2 py-2.5" : "px-2 py-2",
              value === v
                ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18 hover:bg-base-content/[0.04]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HelperCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-100/70 p-4 shadow-sm ring-1 ring-base-content/[0.04]">
      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">{title}</p>
      <div className="mt-2.5 text-sm leading-relaxed text-base-content/70">{children}</div>
    </div>
  );
}

function nestedBlockSummary(nb: StoryColumnNestedBlock): string {
  if (nb.type === "richText") return "Rich text";
  if (nb.type === "media") return "Media";
  if (nb.type === "columns") return "Columns (2)";
  if (nb.type === "container") return nb.props.label?.trim() || "Container";
  if (nb.type === "table") return "Table";
  if (nb.type === "splitContent") return "Split content";
  return `Embed (${nb.embedKind})`;
}

function columnSlotSummary(slot: StoryColumnsBlock["columns"][0]): string {
  const n = slot.blocks.length;
  if (n === 0) return "Empty";
  if (n === 1) return nestedBlockSummary(slot.blocks[0]!);
  return `${n} blocks`;
}

function splitMatchesCurrent(current: [number, number], preset: [number, number]): boolean {
  return Math.abs(current[0] - preset[0]) <= 1 && Math.abs(current[1] - preset[1]) <= 1;
}

function ColumnsLayoutInspector({
  block,
  nestingDepth,
  onPatch,
  onPatchColumnSlot,
  touchComfort,
}: {
  block: StoryColumnsBlock;
  /** 1 = section-level columns, 2 = columns inside a column. */
  nestingDepth: number;
  onPatch: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>) => void;
  onPatchColumnSlot: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  touchComfort?: boolean;
}) {
  const [w0, w1] = resolveColumnWidthPercents(block);
  const gapRem = resolveColumnGapRem(block);
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const current: [number, number] = [w0, w1];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-base-content/10 bg-base-200/25 px-3 py-2 text-xs leading-relaxed text-base-content/70">
        <span className="font-semibold text-base-content/85">Nesting depth:</span> {nestingDepth} of{" "}
        {MAX_STORY_COLUMNS_NEST_DEPTH}
        {nestingDepth >= MAX_STORY_COLUMNS_NEST_DEPTH ? (
          <span className="mt-1 block text-[11px] text-base-content/55">
            Nested columns are limited to 2 levels — you cannot add another columns block inside this layout.
          </span>
        ) : null}
      </div>

      <CollapsibleFormSection title="How columns work" defaultOpen={false}>
        <p className="text-sm leading-relaxed text-base-content/70">
          Widths are stored as a percentage split and rendered with CSS{" "}
          <code className="rounded bg-base-200/80 px-1 py-0.5 text-[11px]">fr</code> tracks so the gutter does not skew
          the ratio. Gap uses <code className="rounded bg-base-200/80 px-1 py-0.5 text-[11px]">rem</code>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-base-content/70">
          <strong className="font-medium text-base-content/85">Stack inside each column:</strong> vertical alignment and
          block spacing control how nested blocks sit when a column is taller than its content (via{" "}
          <code className="rounded bg-base-200/80 px-1 py-0.5 text-[11px]">justify-content</code> on the column flex
          stack).
        </p>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Layout" defaultOpen>
        <div>
          <FieldLabel>Width presets</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {STORY_COLUMNS_WIDTH_PRESETS.map((preset) => {
              const active = splitMatchesCurrent(current, preset.percents);
              return (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={cn("rounded-lg font-medium", chip, active && "shadow-sm")}
                  onClick={() => onPatch({ columnWidthPercents: normalizeColumnWidthPercents(preset.percents) })}
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <FieldLabel>Custom split</FieldLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={15}
              max={85}
              step={1}
              value={w0}
              className="range range-primary range-sm min-w-0 flex-1"
              aria-valuetext={`Column 1: ${w0}%, column 2: ${w1}%`}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                onPatch({ columnWidthPercents: normalizeColumnWidthPercents([next, 100 - next]) });
              }}
            />
            <span className="shrink-0 tabular-nums text-sm font-semibold text-base-content">
              {w0}% · {w1}%
            </span>
          </div>
        </div>

        <div>
          <FieldLabel>Gap between columns</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {STORY_COLUMNS_GAP_PRESETS.map((preset) => {
              const active = Math.abs(gapRem - preset.gapRem) < 0.05;
              return (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={cn("rounded-lg font-medium", chip)}
                  onClick={() => onPatch({ columnGapRem: preset.gapRem })}
                >
                  {preset.label}
                  <span className="ml-1.5 text-[10px] font-normal opacity-70">({preset.gapRem}rem)</span>
                </Button>
              );
            })}
          </div>
        </div>
      </CollapsibleFormSection>

      {([0, 1] as const).map((colIdx) => {
        const slot = block.columns[colIdx];
        const justify = resolveColumnStackJustify(slot);
        const stackGap = resolveColumnStackGapRem(slot);
        return (
          <CollapsibleFormSection key={slot.id} title={`Column ${colIdx + 1}`} defaultOpen>
            <div>
              <FieldLabel>Vertical alignment</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {STORY_COLUMN_STACK_JUSTIFY_PRESETS.map((preset) => {
                  const active = justify === preset.value;
                  return (
                    <Button
                      key={`${colIdx}-${preset.value}`}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      title={preset.hint}
                      className={cn("rounded-lg font-medium", chip, active && "shadow-sm")}
                      onClick={() => onPatchColumnSlot(colIdx, { stackJustify: preset.value })}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <FieldLabel>Space between blocks</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {STORY_COLUMN_STACK_GAP_PRESETS.map((preset) => {
                  const active = Math.abs(stackGap - preset.gapRem) < 0.05;
                  return (
                    <Button
                      key={`${colIdx}-gap-${preset.label}`}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className={cn("rounded-lg font-medium", chip)}
                      onClick={() => onPatchColumnSlot(colIdx, { stackGapRem: preset.gapRem })}
                    >
                      {preset.label}
                      <span className="ml-1.5 text-[10px] font-normal opacity-70">({preset.gapRem}rem)</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-base-content/10 bg-base-200/25 px-3 py-2.5">
              <FieldLabel>Contents</FieldLabel>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm font-medium text-base-content">
                <span className="min-w-0 truncate">{columnSlotSummary(slot)}</span>
                <ChevronRight className="size-4 shrink-0 text-base-content/35" aria-hidden />
              </div>
            </div>
          </CollapsibleFormSection>
        );
      })}

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <p className="text-sm leading-relaxed text-base-content/70">
          On narrow viewports the editor stacks the two columns vertically (column 1 first, then column 2). There are no
          separate mobile-only column settings in the document yet; alignment and gaps above apply in both layouts.
        </p>
      </CollapsibleFormSection>
    </div>
  );
}

const STORY_KIND_OPTIONS: { value: StoryDocumentKind; label: string; hint: string }[] = [
  { value: "story", label: "Story", hint: "Narrative, chapter-led family story." },
  { value: "article", label: "Article", hint: "Long-form article layout and tone." },
  { value: "post", label: "Post", hint: "Shorter update or blog-style post." },
];

function tagsToCommaInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

function parseCommaTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function StoryLinkedAlbumsField({
  linkedAlbums,
  onStoryMetaChange,
  panelId,
  touchComfort,
}: {
  linkedAlbums: { id: string; name: string }[];
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  panelId: string;
  touchComfort?: boolean;
}) {
  const [albumQuery, setAlbumQuery] = useState("");
  const [createAlbumAsPublic, setCreateAlbumAsPublic] = useState(false);
  const debouncedAlbumQ = useDebouncedValue(albumQuery.trim(), ADMIN_PICKER_DEBOUNCE_MS);
  const albumsQuery = useAdminAlbums({ q: debouncedAlbumQ, limit: 40 }, { enabled: debouncedAlbumQ.length >= 1 });
  const albumResults = useMemo(() => albumsQuery.data?.albums ?? [], [albumsQuery.data?.albums]);
  const exactAlbumMatch = useMemo(
    () => albumResults.some((a) => a.name.toLowerCase() === albumQuery.trim().toLowerCase()),
    [albumResults, albumQuery],
  );

  const addAlbum = (row: AdminAlbumListItem) => {
    if (linkedAlbums.some((a) => a.id === row.id)) return;
    onStoryMetaChange({ linkedAlbums: [...linkedAlbums, { id: row.id, name: row.name }] });
    setAlbumQuery("");
  };

  const removeAlbum = (id: string) => {
    onStoryMetaChange({ linkedAlbums: linkedAlbums.filter((a) => a.id !== id) });
  };

  const createAndAddAlbum = async () => {
    const name = albumQuery.trim();
    if (!name) return;
    try {
      const res = await postJson<{ album: AdminAlbumListItem }>("/api/admin/albums", {
        name,
        isPublic: createAlbumAsPublic,
      });
      addAlbum(res.album);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create album");
    }
  };

  return (
    <div className="space-y-3">
      <FieldLabel>Albums</FieldLabel>
      <p className="text-xs leading-relaxed text-base-content/55">
        Same flow as on media: search, pick, or create. Stored on this draft; sync maps to{" "}
        <code className="rounded bg-base-200/80 px-1 py-0.5 text-[10px]">album_stories</code> when the story API is
        connected.
      </p>
      <div className="flex flex-wrap gap-2">
        {linkedAlbums.map((a) => (
          <MediaEditorPill key={a.id} label={a.name} onRemove={() => removeAlbum(a.id)} />
        ))}
        {linkedAlbums.length === 0 ? (
          <span className="text-sm text-base-content/50">No albums yet.</span>
        ) : null}
      </div>
      <div className="flex items-start gap-3 rounded-md border border-base-content/10 p-3">
        <Checkbox
          id={`${panelId}-album-public`}
          checked={createAlbumAsPublic}
          onCheckedChange={(v) => setCreateAlbumAsPublic(v === true)}
        />
        <div className="grid gap-1.5 leading-none">
          <Label htmlFor={`${panelId}-album-public`} className="cursor-pointer text-sm font-medium text-base-content">
            Public album
          </Label>
          <p className="text-xs text-base-content/55">
            Public names must be unique on your account. Unchecked creates a personal album (duplicate names allowed).
          </p>
        </div>
      </div>
      <div className="relative space-y-2">
        <Input
          value={albumQuery}
          onChange={(e) => setAlbumQuery(e.target.value)}
          placeholder="Search your albums or type a new name…"
          autoComplete="off"
          className={touchComfort ? "h-11" : undefined}
        />
        {albumQuery.trim().length >= 1 ? (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
            {albumsQuery.isLoading ? (
              <p className="px-3 py-2 text-base-content/55">Searching…</p>
            ) : (
              <>
                {albumResults.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-base-200/80"
                    onClick={() => addAlbum(a)}
                  >
                    {a.name}
                  </button>
                ))}
                {!exactAlbumMatch && albumQuery.trim() ? (
                  <button
                    type="button"
                    className="w-full border-t border-base-content/10 px-3 py-2 text-left font-medium text-primary hover:bg-base-200/80"
                    onClick={() => void createAndAddAlbum()}
                  >
                    Create album “{albumQuery.trim()}”
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function storyLinkedPlaceFromSuggestionRow(row: AdminPlaceSuggestionRow): StoryLinkedPlace {
  return {
    id: row.id,
    label: formatPlaceSuggestionLabel(row),
    name: row.name,
    original: row.original?.trim() ? row.original.trim() : row.original ?? undefined,
    county: row.county,
    state: row.state,
    country: row.country,
  };
}

function InspectorStoryLinkedRecords({
  doc,
  storyId,
  onStoryMetaChange,
  touchComfort,
  embedded,
}: {
  doc: StoryDocument;
  storyId: string;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  touchComfort?: boolean;
  /** When true, omit outer card chrome (use inside a collapsible section). */
  embedded?: boolean;
}) {
  const selectedLinks = doc.linkedRecords ?? [];
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [eventLinkKind, setEventLinkKind] = useState<"individual" | "family">("individual");
  const [eventIndivGiven, setEventIndivGiven] = useState("");
  const [eventIndivLast, setEventIndivLast] = useState("");
  const [eventFamP1Given, setEventFamP1Given] = useState("");
  const [eventFamP1Last, setEventFamP1Last] = useState("");
  const [eventFamP2Given, setEventFamP2Given] = useState("");
  const [eventFamP2Last, setEventFamP2Last] = useState("");

  const peopleLinks = selectedLinks.filter((l) => l.kind === "individual");
  const familyLinks = selectedLinks.filter((l) => l.kind === "family");
  const eventLinks = selectedLinks.filter((l) => l.kind === "event");
  const placeLinks = doc.placeLinks ?? [];

  const selectedIdSetByKind = (kind: SelectedNoteLink["kind"]) =>
    new Set(selectedLinks.filter((l) => l.kind === kind).map((l) => l.id));

  const addLink = (next: SelectedNoteLink) => {
    if (next.kind !== "individual" && next.kind !== "family" && next.kind !== "event") return;
    if (selectedLinks.some((p) => p.kind === next.kind && p.id === next.id)) return;
    onStoryMetaChange({ linkedRecords: [...selectedLinks, next] });
  };

  const removeLink = (kind: SelectedNoteLink["kind"], id: string) => {
    onStoryMetaChange({
      linkedRecords: selectedLinks.filter((p) => !(p.kind === kind && p.id === id)),
    });
  };

  const selectedPlaceIdSet = new Set(placeLinks.map((p) => p.id));

  const addPlaceLink = (next: StoryLinkedPlace) => {
    if (placeLinks.some((p) => p.id === next.id)) return;
    onStoryMetaChange({ placeLinks: [...placeLinks, next] });
  };

  const removePlaceLink = (id: string) => {
    onStoryMetaChange({ placeLinks: placeLinks.filter((p) => p.id !== id) });
  };

  const addBtnClass = touchComfort ? "min-h-11 h-11 gap-1.5" : "h-9 gap-1";

  return (
    <div
      className={
        embedded
          ? "space-y-4"
          : "space-y-4 rounded-xl border border-base-content/10 bg-base-100/70 p-4 shadow-sm ring-1 ring-base-content/[0.04]"
      }
    >
      <div className="mb-1">
        <h2 className={embedded ? "text-sm font-semibold text-base-content" : "text-base font-semibold text-base-content"}>
          Linked records
        </h2>
        <p className="text-sm leading-relaxed text-base-content/60">
          Connect this story to the people, families, events, and places it relates to.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base-content/90">People</Label>
          <Button type="button" variant="outline" size="sm" className={addBtnClass} onClick={() => setShowPeoplePicker((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            Add person
          </Button>
        </div>
        {peopleLinks.map((l) => (
          <div
            key={`p-${l.id}`}
            className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100/50 px-3 py-2"
          >
            <p className="text-sm text-base-content">{l.label}</p>
            <button
              type="button"
              className="text-base-content/50 hover:text-base-content"
              aria-label={`Remove ${l.label}`}
              onClick={() => removeLink("individual", l.id)}
            >
              ×
            </button>
          </div>
        ))}
        {showPeoplePicker ? (
          <IndividualSearchPicker
            idPrefix={`story-ind-${storyId}`}
            excludeIds={selectedIdSetByKind("individual")}
            onPick={(ind) => {
              addLink({ kind: "individual", id: ind.id, label: ind.fullName?.trim() || ind.xref || ind.id });
              setShowPeoplePicker(false);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base-content/90">Families</Label>
          <Button type="button" variant="outline" size="sm" className={addBtnClass} onClick={() => setShowFamilyPicker((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            Add family
          </Button>
        </div>
        {familyLinks.map((l) => (
          <div
            key={`f-${l.id}`}
            className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100/50 px-3 py-2"
          >
            <p className="text-sm text-base-content">{l.label}</p>
            <button
              type="button"
              className="text-base-content/50 hover:text-base-content"
              aria-label={`Remove ${l.label}`}
              onClick={() => removeLink("family", l.id)}
            >
              ×
            </button>
          </div>
        ))}
        {showFamilyPicker ? (
          <FamilySearchPicker
            idPrefix={`story-fam-${storyId}`}
            excludeIds={selectedIdSetByKind("family")}
            onPick={(fam) => {
              addLink({
                kind: "family",
                id: fam.id,
                label: familyUnionPrimaryLine(fam) || fam.xref?.trim() || fam.id,
              });
              setShowFamilyPicker(false);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base-content/90">Events</Label>
          <Button type="button" variant="outline" size="sm" className={addBtnClass} onClick={() => setShowEventPicker((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            Add event
          </Button>
        </div>
        {eventLinks.map((l) => (
          <div
            key={`e-${l.id}`}
            className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100/50 px-3 py-2"
          >
            <p className="text-sm text-base-content">{l.label}</p>
            <button
              type="button"
              className="text-base-content/50 hover:text-base-content"
              aria-label={`Remove ${l.label}`}
              onClick={() => removeLink("event", l.id)}
            >
              ×
            </button>
          </div>
        ))}
        {showEventPicker ? (
          <EventPicker
            idPrefix={`story-ev-${storyId}`}
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
            excludeEventIds={selectedIdSetByKind("event")}
            onPick={(ev) => {
              addLink({ kind: "event", id: ev.id, label: formatNoteEventPickerLabel(ev) });
              setShowEventPicker(false);
            }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-base-content/90">Related places</Label>
          <Button type="button" variant="outline" size="sm" className={addBtnClass} onClick={() => setShowPlacePicker((v) => !v)}>
            <Plus className="size-4" aria-hidden />
            Add place
          </Button>
        </div>
        {placeLinks.length === 0 && !showPlacePicker ? (
          <div className="rounded-md border border-base-content/8 bg-base-100/30 px-3 py-2">
            <p className="text-xs leading-relaxed text-base-content/55">No places linked yet.</p>
            <p className="mt-1 text-xs leading-relaxed text-base-content/45">
              Link places connected to this story, such as birthplaces, residences, migration points, or event locations.
            </p>
          </div>
        ) : null}
        {placeLinks.map((pl) => (
          <div
            key={`place-${pl.id}`}
            className="flex items-center justify-between rounded-md border border-base-content/10 bg-base-100/50 px-3 py-2"
          >
            <div className="min-w-0 pr-2">
              <p className="truncate text-sm text-base-content">{pl.label}</p>
              {pl.original && pl.original !== pl.label ? (
                <p className="truncate text-[11px] text-base-content/45">{pl.original}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 text-base-content/50 hover:text-base-content"
              aria-label={`Remove ${pl.label}`}
              onClick={() => removePlaceLink(pl.id)}
            >
              ×
            </button>
          </div>
        ))}
        {showPlacePicker ? (
          <StoryPlaceSearchPicker
            idPrefix={`story-place-${storyId}`}
            excludeIds={selectedPlaceIdSet}
            onPick={(row) => {
              addPlaceLink(storyLinkedPlaceFromSuggestionRow(row));
              setShowPlacePicker(false);
            }}
          />
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-base-content/50">
        Stored on this draft; a future story API can mirror note-style junction tables (e.g.{" "}
        <code className="rounded bg-base-200/70 px-1 text-[10px]">story_places</code> for place ids).
      </p>
    </div>
  );
}

function userMediaRefFromLibraryItem(m: AdminMediaListItem): StoryImageMediaRef {
  return { mediaId: m.id, mediaKind: "user_media" };
}

/** Keeps deprecated `coverMediaId` in sync when cover is admin library (`user_media`) media. */
function coverImageMetaPatch(ref: StoryImageMediaRef | undefined): StoryDocumentMetaPatch {
  if (!ref) {
    return { coverImage: undefined, coverMediaId: undefined, coverMediaKind: undefined };
  }
  if (ref.mediaKind === "user_media") {
    return { coverImage: ref, coverMediaId: ref.mediaId, coverMediaKind: "user_media" };
  }
  return { coverImage: ref, coverMediaId: undefined, coverMediaKind: undefined };
}

function InspectorStoryImageRow({
  label,
  helper,
  mediaId,
  hasExplicit,
  storyId,
  touchComfort,
  chooseLabel,
  replaceLabel,
  removeLabel,
  onPick,
  onRemove,
}: {
  label: string;
  helper: string;
  mediaId: string | undefined;
  hasExplicit: boolean;
  storyId: string;
  touchComfort?: boolean;
  chooseLabel: string;
  replaceLabel: string;
  removeLabel: string;
  onPick: (items: AdminMediaListItem[]) => void;
  onRemove: () => void;
}) {
  const { data, isLoading } = useStoryMediaById(mediaId);
  const thumb =
    data?.fileRef != null && data.fileRef !== ""
      ? mediaThumbSrc(data.fileRef, data.form, 200) ?? resolveMediaImageSrc(data.fileRef)
      : null;

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 text-xs leading-relaxed text-base-content/55">{helper}</p>
      <div className="mt-3 flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-base-content/10 bg-base-200/50">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] leading-tight text-base-content/45">
              <ImageIcon className="size-6 opacity-40" aria-hidden />
              {isLoading && mediaId ? "…" : "No image"}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <MediaPicker
            targetType="story"
            targetId={storyId}
            mode="single"
            purpose="storyIllustration"
            triggerLabel={hasExplicit ? replaceLabel : chooseLabel}
            triggerClassName={cn(
              "rounded-lg border-base-content/12 px-3 font-medium",
              touchComfort ? "min-h-[44px] h-11" : "h-9",
            )}
            onAttach={(items) => onPick(items)}
          />
          {hasExplicit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "w-fit rounded-lg border-base-content/12 font-medium text-error hover:bg-error/10",
                touchComfort ? "min-h-[44px] h-11" : "h-9",
              )}
              onClick={onRemove}
            >
              {removeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InspectorStoryImagesSection({
  doc,
  storyId,
  onStoryMetaChange,
  touchComfort,
}: {
  doc: StoryDocument;
  storyId: string;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  touchComfort?: boolean;
}) {
  const coverRef = doc.coverImage ?? legacyCoverImageRef(doc);
  const coverMediaId = coverRef?.mediaId;
  const profileMediaId = doc.profileImage?.mediaId;

  return (
    <CollapsibleFormSection title="Story images" defaultOpen>
      <div className="space-y-4">
        <InspectorStoryImageRow
          label="Cover image"
          helper="Used as the main visual header for the story."
          mediaId={coverMediaId}
          hasExplicit={Boolean(doc.coverImage ?? doc.coverMediaId)}
          storyId={storyId}
          touchComfort={touchComfort}
          chooseLabel="Choose cover"
          replaceLabel="Replace cover"
          removeLabel="Remove cover"
          onPick={(items) => {
            const m = items[0];
            if (!m) return;
            onStoryMetaChange(coverImageMetaPatch(userMediaRefFromLibraryItem(m)));
          }}
          onRemove={() => onStoryMetaChange(coverImageMetaPatch(undefined))}
        />
        <InspectorStoryImageRow
          label="Profile image"
          helper="Used as the story's identity image. If not set, the cover image will be used."
          mediaId={profileMediaId}
          hasExplicit={Boolean(doc.profileImage)}
          storyId={storyId}
          touchComfort={touchComfort}
          chooseLabel="Choose profile"
          replaceLabel="Replace profile"
          removeLabel="Remove profile"
          onPick={(items) => {
            const m = items[0];
            if (!m) return;
            onStoryMetaChange({ profileImage: userMediaRefFromLibraryItem(m) });
          }}
          onRemove={() => onStoryMetaChange({ profileImage: undefined })}
        />
        <p className="text-xs leading-relaxed text-base-content/50">
          Library picks map to <code className="rounded bg-base-200/80 px-1 py-0.5 text-[10px]">stories.cover_media_id</code> /{" "}
          <code className="rounded bg-base-200/80 px-1 py-0.5 text-[10px]">stories.profile_media_id</code> when synced to the database.
        </p>
      </div>
    </CollapsibleFormSection>
  );
}

function authorsPatch(next: StoryAuthorCredit[]): StoryDocumentMetaPatch {
  return {
    authors: next,
    author: undefined,
    authorPrefixMode: undefined,
    authorPrefixCustom: undefined,
  };
}

function InspectorStoryAuthorsSection({
  doc,
  controlH,
  authorPrefixOptionClass,
  onStoryMetaChange,
}: {
  doc: StoryDocument;
  controlH: string;
  authorPrefixOptionClass: (active: boolean) => string;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
}) {
  const credits = useMemo(() => getStoryAuthorCredits(doc), [doc]);

  const setCredits = useCallback(
    (next: StoryAuthorCredit[]) => {
      const normalized = next.map((c) => ({
        ...c,
        id: c.id?.trim() && c.id !== "legacy" ? c.id : newStoryId(),
        name: c.name,
      }));
      onStoryMetaChange(authorsPatch(normalized));
    },
    [onStoryMetaChange],
  );

  const updateCredit = useCallback(
    (id: string, patch: Partial<StoryAuthorCredit>) => {
      setCredits(credits.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [credits, setCredits],
  );

  const addAuthor = useCallback(() => {
    setCredits([...credits, { id: newStoryId(), name: "", authorPrefixMode: "by" }]);
  }, [credits, setCredits]);

  const removeAuthor = useCallback(
    (id: string) => {
      setCredits(credits.filter((c) => c.id !== id));
    },
    [credits, setCredits],
  );

  const moveAuthor = useCallback(
    (id: string, delta: -1 | 1) => {
      const i = credits.findIndex((c) => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= credits.length) return;
      const next = [...credits];
      const t = next[i]!;
      next[i] = next[j]!;
      next[j] = t;
      setCredits(next);
    },
    [credits, setCredits],
  );

  return (
    <div>
      <p className="mb-2 text-xs leading-relaxed text-base-content/55">
        One credit per line; order is shown on the public page. Each person can use a different prefix (for example
        &quot;Written by&quot; vs &quot;Narrated by&quot;).
      </p>
      <div className="flex flex-col gap-3">
        {credits.length === 0 ? (
          <p className="text-xs text-base-content/50">No authors yet.</p>
        ) : (
          credits.map((credit, idx) => (
            <div
              key={credit.id}
              className="rounded-xl border border-base-content/12 bg-base-100/30 p-3 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">
                  Author {idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  {credits.length > 1 ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-0.5 px-1.5"
                        disabled={idx === 0}
                        onClick={() => moveAuthor(credit.id, -1)}
                        aria-label={`Move author ${idx + 1} up`}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-0.5 px-1.5"
                        disabled={idx >= credits.length - 1}
                        onClick={() => moveAuthor(credit.id, 1)}
                        aria-label={`Move author ${idx + 1} down`}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" aria-hidden />
                      </button>
                    </>
                  ) : null}
                  {credits.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1 text-error"
                      onClick={() => removeAuthor(credit.id)}
                      aria-label={`Remove author ${idx + 1}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                className={cn(
                  "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
                  controlH,
                )}
                placeholder="e.g. Jordan Gonsalves"
                value={credit.name}
                onChange={(e) => updateCredit(credit.id, { name: e.target.value })}
              />
              <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wider text-base-content/45">
                Text before this name
              </p>
              <div className="flex flex-col gap-2">
                {STORY_AUTHOR_PREFIX_OPTIONS.map((opt) => {
                  const active = effectiveStoryAuthorPrefixMode(credit.authorPrefixMode) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={authorPrefixOptionClass(active)}
                      onClick={() => updateCredit(credit.id, { authorPrefixMode: opt.value })}
                    >
                      <span className="block text-sm font-semibold text-base-content">{opt.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-base-content/55">{opt.example}</span>
                    </button>
                  );
                })}
              </div>
              {effectiveStoryAuthorPrefixMode(credit.authorPrefixMode) === "custom" ? (
                <div className="mt-2">
                  <FieldLabel>Custom prefix</FieldLabel>
                  <p className="mb-2 text-xs leading-relaxed text-base-content/55">
                    Text immediately before this name. Add a trailing space if you want one before the name.
                  </p>
                  <input
                    className={cn(
                      "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
                      controlH,
                    )}
                    placeholder='e.g. Narrated by  or  Written by '
                    value={credit.authorPrefixCustom ?? ""}
                    onChange={(e) =>
                      updateCredit(credit.id, {
                        authorPrefixCustom: e.target.value.length ? e.target.value : undefined,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <button type="button" className="btn btn-outline btn-sm mt-2 gap-1" onClick={addAuthor}>
        <Plus className="size-3.5" aria-hidden />
        Add author
      </button>
      <div className="mt-3 rounded-lg border border-base-content/10 bg-base-100/45 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">Live preview</p>
        <p className="mt-1.5 whitespace-pre-line text-sm font-medium text-base-content">
          {formatStoryAuthorLine(doc) ?? (
            <span className="font-normal text-base-content/50">Add at least one author name to preview bylines.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function InspectorStoryTabContent({
  doc,
  storyId,
  onTitleChange,
  onExcerptChange,
  onStoryMetaChange,
  touchComfort,
}: {
  doc: StoryDocument;
  storyId: string;
  onTitleChange: (title: string) => void;
  onExcerptChange: (excerpt: string) => void;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  touchComfort?: boolean;
}) {
  const controlH = touchComfort ? "h-11 min-h-[44px]" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const kind = doc.kind ?? "story";
  const status = doc.status ?? "draft";
  const [slugError, setSlugError] = useState<string | null>(null);
  const publicOrigin =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PUBLIC_STORY_SITE_ORIGIN?.trim()) ||
    "https://gonsalves.family";

  const checkSlugAvailability = useCallback(
    async (slugOverride?: string) => {
      const slug = normalizeStorySlugInput(slugOverride ?? doc.slug ?? "");
      if (!slug) {
        setSlugError(null);
        return;
      }
      try {
        const res = await fetchJson<{ available: boolean }>(
          `/api/admin/stories/check-slug?slug=${encodeURIComponent(slug)}&excludeId=${encodeURIComponent(storyId)}`,
        );
        setSlugError(res.available ? null : "This URL slug is already taken. Try another.");
      } catch {
        setSlugError(null);
      }
    },
    [doc.slug, storyId],
  );

  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  const authorPrefixOptionClass = (active: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
      touchComfort ? "min-h-[52px]" : "min-h-0",
      active
        ? "border-primary/45 bg-primary/15 shadow-sm ring-1 ring-primary/15"
        : "border-base-content/12 bg-base-100/70 hover:border-base-content/20",
    );

  const authorCredits = useMemo(() => getStoryAuthorCredits(doc), [doc]);
  const authorsSectionDefaultOpen = authorCredits.length > 0;
  const summaryDefaultOpen = Boolean((doc.excerpt ?? "").trim());
  const slugPreview = normalizeStorySlugInput(doc.slug ?? "");

  return (
    <div className="space-y-4">
      <CollapsibleFormSection title="Basic details" defaultOpen>
        <div>
          <FieldLabel>Title</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">Shown in the editor header, story list, and (when synced) the public page title.</p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
              controlH,
            )}
            value={doc.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Slug</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Lowercase letters, numbers, and hyphens. Spaces become hyphens; other characters are removed. Used on the public site at{" "}
            <span className="font-medium text-base-content/70">/stories/your-slug</span>.
          </p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
              controlH,
              slugError ? "border-error/60" : "",
            )}
            placeholder="e.g. the-gonsalves-of-berbice"
            value={doc.slug ?? ""}
            onChange={(e) => {
              const live = normalizeStorySlugInputLive(e.target.value);
              if (!live.length) {
                const auto = !doc.title.trim()
                  ? ""
                  : normalizeStorySlugInput(slugifyStoryTitle(doc.title));
                onStoryMetaChange({
                  slug: auto.length ? auto : undefined,
                  slugManuallyEdited: false,
                });
              } else {
                onStoryMetaChange({ slug: live, slugManuallyEdited: true });
              }
              if (slugError) setSlugError(null);
            }}
            onBlur={() => {
              const raw = doc.slug ?? "";
              const committed = normalizeStorySlugInput(raw);
              if (committed !== raw) {
                onStoryMetaChange({ slug: committed.length ? committed : undefined });
              }
              void checkSlugAvailability(committed);
            }}
            spellCheck={false}
            aria-invalid={Boolean(slugError)}
          />
          {slugError ? <p className="mt-1.5 text-xs font-medium text-error">{slugError}</p> : null}
        </div>
        <div className="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/45">Public URL preview</p>
          <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-base-content/70">
            {publicOrigin.replace(/\/$/, "")}/stories/{slugPreview.length > 0 ? slugPreview : "…"}
          </p>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Authors" defaultOpen={authorsSectionDefaultOpen}>
        <InspectorStoryAuthorsSection
          doc={doc}
          controlH={controlH}
          authorPrefixOptionClass={authorPrefixOptionClass}
          onStoryMetaChange={onStoryMetaChange}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Summary" defaultOpen={summaryDefaultOpen}>
        <div>
          <FieldLabel>Subtitle / short description</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Optional teaser for cards, search, and social previews. Keep it one or two sentences.
          </p>
          <textarea
            className="textarea textarea-bordered textarea-sm min-h-[88px] w-full resize-y rounded-lg border-base-content/12 bg-base-100 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-500"
            placeholder="e.g. How the family came to California…"
            value={doc.excerpt ?? ""}
            onChange={(e) => onExcerptChange(e.target.value)}
          />
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Publishing state" defaultOpen={false}>
        <div>
          <FieldLabel>Status</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Draft vs published is stored on the document. Use <span className="font-medium text-base-content/75">Save draft</span> or{" "}
            <span className="font-medium text-base-content/75">Publish</span> in the toolbar to write changes to local storage.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chipBtn(status === "draft")} onClick={() => onStoryMetaChange({ status: "draft" })}>
              Draft
            </button>
            <button
              type="button"
              className={chipBtn(status === "published")}
              onClick={() => onStoryMetaChange({ status: "published" })}
            >
              Published
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Visibility</p>
          <p className="mt-1 text-xs leading-relaxed text-base-content/60">
            Stories live in this admin app and your browser storage until a public API exists. Both draft and published
            remain private to your account here.
          </p>
        </div>
        <div>
          <FieldLabel>Content type</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">
            Drives how the piece is labeled for listings and URLs when synced (
            <code className="rounded bg-base-200/80 px-1 py-0.5 text-[10px]">StoryKind</code>).
          </p>
          <div className="flex flex-wrap gap-2">
            {STORY_KIND_OPTIONS.map((opt) => {
              const active = kind === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.hint}
                  onClick={() => onStoryMetaChange({ kind: opt.value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    touchComfort ? "min-h-[44px] min-w-[5.5rem]" : "min-h-9",
                    active
                      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                      : "border-base-content/12 bg-base-100/70 text-base-content/75 hover:border-base-content/20",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </CollapsibleFormSection>

      <InspectorStoryImagesSection doc={doc} storyId={storyId} onStoryMetaChange={onStoryMetaChange} touchComfort={touchComfort} />

      <CollapsibleFormSection title="Story context" defaultOpen>
        <InspectorStoryLinkedRecords
          doc={doc}
          storyId={storyId}
          onStoryMetaChange={onStoryMetaChange}
          touchComfort={touchComfort}
          embedded
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Organization" defaultOpen={false}>
        <div>
          <FieldLabel>Tags</FieldLabel>
          <p className="mb-2 text-xs leading-relaxed text-base-content/55">Comma-separated keywords for your own organization and future search.</p>
          <input
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100",
              controlH,
            )}
            placeholder="e.g. immigration, civil-war"
            value={tagsToCommaInput(doc.tags)}
            onChange={(e) => onStoryMetaChange({ tags: parseCommaTags(e.target.value) })}
          />
          <p className="mt-1.5 text-xs text-base-content/50">
            Persists on this draft; maps to <code className="rounded bg-base-200/70 px-1 text-[10px]">stories.tags</code> /{" "}
            <code className="rounded bg-base-200/70 px-1 text-[10px]">story_tags</code> when the API is wired.
          </p>
        </div>
        <StoryLinkedAlbumsField
          linkedAlbums={doc.linkedAlbums ?? []}
          onStoryMetaChange={onStoryMetaChange}
          panelId={`story-albums-${storyId}`}
          touchComfort={touchComfort}
        />
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <div>
          <FieldLabel>Story ID</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Stable identifier in local storage and future sync.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={doc.id}
          />
        </div>
        <div>
          <FieldLabel>Document format</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Schema version for migrations when the editor format changes.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={`version ${doc.version}`}
          />
        </div>
        <div>
          <FieldLabel>Last updated (on document)</FieldLabel>
          <p className="mb-2 text-xs text-base-content/55">Refreshed when you save draft or publish to local storage.</p>
          <input
            readOnly
            className={cn(
              "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs",
              controlH,
            )}
            value={doc.updatedAt}
          />
        </div>
        <p className="text-xs leading-relaxed text-base-content/50">
          Import and server-side migration notes will appear here when available. Until then, use the{" "}
          <span className="font-medium text-base-content/65">Debug</span> tab to inspect raw JSON.
        </p>
      </CollapsibleFormSection>
    </div>
  );
}

function InspectorDebugTabContent({
  doc,
  selectedBlockId,
  selectedBlock,
  storyEditorDirty,
}: {
  doc: StoryDocument;
  selectedBlockId: string | null;
  selectedBlock: StoryBlock | null;
  storyEditorDirty: boolean;
}) {
  const payload = useMemo(
    () => ({
      summary: {
        storyId: doc.id,
        schemaVersion: doc.version,
        documentUpdatedAt: doc.updatedAt,
        selectedBlockId,
        selectedBlockType: selectedBlock?.type ?? null,
        dirtyVersusLastLocalSave: storyEditorDirty,
        validationErrors: null,
      },
      documentInMemory: doc,
      /** Shape of the next `saveStoryDocument` write (`updatedAt` refreshed at save time). */
      localStorageSavePayloadPreview: storyDocumentWithSaveTimestamp(doc),
    }),
    [doc, selectedBlockId, selectedBlock, storyEditorDirty],
  );

  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const copyJson = () => {
    void navigator.clipboard.writeText(jsonText).then(
      () => toast.success("Copied debug JSON"),
      () => toast.error("Could not copy to clipboard"),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <p className="text-xs leading-relaxed text-base-content/55">
        Read-only developer view. <span className="font-medium text-base-content/75">documentInMemory</span> is the live
        editor state; <span className="font-medium text-base-content/75">localStorageSavePayloadPreview</span> matches the
        JSON persisted by <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">saveStoryDocument</code>{" "}
        (a new <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">updatedAt</code> is applied on each save).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2 font-medium" onClick={copyJson}>
          <Copy className="size-3.5 opacity-80" aria-hidden />
          Copy JSON
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Combined payload</p>
        <pre className="max-h-[min(55vh,520px)] min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-base-content/12 bg-base-300/25 p-3 font-mono text-[11px] leading-relaxed text-base-content/90">
          {jsonText}
        </pre>
      </div>
    </div>
  );
}

function StoryInspectorSheetStoryOrDebug({
  storyId,
  doc,
  onTitleChange,
  onExcerptChange,
  onStoryMetaChange,
  selectedBlockId,
  selectedBlock,
  storyEditorDirty,
  touchComfort,
  className,
}: {
  storyId: string;
  doc: StoryDocument;
  onTitleChange: (title: string) => void;
  onExcerptChange: (excerpt: string) => void;
  onStoryMetaChange: (patch: StoryDocumentMetaPatch) => void;
  selectedBlockId: string | null;
  selectedBlock: StoryBlock | null;
  storyEditorDirty: boolean;
  touchComfort?: boolean;
  className?: string;
}) {
  const [sub, setSub] = useState<"story" | "debug">("story");
  useEffect(() => setSub("story"), [storyId]);

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col bg-base-200/45", className)}>
      <div className="flex shrink-0 gap-1 border-b border-base-content/10 px-2.5 pt-2">
        <button
          type="button"
          onClick={() => setSub("story")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            sub === "story"
              ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
              : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
          )}
        >
          Story
        </button>
        <button
          type="button"
          onClick={() => setSub("debug")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            sub === "debug"
              ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
              : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
          )}
        >
          <Bug className="size-3.5 opacity-80" aria-hidden />
          Debug
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {sub === "story" ? (
          <InspectorStoryTabContent
            doc={doc}
            storyId={storyId}
            onTitleChange={onTitleChange}
            onExcerptChange={onExcerptChange}
            onStoryMetaChange={onStoryMetaChange}
            touchComfort={touchComfort}
          />
        ) : (
          <InspectorDebugTabContent
            doc={doc}
            selectedBlockId={selectedBlockId}
            selectedBlock={selectedBlock}
            storyEditorDirty={storyEditorDirty}
          />
        )}
      </div>
    </div>
  );
}

function ContainerLayoutInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StoryContainerBlock;
  onPatch: (patch: Partial<StoryContainerBlockProps>) => void;
  touchComfort?: boolean;
}) {
  const p = block.props;
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";

  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  const layoutPresets: StoryContainerPreset[] = ["default", "card", "callout", "hero", "quote"];

  return (
    <div className="space-y-4">
      <HelperCard title="Container">
        Groups blocks with shared layout. The label is only shown in the editor, not in the published story.
      </HelperCard>
      <div>
        <FieldLabel>Layout preset</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {layoutPresets.map((v) => (
            <button key={v} type="button" className={chipBtn((p.containerPreset ?? "default") === v)} onClick={() => onPatch({ containerPreset: v })}>
              {v === "default" ? "Default" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Label (editor only)</FieldLabel>
        <Input
          className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          placeholder="Optional — e.g. “Hero”"
          value={p.label ?? ""}
          onChange={(e) => onPatch({ label: e.target.value.trim() ? e.target.value : undefined })}
        />
      </div>
      <div>
        <FieldLabel>Background</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "subtle", "custom"] as const).map((v) => (
            <button key={v} type="button" className={chipBtn(p.background === v)} onClick={() => onPatch({ background: v })}>
              {v === "none" ? "None" : v === "subtle" ? "Subtle" : "Custom"}
            </button>
          ))}
        </div>
      </div>
      {p.background === "custom" ? (
        <div>
          <FieldLabel>Custom color (CSS)</FieldLabel>
          <Input
            className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            placeholder="e.g. oklch(0.9 0.02 250) or #e8e4df"
            value={p.customBackground ?? ""}
            onChange={(e) => onPatch({ customBackground: e.target.value || undefined })}
          />
        </div>
      ) : null}
      <div>
        <FieldLabel>Padding</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "sm", "md", "lg"] as const).map((v) => (
            <button key={v} type="button" className={chipBtn(p.padding === v)} onClick={() => onPatch({ padding: v })}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Border</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "subtle", "dashed"] as const).map((v) => (
            <button key={v} type="button" className={chipBtn(p.border === v)} onClick={() => onPatch({ border: v })}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <StoryBlockRowLayoutInspector
        rowLayout={effectiveContainerRowLayout(p)}
        onPatch={(patch) => {
          const nextRl = mergeStoryRowLayout(effectiveContainerRowLayout(p), patch);
          const mode = nextRl.widthMode ?? "full";
          onPatch({
            rowLayout: nextRl,
            width: mode === "full" ? "full" : "constrained",
            align: (nextRl.alignment ?? "left") as NonNullable<StoryContainerBlockProps["align"]>,
          });
        }}
        touchComfort={touchComfort}
      />
    </div>
  );
}

function StoryBlockDesignInspector({
  blockId,
  design,
  onPatchDesign,
  touchComfort,
}: {
  blockId: string;
  design: StoryBlockDesign | undefined;
  onPatchDesign: (patch: Partial<StoryBlockDesign> | null) => void;
  touchComfort?: boolean;
}) {
  const controlH = touchComfort ? "h-11 min-h-[44px]" : "h-10";
  const taMin = touchComfort ? "min-h-[120px]" : "min-h-[100px]";
  return (
    <CollapsibleFormSection title="Advanced design" defaultOpen={false}>
      <p className="text-xs leading-relaxed text-base-content/55">
        Custom classes merge onto the block&apos;s row wrapper. CSS is wrapped in <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">@scope</code> for{" "}
        <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">data-story-block-scope</code> so rules cannot
        leak to other blocks or the editor chrome (requires a modern browser).
      </p>
      <div>
        <FieldLabel>Scope attribute</FieldLabel>
        <p className="break-all font-mono text-[10px] leading-relaxed text-base-content/55">
          data-story-block-scope=&quot;{blockId}&quot;
        </p>
      </div>
      <div>
        <FieldLabel>Custom class names</FieldLabel>
        <p className="mb-2 text-xs text-base-content/55">Space-separated utility classes; unsafe characters are stripped on save.</p>
        <Input
          className={cn(
            "input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-sm",
            controlH,
          )}
          value={design?.className ?? ""}
          placeholder="e.g. opacity-95 rounded-2xl"
          onChange={(e) => onPatchDesign({ className: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>Scoped CSS</FieldLabel>
        <p className="mb-2 text-xs text-base-content/55">
          Target inner markup with descendant selectors, or the wrapper with <code className="font-mono text-[10px]">:scope</code>.
        </p>
        <textarea
          className={cn(
            "textarea textarea-bordered textarea-sm mt-1 w-full resize-y rounded-lg border-base-content/12 bg-base-100 font-mono text-xs leading-relaxed text-neutral-900 placeholder:text-neutral-500",
            taMin,
          )}
          value={design?.css ?? ""}
          placeholder={":scope { box-shadow: inset 0 0 0 1px oklch(0.5 0.02 250 / 0.25); }"}
          spellCheck={false}
          onChange={(e) => onPatchDesign({ css: e.target.value })}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("mt-1 gap-2 font-medium", touchComfort ? "min-h-11 h-11" : "h-9")}
        onClick={() => onPatchDesign(null)}
      >
        <RotateCcw className="size-3.5 opacity-80" aria-hidden />
        Reset custom design
      </Button>
    </CollapsibleFormSection>
  );
}

function BlockDateAnnotationInspector({
  annotation,
  onCommit,
  touchComfort,
}: {
  annotation: StoryBlockDateAnnotation | undefined;
  onCommit: (next: StoryBlockDateAnnotation | undefined) => void;
  touchComfort?: boolean;
}) {
  const controlH = touchComfort ? "h-11 min-h-[44px]" : "h-10";
  const [date, setDate] = useState(annotation?.date ?? "");
  const [dateDisplay, setDateDisplay] = useState(annotation?.dateDisplay ?? "");
  const [endDate, setEndDate] = useState(annotation?.endDate ?? "");

  useEffect(() => {
    setDate(annotation?.date ?? "");
    setDateDisplay(annotation?.dateDisplay ?? "");
    setEndDate(annotation?.endDate ?? "");
  }, [annotation]);

  const flush = useCallback(() => {
    const d = date.trim();
    const dd = dateDisplay.trim();
    const ed = endDate.trim();
    if (!d || !dd) {
      onCommit(undefined);
      return;
    }
    onCommit({ date: d, dateDisplay: dd, ...(ed ? { endDate: ed } : {}) });
  }, [date, dateDisplay, endDate, onCommit]);

  return (
    <CollapsibleFormSection title="Date annotation" defaultOpen={false}>
      <p className="mb-3 text-xs leading-relaxed text-base-content/55">
        Optional dated marker for the public timeline view. Use an ISO 8601 date (e.g. <span className="font-mono">1887-03-14</span>) and a
        human label (e.g. “March 1887” or “circa 1920”).
      </p>
      <div className="space-y-3">
        <div>
          <FieldLabel>Date (ISO 8601)</FieldLabel>
          <input
            className={cn(
              "input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
              controlH,
            )}
            placeholder="1887-03-14"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => flush()}
            spellCheck={false}
          />
        </div>
        <div>
          <FieldLabel>Display label</FieldLabel>
          <input
            className={cn(
              "input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100 text-sm",
              controlH,
            )}
            placeholder="March 1887"
            value={dateDisplay}
            onChange={(e) => setDateDisplay(e.target.value)}
            onBlur={() => flush()}
          />
        </div>
        <div>
          <FieldLabel>End date (ISO, optional)</FieldLabel>
          <input
            className={cn(
              "input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
              controlH,
            )}
            placeholder="1920-12-31"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={() => flush()}
            spellCheck={false}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("w-full gap-2 font-medium", touchComfort ? "min-h-11 h-11" : "h-9")}
          onClick={() => {
            setDate("");
            setDateDisplay("");
            setEndDate("");
            onCommit(undefined);
          }}
        >
          Clear date annotation
        </Button>
      </div>
    </CollapsibleFormSection>
  );
}

const RICH_TEXT_PRESET_OPTIONS: StoryRichTextTextPreset[] = ["paragraph", "heading", "list", "verse", "quote"];

function RichTextBlockInspector({
  block,
  onPatch,
  onPatchRowLayout,
  touchComfort,
}: {
  block: StoryRichTextBlock;
  onPatch: (patch: StoryRichTextMetaPatch) => void;
  onPatchRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  touchComfort?: boolean;
}) {
  const preset = getStoryRichTextPreset(block);
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Text preset</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {RICH_TEXT_PRESET_OPTIONS.map((p) => (
            <button key={p} type="button" className={chipBtn(preset === p)} onClick={() => onPatch({ preset: p, textPreset: p })}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {preset === "heading" ? (
        <div>
          <FieldLabel>Heading level</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {([1, 2, 3] as const).map((lvl) => (
              <button key={lvl} type="button" className={chipBtn((block.headingLevel ?? 2) === lvl)} onClick={() => onPatch({ headingLevel: lvl })}>
                H{lvl}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {preset === "list" ? (
        <div>
          <FieldLabel>List style</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["bullet", "ordered"] as const).map((lv) => (
              <button key={lv} type="button" className={chipBtn((block.listVariant ?? "bullet") === lv)} onClick={() => onPatch({ listVariant: lv })}>
                {lv === "bullet" ? "Bullets" : "Numbered"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {preset === "quote" ? (
        <>
          <div>
            <FieldLabel>Attribution</FieldLabel>
            <Input
              className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              placeholder="Name or source (optional)"
              value={block.quoteAttribution ?? ""}
              onChange={(e) => onPatch({ quoteAttribution: e.target.value.trim() ? e.target.value : undefined })}
            />
          </div>
          <div>
            <FieldLabel>Quote style</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["simple", "card"] as const).map((s) => (
                <button key={s} type="button" className={chipBtn((block.quoteStyle ?? "simple") === s)} onClick={() => onPatch({ quoteStyle: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
      {preset === "verse" ? (
        <div>
          <FieldLabel>Line spacing</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["compact", "relaxed"] as const).map((s) => (
              <button key={s} type="button" className={chipBtn((block.verseSpacing ?? "relaxed") === s)} onClick={() => onPatch({ verseSpacing: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <StoryBlockRowLayoutInspector
        rowLayout={effectiveRowLayoutForRichText(block.rowLayout)}
        onPatch={(patch) => onPatchRowLayout({ ...patch, displayMode: "block", float: undefined })}
        touchComfort={touchComfort}
      />
    </div>
  );
}

const DIVIDER_PRESET_OPTIONS: StoryDividerVariant[] = ["line", "ornamental", "spacer", "sectionBreak"];

function DividerBlockInspector({
  block,
  onPatch,
  onPatchRowLayout,
  touchComfort,
}: {
  block: StoryDividerBlock;
  onPatch: (patch: StoryDividerMetaPatch) => void;
  onPatchRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  touchComfort?: boolean;
}) {
  const pr = getStoryDividerPreset(block);
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Divider preset</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIVIDER_PRESET_OPTIONS.map((p) => (
            <button key={p} type="button" className={chipBtn(pr === p)} onClick={() => onPatch({ preset: p, variant: p })}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {pr === "spacer" ? (
        <div>
          <FieldLabel>Height (rem)</FieldLabel>
          <Input
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={block.spacerRem ?? 2}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onPatch({ spacerRem: Math.min(24, Math.max(0.5, n)) });
            }}
          />
        </div>
      ) : null}
      {pr === "ornamental" ? (
        <div>
          <FieldLabel>Ornamental style</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["diamonds", "dots"] as const).map((s) => (
              <button key={s} type="button" className={chipBtn((block.ornamentalStyle ?? "diamonds") === s)} onClick={() => onPatch({ ornamentalStyle: s })}>
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {pr !== "spacer" ? (
        <div>
          <FieldLabel>Thickness (px)</FieldLabel>
          <Input
            type="number"
            min={1}
            max={8}
            step={1}
            className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={block.dividerThicknessPx ?? 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onPatch({ dividerThicknessPx: Math.min(8, Math.max(1, Math.round(n))) });
            }}
          />
        </div>
      ) : null}
      <StoryBlockRowLayoutInspector rowLayout={effectiveRowLayout(block.rowLayout)} onPatch={onPatchRowLayout} touchComfort={touchComfort} />
    </div>
  );
}

function InspectorBlockTabContent({
  storyId,
  selectedBlock,
  columnsLayoutBlock,
  columnsNestingDepth,
  onPatchColumns,
  onPatchColumnSlot,
  onPatchEmbed,
  onPatchMedia,
  onPatchContainer,
  onPatchBlockRowLayout,
  onPatchBlockDesign,
  onPatchBlockDateAnnotation,
  onPatchRichTextMeta,
  onPatchDividerMeta,
  onDeleteBlock,
  touchComfort,
}: {
  storyId: string;
  selectedBlock: StoryBlock | null;
  columnsLayoutBlock: StoryColumnsBlock | null;
  columnsNestingDepth: number;
  onPatchColumns?: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>) => void;
  onPatchColumnSlot?: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  onPatchEmbed: (patch: Partial<StoryEmbedBlock>) => void;
  onPatchMedia: (patch: Partial<StoryMediaBlock>) => void;
  onPatchContainer?: (patch: Partial<StoryContainerBlockProps>) => void;
  onPatchBlockRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  onPatchBlockDesign: (patch: Partial<StoryBlockDesign> | null) => void;
  onPatchBlockDateAnnotation?: (next: StoryBlockDateAnnotation | undefined) => void;
  onPatchRichTextMeta?: (patch: StoryRichTextMetaPatch) => void;
  onPatchDividerMeta?: (patch: StoryDividerMetaPatch) => void;
  onDeleteBlock?: () => void;
  touchComfort?: boolean;
}) {
  return (
    <>
      {columnsLayoutBlock && onPatchColumns && onPatchColumnSlot ? (
        <ColumnsLayoutInspector
          block={columnsLayoutBlock}
          nestingDepth={columnsNestingDepth}
          onPatch={onPatchColumns}
          onPatchColumnSlot={onPatchColumnSlot}
          touchComfort={touchComfort}
        />
      ) : null}
      {selectedBlock?.type === "media" ? (
        <MediaBlockInspector
          storyId={storyId}
          block={selectedBlock}
          onPatch={onPatchMedia}
          touchComfort={touchComfort}
        />
      ) : selectedBlock?.type === "embed" ? (
        <OtherEmbedInspector block={selectedBlock} onPatch={onPatchEmbed} touchComfort={touchComfort} />
      ) : selectedBlock?.type === "container" && onPatchContainer ? (
        <ContainerLayoutInspector block={selectedBlock} onPatch={onPatchContainer} touchComfort={touchComfort} />
      ) : selectedBlock?.type === "columns" ? (
        <HelperCard title="Columns (2)">
          Each column can stack rich text, media from the library, and embed blocks. Add blocks on the canvas; adjust
          widths, gaps, and per-column layout in the sections above.
        </HelperCard>
      ) : selectedBlock?.type === "richText" ? (
        <div className="space-y-4">
          {onPatchRichTextMeta ? (
            <>
              <HelperCard title="Rich text">
                Use the global toolbar for inline formatting (bold, links, highlight). Preset controls the block role and
                editor styling—structural TipTap commands stay in the canvas, not here.
              </HelperCard>
              <RichTextBlockInspector
                block={selectedBlock}
                onPatch={onPatchRichTextMeta}
                onPatchRowLayout={onPatchBlockRowLayout}
                touchComfort={touchComfort}
              />
            </>
          ) : (
            <StoryBlockRowLayoutInspector
              rowLayout={effectiveRowLayoutForRichText(selectedBlock.rowLayout)}
              onPatch={(patch) => onPatchBlockRowLayout({ ...patch, displayMode: "block", float: undefined })}
              touchComfort={touchComfort}
            />
          )}
        </div>
      ) : selectedBlock?.type === "divider" ? (
        <div className="space-y-4">
          {onPatchDividerMeta ? (
            <>
              <HelperCard title="Divider / spacer">
                Spacers publish as whitespace only. Line, ornamental, and section break render visibly on the live site.
              </HelperCard>
              <DividerBlockInspector
                block={selectedBlock}
                onPatch={onPatchDividerMeta}
                onPatchRowLayout={onPatchBlockRowLayout}
                touchComfort={touchComfort}
              />
            </>
          ) : (
            <HelperCard title="Divider">Select this block on the canvas to adjust presets when the editor provides patch handlers.</HelperCard>
          )}
        </div>
      ) : selectedBlock?.type === "table" ? (
        <HelperCard title="Table (custom grid)">
          Scaffold block: rows, columns, and plain-text cells. Editing tools will be added later; content is stored as
          plain strings (safe for preview).
        </HelperCard>
      ) : selectedBlock?.type === "splitContent" ? (
        <HelperCard title="Split content">
          Primary rich text plus a supporting rail for media, embeds, tables, and layout blocks. Wrap-around layout is
          scaffolded for a later pass.
        </HelperCard>
      ) : columnsLayoutBlock ? null : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-base-content/15 bg-base-100/40 px-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-base-200/80 ring-1 ring-base-content/10">
            <Info className="size-6 text-base-content/35" aria-hidden />
          </div>
          <p className="max-w-[220px] text-sm leading-relaxed text-base-content/60">
            Select a block in the editor to edit layout, media, and metadata here.
          </p>
        </div>
      )}
      {selectedBlock && onPatchBlockDateAnnotation ? (
        <div className="mt-6 border-t border-base-content/10 pt-6">
          <BlockDateAnnotationInspector
            annotation={selectedBlock.dateAnnotation}
            onCommit={onPatchBlockDateAnnotation}
            touchComfort={touchComfort}
          />
        </div>
      ) : null}
      {selectedBlock ? (
        <div className="mt-6 border-t border-base-content/10 pt-6">
          <StoryBlockDesignInspector
            blockId={selectedBlock.id}
            design={selectedBlock.design}
            onPatchDesign={onPatchBlockDesign}
            touchComfort={touchComfort}
          />
        </div>
      ) : null}
      {selectedBlock && onDeleteBlock ? (
        <div className="border-t border-base-content/10 pt-6">
          <CollapsibleFormSection title="Danger zone" defaultOpen={false}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "w-full gap-2 rounded-lg border-error/40 font-medium text-error hover:border-error/55 hover:bg-error/10",
                touchComfort ? "min-h-[44px] h-11" : "h-10",
              )}
              onClick={onDeleteBlock}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete block
            </Button>
          </CollapsibleFormSection>
        </div>
      ) : null}
    </>
  );
}

export function StoryCreatorInspector({
  doc,
  storyId,
  inspectorTab,
  onInspectorTab,
  selectedBlock,
  selectedBlockId = null,
  storyEditorDirty = false,
  columnsLayoutBlock,
  columnsNestingDepth,
  onPatchColumns,
  onPatchColumnSlot,
  onPatchEmbed,
  onPatchMedia,
  onPatchContainer,
  onPatchBlockRowLayout,
  onPatchBlockDesign,
  onPatchBlockDateAnnotation,
  onPatchRichTextMeta,
  onPatchDividerMeta,
  onTitleChange,
  onExcerptChange,
  onStoryMetaChange,
  onDeleteBlock,
  className,
  layout = "sidebar",
}: {
  doc: StoryDocument;
  storyId: string;
  inspectorTab: StoryInspectorTab;
  onInspectorTab: (t: StoryInspectorTab) => void;
  selectedBlock: StoryBlock | null;
  /** Block id in the active section (for Debug tab). */
  selectedBlockId?: string | null;
  /** True when in-memory document differs from last localStorage save. */
  storyEditorDirty?: boolean;
  columnsLayoutBlock?: StoryColumnsBlock | null;
  /** Depth of the columns block shown in the layout inspector (1 or 2). */
  columnsNestingDepth?: number;
  onPatchColumns?: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>) => void;
  onPatchColumnSlot?: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  onPatchEmbed: (patch: Partial<StoryEmbedBlock>) => void;
  onPatchMedia: (patch: Partial<StoryMediaBlock>) => void;
  onPatchContainer?: (patch: Partial<StoryContainerBlockProps>) => void;
  onPatchBlockRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  onPatchBlockDesign: (patch: Partial<StoryBlockDesign> | null) => void;
  onPatchBlockDateAnnotation?: (next: StoryBlockDateAnnotation | undefined) => void;
  onPatchRichTextMeta?: (patch: StoryRichTextMetaPatch) => void;
  onPatchDividerMeta?: (patch: StoryDividerMetaPatch) => void;
  onTitleChange: (title: string) => void;
  onExcerptChange: (excerpt: string) => void;
  onStoryMetaChange?: (patch: StoryDocumentMetaPatch) => void;
  onDeleteBlock?: () => void;
  className?: string;
  layout?: StoryInspectorLayout;
}) {
  const storyMeta = onStoryMetaChange ?? (() => {});
  if (layout === "sheet-block") {
    return (
      <div className={cn("flex min-h-0 w-full flex-col bg-transparent", className)}>
        <div className="min-h-0 flex-1 space-y-6">
          <InspectorBlockTabContent
            storyId={storyId}
            selectedBlock={selectedBlock}
            columnsLayoutBlock={columnsLayoutBlock ?? null}
            columnsNestingDepth={columnsNestingDepth ?? 1}
            onPatchColumns={onPatchColumns}
            onPatchColumnSlot={onPatchColumnSlot}
            onPatchEmbed={onPatchEmbed}
            onPatchMedia={onPatchMedia}
            onPatchContainer={onPatchContainer}
            onPatchBlockRowLayout={onPatchBlockRowLayout}
            onPatchBlockDesign={onPatchBlockDesign}
            onPatchBlockDateAnnotation={onPatchBlockDateAnnotation}
            onPatchRichTextMeta={onPatchRichTextMeta}
            onPatchDividerMeta={onPatchDividerMeta}
            onDeleteBlock={onDeleteBlock}
            touchComfort
          />
        </div>
      </div>
    );
  }

  if (layout === "sheet-story") {
    return (
      <StoryInspectorSheetStoryOrDebug
        className={className}
        storyId={storyId}
        doc={doc}
        onTitleChange={onTitleChange}
        onExcerptChange={onExcerptChange}
        onStoryMetaChange={storyMeta}
        selectedBlockId={selectedBlockId}
        selectedBlock={selectedBlock}
        storyEditorDirty={storyEditorDirty}
        touchComfort
      />
    );
  }

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full min-w-0 shrink-0 flex-col border-l border-base-content/10 bg-base-200/45 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex shrink-0 gap-1 border-b border-base-content/10 p-2.5">
        <button
          type="button"
          onClick={() => onInspectorTab("block")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            inspectorTab === "block"
              ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
              : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
          )}
        >
          Block
        </button>
        <button
          type="button"
          onClick={() => onInspectorTab("story")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            inspectorTab === "story"
              ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
              : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
          )}
        >
          Story
        </button>
        <button
          type="button"
          onClick={() => onInspectorTab("debug")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-lg py-2.5 text-sm font-semibold transition-colors",
            inspectorTab === "debug"
              ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
              : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
          )}
          title="Debug"
        >
          <Bug className="size-3.5 shrink-0 opacity-80 max-[340px]:hidden" aria-hidden />
          <span className="truncate">Debug</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {inspectorTab === "story" ? (
          <InspectorStoryTabContent
            doc={doc}
            storyId={storyId}
            onTitleChange={onTitleChange}
            onExcerptChange={onExcerptChange}
            onStoryMetaChange={storyMeta}
          />
        ) : inspectorTab === "debug" ? (
          <InspectorDebugTabContent
            doc={doc}
            selectedBlockId={selectedBlockId}
            selectedBlock={selectedBlock}
            storyEditorDirty={storyEditorDirty}
          />
        ) : (
          <InspectorBlockTabContent
            storyId={storyId}
            selectedBlock={selectedBlock}
            columnsLayoutBlock={columnsLayoutBlock ?? null}
            columnsNestingDepth={columnsNestingDepth ?? 1}
            onPatchColumns={onPatchColumns}
            onPatchColumnSlot={onPatchColumnSlot}
            onPatchEmbed={onPatchEmbed}
            onPatchMedia={onPatchMedia}
            onPatchContainer={onPatchContainer}
            onPatchBlockRowLayout={onPatchBlockRowLayout}
            onPatchBlockDesign={onPatchBlockDesign}
            onPatchBlockDateAnnotation={onPatchBlockDateAnnotation}
            onPatchRichTextMeta={onPatchRichTextMeta}
            onPatchDividerMeta={onPatchDividerMeta}
            onDeleteBlock={onDeleteBlock}
          />
        )}
      </div>
    </aside>
  );
}

const ROW_WIDTH_MODE_OPTIONS: { value: StoryBlockWidthMode; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "wide", label: "Wide" },
  { value: "medium", label: "Medium" },
  { value: "narrow", label: "Narrow" },
  { value: "custom", label: "Custom" },
];

const ROW_ALIGN_OPTIONS: { value: StoryBlockRowAlignment; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
];

function StoryBlockRowLayoutInspector({
  rowLayout,
  onPatch,
  touchComfort,
}: {
  rowLayout: StoryBlockRowLayout | undefined;
  onPatch: (patch: Partial<StoryBlockRowLayout>) => void;
  touchComfort?: boolean;
}) {
  const rl = effectiveRowLayout(rowLayout);
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );

  return (
    <div className="space-y-4">
      <CollapsibleFormSection title="Block width" defaultOpen>
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">
          Controls how wide this block sits in the story column. Media and embed blocks use the Size & alignment section
          instead.
        </p>
        <FieldLabel>Width preset</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROW_WIDTH_MODE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={chipBtn(rl.widthMode === value)}
              onClick={() => onPatch({ widthMode: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {rl.widthMode === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <FieldLabel>Value</FieldLabel>
              <Input
                type="number"
                min={1}
                max={9999}
                step={1}
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={rl.widthValue ?? 100}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onPatch({ widthValue: Number.isFinite(n) ? n : undefined });
                }}
              />
            </div>
            <div className="w-28">
              <FieldLabel>Unit</FieldLabel>
              <select
                className={cn(
                  "select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100",
                  controlH,
                )}
                value={rl.widthUnit ?? "%"}
                onChange={(e) => onPatch({ widthUnit: e.target.value as StoryBlockWidthUnit })}
              >
                <option value="%">%</option>
                <option value="px">px</option>
              </select>
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <FieldLabel>Alignment in column</FieldLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROW_ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => onPatch({ alignment: value })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  touchComfort ? "min-h-[44px] py-2" : "py-2.5",
                  rl.alignment === value
                    ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                    : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}

const MEDIA_EMBED_STANDALONE_SIZE_OPTIONS: { value: StoryEmbedWidthPreset; label: string; hint: string }[] = [
  { value: "full", label: "Full", hint: "Full story column width" },
  { value: "large", label: "Large", hint: "Default emphasis width" },
  { value: "medium", label: "Medium", hint: "Comfortable reading width" },
  { value: "small", label: "Small", hint: "Narrow inset" },
  { value: "content", label: "Content", hint: "Matches text column" },
];

const STORY_MEDIA_EMBED_LAYOUT_ALIGN_OPTIONS: { value: StoryEmbedLayoutAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
];

/** Standalone media/embed: size + column alignment only (no text wrap / float row controls). */
function StandaloneMediaEmbedLayoutInspectorSection({
  block,
  onPatchLayout,
  touchComfort,
}: {
  block: StoryMediaBlock | StoryEmbedBlock;
  onPatchLayout: (p: Partial<StoryMediaBlock> | Partial<StoryEmbedBlock>) => void;
  touchComfort?: boolean;
}) {
  const width = block.widthPreset ?? "large";
  const layoutAlign = block.layoutAlign ?? "center";
  const controlH = touchComfort ? "min-h-11 h-11" : "h-10";

  return (
    <CollapsibleFormSection title="Size & alignment" defaultOpen>
      <p className="mb-3 text-xs leading-relaxed text-base-content/55">
        Standalone blocks use a simple column width and alignment. For text flowing around media or embeds, add a{" "}
        <span className="font-medium text-base-content/75">Split content</span> block instead.
      </p>
      <FieldLabel>Size</FieldLabel>
      <p className="mb-2 text-[11px] leading-relaxed text-base-content/50">How wide the frame appears in the story column.</p>
      <select
        className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
        value={width}
        onChange={(e) =>
          onPatchLayout(standaloneMediaEmbedLayoutPatch(block, { widthPreset: e.target.value as StoryEmbedWidthPreset }))
        }
      >
        {MEDIA_EMBED_STANDALONE_SIZE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} — {o.hint}
          </option>
        ))}
      </select>
      <div className="mt-4">
        <FieldLabel>Alignment in column</FieldLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {STORY_MEDIA_EMBED_LAYOUT_ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => onPatchLayout(standaloneMediaEmbedLayoutPatch(block, { layoutAlign: value }))}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wide transition-colors",
                touchComfort ? "min-h-[44px] py-2" : "py-2.5",
                layoutAlign === value
                  ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                  : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </CollapsibleFormSection>
  );
}

function MediaBlockInspector({
  storyId,
  block,
  onPatch,
  touchComfort,
}: {
  storyId: string;
  block: StoryMediaBlock;
  onPatch: (p: Partial<StoryMediaBlock>) => void;
  touchComfort?: boolean;
}) {
  const { data, isLoading } = useStoryMediaById(block.mediaId);
  const height = block.heightPreset ?? "default";
  const linkMode = block.linkMode ?? "none";
  const titlePlacement = block.titlePlacement ?? "above";
  const captionPlacement = block.captionPlacement ?? "below";
  const textSectionOpenDefault = Boolean(block.label?.trim() || block.caption?.trim());

  const thumb =
    data?.fileRef != null && data.fileRef !== ""
      ? mediaThumbSrc(data.fileRef, data.form, 160) ?? resolveMediaImageSrc(data.fileRef)
      : null;

  const filename = basenameFromFileRef(data?.fileRef ?? undefined);
  const controlH = touchComfort ? "min-h-[44px] h-11" : "h-10";

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Media block</p>

      <CollapsibleFormSection title="Media / source" defaultOpen>
        <FieldLabel>Preview</FieldLabel>
        <div className="mt-3 flex gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-base-content/10 bg-base-200/50">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center p-1 text-center text-[10px] leading-tight text-base-content/45">
                {isLoading && block.mediaId ? "…" : "None"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-xs leading-snug text-base-content/60">
            {data?.title ? <p className="font-medium text-base-content">{data.title}</p> : null}
            {filename ? (
              <p className="mt-1 font-mono text-[11px] text-base-content/55">
                <span className="font-semibold text-base-content/45">File: </span>
                {filename}
              </p>
            ) : null}
            {data?.form ? (
              <p className="mt-0.5">
                <span className="font-semibold text-base-content/45">Type: </span>
                {data.form}
              </p>
            ) : null}
            <p className="mt-1 text-[11px] text-base-content/50">Dimensions and alt text are not loaded from the server in this draft yet.</p>
            {!block.mediaId ? <p className="mt-1 text-base-content/55">No file attached yet.</p> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <MediaPicker
            targetType="story"
            targetId={storyId}
            mode="single"
            purpose="storyIllustration"
            triggerLabel={block.mediaId ? "Replace media" : "Select media"}
            triggerClassName={cn("rounded-lg border-base-content/12 px-3 font-medium", controlH)}
            onAttach={(items) => {
              const m = items[0];
              if (!m) return;
              onPatch({
                mediaId: m.id,
                label: m.title?.trim() ? m.title.trim() : block.label,
              });
            }}
          />
          {block.mediaId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("rounded-lg border-base-content/12 px-3 font-medium text-error hover:bg-error/10", controlH)}
              onClick={() => onPatch({ mediaId: undefined })}
            >
              Remove media
            </Button>
          ) : null}
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Text" defaultOpen={textSectionOpenDefault}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            placeholder="Optional display title"
            value={block.label ?? ""}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Caption</FieldLabel>
          <textarea
            className={cn(
              "textarea textarea-bordered textarea-sm mt-1 min-h-[88px] w-full resize-y rounded-lg border-base-content/12 bg-base-100 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-500",
              touchComfort && "min-h-[100px]",
            )}
            placeholder="Optional caption shown with the media…"
            value={block.caption ?? ""}
            onChange={(e) => onPatch({ caption: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <StoryTextPlacementGrid
            heading="Title position"
            value={titlePlacement}
            onPick={(v) => onPatch({ titlePlacement: v })}
            touchComfort={touchComfort}
          />
        </div>
        <div className="mt-4">
          <StoryTextPlacementGrid
            heading="Caption position"
            value={captionPlacement}
            onPick={(v) => onPatch({ captionPlacement: v })}
            touchComfort={touchComfort}
          />
        </div>
      </CollapsibleFormSection>

      <StandaloneMediaEmbedLayoutInspectorSection block={block} onPatchLayout={(p) => onPatch(p as Partial<StoryMediaBlock>)} touchComfort={touchComfort} />

      <CollapsibleFormSection title="Appearance" defaultOpen={false}>
        <FieldLabel>Media height</FieldLabel>
        <p className="mb-2 text-xs text-base-content/55">Controls the placeholder frame height in the editor and preview.</p>
        <select
          className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          value={height}
          onChange={(e) => onPatch({ heightPreset: e.target.value as StoryEmbedHeightPreset })}
        >
          {HEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Link / interaction" defaultOpen={false}>
        <FieldLabel>Link behavior</FieldLabel>
        <p className="mb-2 text-xs text-base-content/55">Used when this block links to media or an external target (future site behavior).</p>
        <select
          className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          value={linkMode}
          onChange={(e) => onPatch({ linkMode: e.target.value as StoryEmbedLinkMode })}
        >
          {LINK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <FieldLabel>Block ID</FieldLabel>
        <input readOnly className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs", controlH)} value={block.id} />
        <div className="mt-3">
          <FieldLabel>Stored type</FieldLabel>
          <p className="mt-1 rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 font-mono text-xs text-base-content/75">media</p>
        </div>
        <div className="mt-3">
          <FieldLabel>Legacy layout snapshot</FieldLabel>
          <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-base-content/50">
            widthPreset={block.widthPreset ?? "—"} · layoutAlign={block.layoutAlign ?? "—"} · textWrap=
            {String(block.textWrap ?? false)} · fullWidth={String(block.fullWidth ?? false)}
          </p>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}

function OtherEmbedInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StoryEmbedBlock;
  onPatch: (p: Partial<StoryEmbedBlock>) => void;
  touchComfort?: boolean;
}) {
  const height = block.heightPreset ?? "default";
  const linkMode = block.linkMode ?? "none";
  const titlePlacement = block.titlePlacement ?? "above";
  const captionPlacement = block.captionPlacement ?? "below";
  const textSectionOpenDefault = Boolean(block.label?.trim() || block.caption?.trim() || block.sublabel?.trim());
  const controlH = touchComfort ? "min-h-[44px] h-11" : "h-10";

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Embed block</p>

      <CollapsibleFormSection title="Source" defaultOpen>
        <FieldLabel>Preview</FieldLabel>
        <div className="mt-2 rounded-xl border border-base-content/10 bg-base-100/70 p-3 shadow-sm ring-1 ring-base-content/[0.04]">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-base-300 via-base-300/90 to-base-200/80 shadow-inner ring-1 ring-base-content/[0.06]">
            <div
              className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.04)_50%,transparent_60%)]"
              aria-hidden
            />
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-base-content">{block.label || "Untitled embed"}</p>
          <p className="mt-0.5 truncate text-xs text-base-content/50">{block.embedKind} · local draft</p>
        </div>
        <div className="mt-4">
          <FieldLabel>Embed type</FieldLabel>
          <select
            className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={block.embedKind}
            onChange={(e) => onPatch({ embedKind: e.target.value as StoryGeneralEmbedKind })}
          >
            {OTHER_EMBED_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-base-content/55">
            For library photos and files, use a <span className="font-medium text-base-content/75">Media</span> block instead.
          </p>
        </div>
        <p className="mt-3 text-xs text-base-content/50">
          Configure / wire embed content on the canvas when that flow is available; this draft stores type and labels only.
        </p>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Text" defaultOpen={textSectionOpenDefault}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={block.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Subtitle</FieldLabel>
          <input
            className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            placeholder="Optional short line under the title"
            value={block.sublabel ?? ""}
            onChange={(e) => onPatch({ sublabel: e.target.value || undefined })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Caption</FieldLabel>
          <textarea
            className={cn(
              "textarea textarea-bordered textarea-sm mt-1 min-h-[80px] w-full resize-y rounded-lg border-base-content/12 bg-base-100 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-500",
              touchComfort && "min-h-[100px]",
            )}
            placeholder="Optional caption…"
            value={block.caption ?? ""}
            onChange={(e) => onPatch({ caption: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <StoryTextPlacementGrid
            heading="Title position"
            value={titlePlacement}
            onPick={(v) => onPatch({ titlePlacement: v })}
            touchComfort={touchComfort}
          />
        </div>
        <div className="mt-4">
          <StoryTextPlacementGrid
            heading="Caption position"
            value={captionPlacement}
            onPick={(v) => onPatch({ captionPlacement: v })}
            touchComfort={touchComfort}
          />
        </div>
      </CollapsibleFormSection>

      <StandaloneMediaEmbedLayoutInspectorSection block={block} onPatchLayout={(p) => onPatch(p as Partial<StoryEmbedBlock>)} touchComfort={touchComfort} />

      <CollapsibleFormSection title="Appearance" defaultOpen={false}>
        <FieldLabel>Embed height</FieldLabel>
        <p className="mb-2 text-xs text-base-content/55">Placeholder frame height in the editor and preview.</p>
        <select
          className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          value={height}
          onChange={(e) => onPatch({ heightPreset: e.target.value as StoryEmbedHeightPreset })}
        >
          {HEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Link / interaction" defaultOpen={false}>
        <FieldLabel>Link behavior</FieldLabel>
        <select
          className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          value={linkMode}
          onChange={(e) => onPatch({ linkMode: e.target.value as StoryEmbedLinkMode })}
        >
          {LINK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <FieldLabel>Block ID</FieldLabel>
        <input readOnly className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs", controlH)} value={block.id} />
        <div className="mt-3">
          <FieldLabel>Stored type</FieldLabel>
          <p className="mt-1 rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 font-mono text-xs text-base-content/75">embed</p>
        </div>
        <div className="mt-3">
          <FieldLabel>Legacy layout snapshot</FieldLabel>
          <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-base-content/50">
            widthPreset={block.widthPreset ?? "—"} · layoutAlign={block.layoutAlign ?? "—"} · textWrap=
            {String(block.textWrap ?? false)} · fullWidth={String(block.fullWidth ?? false)}
          </p>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}
