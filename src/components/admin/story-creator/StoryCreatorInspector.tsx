"use client";

import { useCallback, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { StoryFlowNodeSelection } from "@/features/story-creator/state/storyEditorTypes";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
  StoryBlockPlaceAnnotation,
  StoryBlockDesign,
  StoryBlockRowAlignment,
  StoryBlockRowLayout,
  StoryBlockWidthMode,
  StoryBlockWidthUnit,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsMobileBehavior,
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
  StoryEmbedLayoutAlign,
  StoryEmbedLinkMode,
  StoryEventEmbedData,
  StoryFamilyGroupEmbedData,
  StoryGalleryEmbedData,
  StoryGeneralEmbedKind,
  StoryImageMediaRef,
  StoryMapEmbedData,
  StoryMediaBlock,
  StoryPersonSpotlightEmbedData,
  StoryPersonSpotlightField,
  StoryRichTextBlock,
  StoryTreeEmbedData,
  StoryTreeCardVariant,
  StoryTreeCardLayout,
  StoryTreeCompactCardSize,
  StoryRecipeEmbedData,
  StoryDividerBlock,
  StoryDividerVariant,
  StoryRichTextTextPreset,
  StoryVerseLineLayout,
  StoryContainerPreset,
  StoryContainerWidth,
  StorySplitContentBlock,
  StoryTableBlock,
  StorySection,
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
import { standaloneMediaEmbedLayoutPatch, mergeMediaEmbedRowLayoutPatch, effectiveMediaEmbedInspectorRowLayout, layoutAlignToRowAlignment } from "@/lib/admin/story-creator/story-media-embed-layout-sync";
import { STORY_TEXT_PLACEMENT_OPTIONS } from "@/lib/admin/story-creator/story-block-text-layout";
import type { StoryDividerMetaPatch, StoryRichTextMetaPatch } from "@/lib/admin/story-creator/story-doc-mutators";
import {
  normalizeColumnWidthPercents,
  advancedColumnLayoutEnabled,
  resolveColumnGapRem,
  resolveColumnStackGapRem,
  resolveColumnStackJustify,
  resolveColumnsMobileBehavior,
  resolveColumnWidthPercents,
  STORY_COLUMN_STACK_GAP_PRESETS,
  STORY_COLUMN_STACK_JUSTIFY_PRESETS,
  STORY_COLUMNS_GAP_PRESETS,
} from "@/lib/admin/story-creator/story-columns-layout";
import { MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import { resolveContainerVisualProps } from "@/lib/admin/story-creator/story-container-preset-styles";
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
  UserCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { FamilySearchPicker } from "@/components/admin/FamilySearchPicker";
import { EventPicker } from "@/components/admin/EventPicker";
import { EventPickerModal } from "@/components/admin/EventPickerModal";
import { TagsPicker } from "@/components/admin/TagsPicker";
import { AlbumsPicker } from "@/components/admin/AlbumsPicker";
import { formatNoteEventPickerLabel } from "@/lib/forms/note-event-picker-label";
import { displayTagName } from "@/lib/admin/display-tag-name";
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
import { StoryBlockInspector } from "@/components/admin/story-creator/inspector/StoryBlockInspector";
import { StorySettingsInspector } from "@/components/admin/story-creator/inspector/StorySettingsInspector";
import { StoryDebugInspector } from "@/components/admin/story-creator/inspector/StoryDebugInspector";
import { StoryCaptionRichTextEditor } from "@/components/admin/story-creator/StoryCaptionRichText";
import { StoryTipTapEditor } from "@/components/admin/story-creator/StoryTipTapEditor";
import { verseTextFromTipTapDoc } from "@/lib/admin/story-creator/story-verse";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export type StoryInspectorTab = "block" | "story" | "debug";

/** `sidebar`: desktop right rail. `sheet-block` / `sheet-story`: mobile full-width panels without tab chrome. */
export type StoryInspectorLayout = "sidebar" | "sheet-block" | "sheet-story";

const LINK_OPTIONS: { value: StoryEmbedLinkMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "same_window", label: "Same window" },
  { value: "new_tab", label: "New tab" },
];

const OTHER_EMBED_KINDS: StoryGeneralEmbedKind[] = [
  "document",
  "timeline",
  "map",
  "tree",
  "graph",
  "gallery",
  "personSpotlight",
  "familyGroup",
  "event",
  "recipe",
];

const TREE_CHART_TYPES: NonNullable<StoryTreeEmbedData["chartType"]>[] = ["pedigree", "verticalPedigree", "descendancy", "fan"];
const PERSON_SPOTLIGHT_FIELDS: StoryPersonSpotlightField[] = [
  "profileImage",
  "name",
  "birthDate",
  "deathDate",
  "age",
  "lifespan",
  "birthPlace",
  "deathPlace",
  "parents",
  "spouses",
  "children",
  "custom",
];
const GALLERY_SOURCE_TYPES: StoryGalleryEmbedData["sourceType"][] = ["album", "personMedia", "familyMedia", "eventMedia", "tag", "custom"];
const MAP_MODES: NonNullable<StoryMapEmbedData["mapMode"]>[] = ["events", "lifeRoute", "familyMigration", "custom"];

const EMBED_KIND_LABELS: Record<StoryGeneralEmbedKind, string> = {
  document: "Document",
  timeline: "Timeline",
  map: "Map",
  tree: "Family tree",
  graph: "Graph",
  gallery: "Photo gallery",
  personSpotlight: "Person spotlight",
  familyGroup: "Family group",
  event: "Event",
  recipe: "Recipe",
};

const TREE_CHART_TYPE_LABELS: Record<NonNullable<StoryTreeEmbedData["chartType"]>, string> = {
  pedigree: "Pedigree",
  verticalPedigree: "Vertical pedigree",
  descendancy: "Descendants",
  fan: "Fan chart",
};

const TREE_CARD_VARIANTS: StoryTreeCardVariant[] = ["full", "compact-name", "compact-avatar"];
const TREE_CARD_VARIANT_LABELS: Record<StoryTreeCardVariant, string> = {
  full: "Full",
  "compact-name": "Name only",
  "compact-avatar": "Name + avatar",
};

const TREE_CARD_LAYOUTS: StoryTreeCardLayout[] = [
  "avatarTopActionsBottom",
  "avatarLeftActionsRight",
  "avatarLeftActionsBottom",
  "avatarTopActionsRight",
  "avatarTopMobileMenu",
  "avatarLeftMobileMenu",
];
const TREE_CARD_LAYOUT_LABELS: Record<StoryTreeCardLayout, string> = {
  avatarTopActionsBottom: "Avatar top · Actions bottom",
  avatarLeftActionsRight: "Avatar left · Actions right",
  avatarLeftActionsBottom: "Avatar left · Actions bottom",
  avatarTopActionsRight: "Avatar top · Actions right",
  avatarTopMobileMenu: "Avatar top · Menu",
  avatarLeftMobileMenu: "Avatar left · Menu",
};

const TREE_COMPACT_SIZES: StoryTreeCompactCardSize[] = ["large", "medium", "small", "extra-small"];
const TREE_COMPACT_SIZE_LABELS: Record<StoryTreeCompactCardSize, string> = {
  large: "Large",
  medium: "Medium",
  small: "Small",
  "extra-small": "Extra small",
};

const PERSON_SPOTLIGHT_FIELD_LABELS: Record<StoryPersonSpotlightField, string> = {
  profileImage: "Profile photo",
  name: "Full name",
  birthDate: "Birth date",
  deathDate: "Death date",
  age: "Age",
  lifespan: "Lifespan",
  birthPlace: "Birth place",
  deathPlace: "Death place",
  parents: "Parents",
  spouses: "Spouses",
  children: "Children",
  custom: "Custom fields",
};

const GALLERY_SOURCE_TYPE_LABELS: Record<StoryGalleryEmbedData["sourceType"], string> = {
  album: "Album",
  personMedia: "Person's photos",
  familyMedia: "Family photos",
  eventMedia: "Event photos",
  tag: "Tagged photos",
  custom: "Custom selection",
};

const MAP_MODE_LABELS: Record<NonNullable<StoryMapEmbedData["mapMode"]>, string> = {
  events: "Events",
  lifeRoute: "Life route",
  familyMigration: "Family migration",
  custom: "Custom",
};
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">{children}</p>;
}

type CustomField = NonNullable<StoryPersonSpotlightEmbedData["customFields"]>[number];

function CustomFieldsEditor({
  customFields,
  onChange,
}: {
  customFields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftValue, setDraftValue] = useState("");

  const canAdd = draftLabel.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([...customFields, { label: draftLabel.trim(), value: draftValue.trim() || undefined }]);
    setDraftLabel("");
    setDraftValue("");
  };

  return (
    <div className="mt-4 rounded-lg border border-base-content/12 bg-base-100 p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-content/50">Custom fields</p>

      {customFields.length > 0 ? (
        <div className="mb-3 space-y-1.5">
          {customFields.map((cf, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-base-content">{cf.label}</span>
                {cf.value ? (
                  <span className="ml-2 text-xs text-base-content/55">{cf.value}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-base-content/40 hover:bg-error/10 hover:text-error"
                onClick={() => onChange(customFields.filter((_, j) => j !== i))}
                aria-label={`Remove ${cf.label}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-base-content/45">No custom fields yet.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-xs text-base-content/50">Label</p>
          <input
            className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
            placeholder="e.g. Occupation"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-base-content/50">Value</p>
          <input
            className="input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100"
            placeholder="e.g. Schoolteacher"
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
        </div>
      </div>
      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-base-content/15 bg-base-200/50 px-2.5 py-1 text-xs font-medium text-base-content/70 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-3" />
        Add field
      </button>
    </div>
  );
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
      <div className="grid grid-cols-2 gap-2">
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

export function HelperCard({ title, children }: { title: string; children: React.ReactNode }) {
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

function nestedBlockShortSummary(nb: StoryColumnNestedBlock): string {
  if (nb.type === "richText") return "Text";
  if (nb.type === "media") return "Media";
  if (nb.type === "columns") return "Columns";
  if (nb.type === "container") return "Container";
  if (nb.type === "table") return "Table";
  if (nb.type === "splitContent") return "Split";
  return "Embed";
}

function columnSlotSummary(slot: StoryColumnsBlock["columns"][0]): string {
  const n = slot.blocks.length;
  if (n === 0) return "Empty";
  if (n === 1) return nestedBlockSummary(slot.blocks[0]!);
  if (n === 2) return `${nestedBlockShortSummary(slot.blocks[0]!)} + ${nestedBlockShortSummary(slot.blocks[1]!)}`;
  return `${n} blocks`;
}

function splitMatchesCurrent(current: [number, number], preset: [number, number]): boolean {
  return Math.abs(current[0] - preset[0]) <= 1 && Math.abs(current[1] - preset[1]) <= 1;
}

export function ColumnsLayoutInspector({
  block,
  nestingDepth,
  onPatch,
  onPatchColumnSlot,
  onEditColumnContent,
  onPatchBlockDateAnnotation,
  onDeleteBlock,
  touchComfort,
}: {
  block: StoryColumnsBlock;
  /** 1 = section-level columns, 2 = columns inside a column. */
  nestingDepth: number;
  onPatch: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem" | "mobileBehavior" | "advancedColumnLayoutEnabled">>) => void;
  onPatchColumnSlot: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  onEditColumnContent?: (columnIndex: 0 | 1) => void;
  onPatchBlockDateAnnotation?: (next: { dateAnnotations?: StoryBlockDateAnnotation[]; placeAnnotations?: StoryBlockPlaceAnnotation[] }) => void;
  onDeleteBlock?: () => void;
  touchComfort?: boolean;
}) {
  const [w0, w1] = resolveColumnWidthPercents(block);
  const gapRem = resolveColumnGapRem(block);
  const mobileBehavior = resolveColumnsMobileBehavior(block);
  const [contextPanel, setContextPanel] = useState<"datesPlaces" | null>(null);
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const current: [number, number] = [w0, w1];
  const advancedColumnLayout = advancedColumnLayoutEnabled(block);
  const sharedStackGap = resolveColumnStackGapRem(block.columns[0]);
  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );
  const widthPresets: { label: string; percents: [number, number] }[] = [
    { label: "Equal", percents: [50, 50] },
    { label: "Left wide", percents: [60, 40] },
    { label: "Right wide", percents: [40, 60] },
    { label: "Left feature", percents: [67, 33] },
    { label: "Right feature", percents: [33, 67] },
    { label: "Left narrow", percents: [25, 75] },
    { label: "Right narrow", percents: [75, 25] },
  ];
  const mobileOptions: { label: string; value: StoryColumnsMobileBehavior }[] = [
    { label: "Stack left first", value: "stackLeftFirst" },
    { label: "Stack right first", value: "stackRightFirst" },
    { label: "Keep side by side", value: "keepSideBySide" },
  ];
  const applySharedStackGap = (gap: number) => {
    onPatchColumnSlot(0, { stackGapRem: gap });
    onPatchColumnSlot(1, { stackGapRem: gap });
  };
  const dateCount = (block.dateAnnotations?.length ?? 0) + (block.dateAnnotations?.length ? 0 : block.dateAnnotation ? 1 : 0);
  const placeCount = block.placeAnnotations?.length ?? 0;
  const contextRows: Array<{ label: string; count: number; enabled: boolean }> = [
    { label: "People", count: 0, enabled: false },
    { label: "Families", count: 0, enabled: false },
    { label: "Events", count: 0, enabled: false },
    { label: "Places", count: placeCount, enabled: true },
    { label: "Dates", count: dateCount, enabled: true },
    { label: "Notes / Keywords", count: 0, enabled: false },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-base-content/10 bg-base-100/50 p-4 shadow-sm ring-1 ring-base-content/[0.03]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Columns</p>
            <h3 className="mt-1 text-sm font-semibold text-base-content">Display content in side-by-side columns.</h3>
          </div>
          <span className="rounded-full border border-base-content/10 bg-base-200/50 px-2.5 py-1 text-[11px] font-semibold text-base-content/60">
            Depth {nestingDepth} of {MAX_STORY_COLUMNS_NEST_DEPTH}
          </span>
        </div>
      </div>

      <CollapsibleFormSection title="Summary" defaultOpen>
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">Two side-by-side content areas.</p>
        <div className="overflow-hidden rounded-lg border border-base-content/10 bg-base-200/30 text-[11px] font-semibold text-base-content/70">
          <div className="flex h-9">
            <div className="flex items-center justify-center bg-primary/15 text-primary" style={{ width: `${w0}%` }}>
              Left {w0}%
            </div>
            <div className="flex items-center justify-center bg-base-100/80" style={{ width: `${w1}%` }}>
              Right {w1}%
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm">
          <p>
            <span className="font-semibold text-base-content">Left:</span>{" "}
            <span className="text-base-content/70">{columnSlotSummary(block.columns[0])}</span>
          </p>
          <p>
            <span className="font-semibold text-base-content">Right:</span>{" "}
            <span className="text-base-content/70">{columnSlotSummary(block.columns[1])}</span>
          </p>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Layout" defaultOpen>
        <FieldLabel>Column width balance</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {widthPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={chipBtn(splitMatchesCurrent(current, preset.percents))}
              onClick={() => onPatch({ columnWidthPercents: normalizeColumnWidthPercents(preset.percents) })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <FieldLabel>Custom balance</FieldLabel>
          <div className="mb-2 text-xs font-medium text-base-content/60">
            Left {w0}% · Right {w1}%
          </div>
          <input
            type="range"
            min={15}
            max={85}
            step={1}
            value={w0}
            className="range range-primary range-sm w-full"
            aria-valuetext={`Left ${w0}%, right ${w1}%`}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onPatch({ columnWidthPercents: normalizeColumnWidthPercents([next, 100 - next]) });
            }}
          />
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Spacing" defaultOpen>
        <div>
          <FieldLabel>Gap between columns</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {STORY_COLUMNS_GAP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={chipBtn(Math.abs(gapRem - preset.gapRem) < 0.05)}
                onClick={() => onPatch({ columnGapRem: preset.gapRem })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>Spacing inside columns</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {STORY_COLUMN_STACK_GAP_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={chipBtn(Math.abs(sharedStackGap - preset.gapRem) < 0.05)}
                onClick={() => applySharedStackGap(preset.gapRem)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Contents" defaultOpen>
        <div className="grid gap-3">
          {([0, 1] as const).map((colIdx) => (
            <ColumnContentsCard
              key={block.columns[colIdx].id}
              slot={block.columns[colIdx]}
              label={colIdx === 0 ? "Left Column" : "Right Column"}
              onEdit={() => onEditColumnContent?.(colIdx)}
            />
          ))}
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Mobile Behavior" defaultOpen>
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">When the screen is narrow:</p>
        <div className="grid gap-2">
          {mobileOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={chipBtn(mobileBehavior === option.value)}
              onClick={() => onPatch({ mobileBehavior: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Block Context" defaultOpen={false}>
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">
          Hidden context for this block. Used by timelines, maps, search, and related-content views. This does not appear
          directly in the story.
        </p>
        <div className="divide-y divide-base-content/10 rounded-lg border border-base-content/10 bg-base-100/50">
          {contextRows.map(({ label, count, enabled }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1 font-medium text-base-content">{label}</span>
              <span className="text-xs font-semibold tabular-nums text-base-content/55">{count}</span>
              {enabled ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setContextPanel((cur) => (cur === "datesPlaces" ? null : "datesPlaces"))}
                >
                  Manage
                </button>
              ) : (
                <span className="rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
        {contextPanel === "datesPlaces" && onPatchBlockDateAnnotation ? (
          <div className="mt-3">
            <BlockDateAnnotationInspector
              title="Manage dates and places"
              defaultOpen
              dateAnnotations={block.dateAnnotations}
              legacyDateAnnotation={block.dateAnnotation}
              placeAnnotations={block.placeAnnotations}
              onCommit={onPatchBlockDateAnnotation}
              touchComfort={touchComfort}
            />
          </div>
        ) : null}
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-content/10 bg-base-100/50 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary"
            checked={advancedColumnLayout}
            onChange={(e) => onPatch({ advancedColumnLayoutEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-base-content">Customize each column separately</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-base-content/55">
              Enable per-column spacing and vertical alignment overrides.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-base-content/10 bg-base-100/40 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-base-content/35 bg-base-100 accent-primary"
            checked
            readOnly
          />
          <span>
            <span className="font-medium text-base-content">Equal height columns</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-base-content/55">
              Columns already share the same row height in the editor and preview.
            </span>
          </span>
        </label>
        {advancedColumnLayout ? (
          <div className="space-y-3">
            {([0, 1] as const).map((colIdx) => {
              const slot = block.columns[colIdx];
              const justify = resolveColumnStackJustify(slot);
              const stackGap = resolveColumnStackGapRem(slot);
              return (
                <div key={slot.id} className="space-y-3 rounded-lg border border-base-content/10 bg-base-100/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">
                    {colIdx === 0 ? "Left column" : "Right column"}
                  </p>
                  <div>
                    <FieldLabel>Vertical alignment</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {STORY_COLUMN_STACK_JUSTIFY_PRESETS.map((preset) => (
                        <button
                          key={`${colIdx}-${preset.value}`}
                          type="button"
                          title={preset.hint}
                          className={chipBtn(justify === preset.value)}
                          onClick={() => onPatchColumnSlot(colIdx, { stackJustify: preset.value })}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Space between blocks</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {STORY_COLUMN_STACK_GAP_PRESETS.map((preset) => (
                        <button
                          key={`${colIdx}-gap-${preset.label}`}
                          type="button"
                          className={chipBtn(Math.abs(stackGap - preset.gapRem) < 0.05)}
                          onClick={() => onPatchColumnSlot(colIdx, { stackGapRem: preset.gapRem })}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CollapsibleFormSection>

      {onDeleteBlock ? (
        <div className="border-t border-base-content/10 pt-4">
          <CollapsibleFormSection title="Danger Zone" defaultOpen={false}>
            <p className="mb-3 text-xs leading-relaxed text-base-content/55">Delete columns block. This action cannot be undone.</p>
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
              Delete
            </Button>
          </CollapsibleFormSection>
        </div>
      ) : null}
    </div>
  );
}

function ColumnContentsCard({
  slot,
  label,
  onEdit,
}: {
  slot: StoryColumnSlot;
  label: string;
  onEdit?: () => void;
}) {
  const only = slot.blocks.length === 1 ? slot.blocks[0] : null;
  const mediaId = only?.type === "media" ? only.mediaId : undefined;
  const { data } = useStoryMediaById(mediaId);
  const thumb =
    data?.fileRef != null && data.fileRef !== ""
      ? mediaThumbSrc(data.fileRef, data.form, 96) ?? resolveMediaImageSrc(data.fileRef)
      : null;
  return (
    <div className="rounded-xl border border-base-content/10 bg-base-100/55 p-3 shadow-sm ring-1 ring-base-content/[0.03]">
      <div className="flex items-start gap-3">
        {thumb ? (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-base-content/10 bg-base-200/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb} alt="" className="size-full object-cover" />
          </div>
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-base-content/10 bg-base-200/40">
            <ImageIcon className="size-5 text-base-content/35" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-base-content">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-base-content/60">Contains: {columnSlotSummary(slot)}</p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-45"
            onClick={onEdit}
            disabled={!onEdit}
          >
            {slot.blocks.length === 0 ? "Add content" : "Edit contents"} <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export const STORY_KIND_OPTIONS: { value: StoryDocumentKind; label: string; hint: string }[] = [
  { value: "story", label: "Story", hint: "Narrative, chapter-led family story." },
  { value: "article", label: "Article", hint: "Long-form article layout and tone." },
  { value: "post", label: "Post", hint: "Shorter update or blog-style post." },
  { value: "folklore", label: "Folklore", hint: "Legends, sayings, oral history, and family lore." },
];

export function tagsToCommaInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function parseCommaTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function StoryLinkedAlbumsField({
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

export function InspectorStoryLinkedRecords({
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

function adminMediaRefFromLibraryItem(m: AdminMediaListItem): StoryImageMediaRef {
  // Admin media is stored in gedcomMedia table.
  return { mediaId: m.id, mediaKind: "gedcom_media" };
}

function coverImageMetaPatch(ref: StoryImageMediaRef | undefined): StoryDocumentMetaPatch {
  if (!ref) {
    return { coverImage: undefined, coverMediaId: undefined, coverMediaKind: undefined };
  }
  return { coverImage: ref, coverMediaId: ref.mediaId, coverMediaKind: ref.mediaKind };
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

export function InspectorStoryImagesSection({
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
            onStoryMetaChange(coverImageMetaPatch(adminMediaRefFromLibraryItem(m)));
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
            onStoryMetaChange({ profileImage: adminMediaRefFromLibraryItem(m) });
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

export function InspectorStoryAuthorsSection({
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
              <div className="mt-2">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-base-content/45">
                  Link to tree person
                </p>
                {credit.personXref ? (
                  <div className="flex items-center gap-2 rounded-lg border border-base-content/12 bg-base-100/60 px-3 py-2">
                    <UserCircle className="size-4 shrink-0 text-base-content/45" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-base-content">{credit.name}</p>
                      <p className="text-xs text-base-content/50">{credit.personXref}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs shrink-0 gap-1 text-base-content/50"
                      onClick={() => updateCredit(credit.id, { personXref: undefined, personId: undefined })}
                      aria-label="Remove tree person link"
                    >
                      <X className="size-3" aria-hidden />
                      Clear
                    </button>
                  </div>
                ) : (
                  <>
                    <IndividualSearchPicker
                      idPrefix={`author-person-${credit.id}`}
                      onPick={(ind) => {
                        const displayName = stripSlashesFromName(ind.fullName) || ind.xref || ind.id;
                        updateCredit(credit.id, {
                          personXref: ind.xref ?? undefined,
                          personId: ind.id,
                          name: displayName,
                        });
                      }}
                    />
                    <p className="mt-1 text-[10px] text-base-content/40">
                      Optional — links the byline name to their profile page.
                    </p>
                  </>
                )}
              </div>
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

// Story and debug tab components were extracted to ./inspector.

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
  const [subState, setSubState] = useState<{ storyId: string; sub: "story" | "debug" }>(() => ({ storyId, sub: "story" }));
  const sub = subState.storyId === storyId ? subState.sub : "story";
  const setSub = (next: "story" | "debug") => setSubState({ storyId, sub: next });

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
          <StorySettingsInspector
            doc={doc}
            storyId={storyId}
            onTitleChange={onTitleChange}
            onExcerptChange={onExcerptChange}
            onStoryMetaChange={onStoryMetaChange}
            touchComfort={touchComfort}
          />
        ) : (
          <StoryDebugInspector
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

export function ContainerLayoutInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StoryContainerBlock;
  onPatch: (patch: Partial<StoryContainerBlockProps>) => void;
  touchComfort?: boolean;
}) {
  const p = block.props;
  const r = resolveContainerVisualProps(block);
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

  const layoutPresets: StoryContainerPreset[] = ["default", "card", "callout", "quote"];
  const presetLabel = (v: StoryContainerPreset) => (v === "default" ? "Default" : v.charAt(0).toUpperCase() + v.slice(1));

  return (
    <div className="space-y-4">
      <HelperCard title="Container">
        Groups blocks with shared layout. The label is only shown in the editor, not in the published story.
      </HelperCard>
      {block.containerPresetLocked ? (
        <HelperCard title={`${presetLabel(r.preset)} (fixed preset)`}>
          Added from <strong className="font-semibold text-base-content">Add block</strong> as {presetLabel(r.preset)}. The layout
          preset cannot be changed; background, padding, border, and width below still apply.
        </HelperCard>
      ) : (
        <div>
          <FieldLabel>Layout preset</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {layoutPresets.map((v) => (
              <button key={v} type="button" className={chipBtn(r.preset === v)} onClick={() => onPatch({ preset: v })}>
                {presetLabel(v)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <FieldLabel>Label (editor only)</FieldLabel>
        <Input
          className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
          placeholder="Optional — e.g. “Callout”"
          value={p.label ?? ""}
          onChange={(e) => onPatch({ label: e.target.value ? e.target.value : undefined })}
        />
      </div>
      <div>
        <FieldLabel>Background</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "subtle", "custom"] as const).map((v) => (
            <button key={v} type="button" className={chipBtn(r.background === v)} onClick={() => onPatch({ background: v })}>
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
            <button key={v} type="button" className={chipBtn(r.padding === v)} onClick={() => onPatch({ padding: v })}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Border</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "subtle", "dashed"] as const).map((v) => (
            <button key={v} type="button" className={chipBtn(r.border === v)} onClick={() => onPatch({ border: v })}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <StoryBlockRowLayoutInspector
        rowLayout={effectiveContainerRowLayout(p)}
        onPatch={(patch) => {
          const nextRl = mergeStoryRowLayout(effectiveContainerRowLayout(p), patch);
          const wm = nextRl.widthMode ?? "full";
          let width: StoryContainerWidth = "normal";
          if (wm === "full") width = "full";
          else if (wm === "wide") width = "wide";
          else if (wm === "narrow") width = "narrow";
          else if (wm === "medium") width = "normal";
          onPatch({
            rowLayout: nextRl,
            width,
            align: (nextRl.alignment ?? "center") as NonNullable<StoryContainerBlockProps["align"]>,
          });
        }}
        touchComfort={touchComfort}
      />
    </div>
  );
}

export function StoryBlockDesignInspector({
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
            "textarea textarea-bordered textarea-sm mt-1 w-full resize-y rounded-lg border-base-content/12 bg-base-100 font-mono text-xs leading-relaxed text-base-content placeholder:text-base-content/45",
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

export function BlockDateAnnotationInspector({
  title = "Date & Place Annotation",
  defaultOpen = false,
  dateAnnotations,
  legacyDateAnnotation,
  placeAnnotations,
  onCommit,
  touchComfort,
}: {
  title?: string;
  defaultOpen?: boolean;
  dateAnnotations?: StoryBlockDateAnnotation[];
  legacyDateAnnotation?: StoryBlockDateAnnotation;
  placeAnnotations?: StoryBlockPlaceAnnotation[];
  onCommit: (next: { dateAnnotations?: StoryBlockDateAnnotation[]; placeAnnotations?: StoryBlockPlaceAnnotation[] }) => void;
  touchComfort?: boolean;
}) {
  const controlH = touchComfort ? "h-11 min-h-[44px]" : "h-10";
  type DateDraft = { id: string; date: string; dateDisplay: string; endDate: string };
  type PlaceDraft = { id: string; label: string; placeId: string };

  const initialAnnotationState = useMemo((): { sourceKey: string; dates: DateDraft[]; places: PlaceDraft[] } => {
    const incomingDates =
      dateAnnotations && dateAnnotations.length > 0
        ? dateAnnotations
        : legacyDateAnnotation
          ? [legacyDateAnnotation]
          : [];
    return {
      sourceKey: JSON.stringify({ dates: incomingDates, places: placeAnnotations ?? [] }),
      dates: incomingDates.map((a) => ({
        id: newStoryId(),
        date: a.date ?? "",
        dateDisplay: a.dateDisplay ?? "",
        endDate: a.endDate ?? "",
      })),
      places: (placeAnnotations ?? []).map((p) => ({
        id: newStoryId(),
        label: p.label ?? "",
        placeId: p.placeId ?? "",
      })),
    };
  }, [dateAnnotations, legacyDateAnnotation, placeAnnotations]);
  const [annotationState, setAnnotationState] = useState(() => initialAnnotationState);
  const activeAnnotationState = annotationState.sourceKey === initialAnnotationState.sourceKey ? annotationState : initialAnnotationState;
  const dates = activeAnnotationState.dates;
  const places = activeAnnotationState.places;

  const setDates = useCallback(
    (next: DateDraft[] | ((cur: DateDraft[]) => DateDraft[])) => {
      setAnnotationState((prev) => {
        const base = prev.sourceKey === initialAnnotationState.sourceKey ? prev : initialAnnotationState;
        const datesNext = typeof next === "function" ? next(base.dates) : next;
        return { ...base, dates: datesNext };
      });
    },
    [initialAnnotationState],
  );

  const setPlaces = useCallback(
    (next: PlaceDraft[] | ((cur: PlaceDraft[]) => PlaceDraft[])) => {
      setAnnotationState((prev) => {
        const base = prev.sourceKey === initialAnnotationState.sourceKey ? prev : initialAnnotationState;
        const placesNext = typeof next === "function" ? next(base.places) : next;
        return { ...base, places: placesNext };
      });
    },
    [initialAnnotationState],
  );

  const flush = useCallback(() => {
    const nextDates = dates
      .map((a) => ({
        date: a.date.trim(),
        dateDisplay: a.dateDisplay.trim(),
        ...(a.endDate.trim() ? { endDate: a.endDate.trim() } : {}),
      }))
      .filter((a) => a.date.length > 0 && a.dateDisplay.length > 0);
    const nextPlaces = places
      .map((p) => ({
        label: p.label.trim(),
        ...(p.placeId.trim() ? { placeId: p.placeId.trim() } : {}),
      }))
      .filter((p) => p.label.length > 0);
    onCommit({
      dateAnnotations: nextDates.length > 0 ? nextDates : undefined,
      placeAnnotations: nextPlaces.length > 0 ? nextPlaces : undefined,
    });
  }, [dates, places, onCommit]);

  const patchDate = (id: string, patch: Partial<{ date: string; dateDisplay: string; endDate: string }>) =>
    setDates((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const patchPlace = (id: string, patch: Partial<{ label: string; placeId: string }>) =>
    setPlaces((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <CollapsibleFormSection title={title} defaultOpen={defaultOpen}>
      <p className="mb-3 text-xs leading-relaxed text-base-content/55">
        Add one or more timeline markers. Use ISO 8601 dates (for example <span className="font-mono">1887-03-14</span>)
        and a human-readable label.
      </p>
      <div className="space-y-4">
        {dates.map((a, idx) => (
          <div key={a.id} className="space-y-3 rounded-lg border border-base-content/10 bg-base-100/60 p-3">
            <div className="flex items-center justify-between">
              <FieldLabel>Date annotation {idx + 1}</FieldLabel>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                onClick={() => {
                  setDates((cur) => cur.filter((x) => x.id !== a.id));
                  queueMicrotask(flush);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
            <input
              className={cn(
                "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
                controlH,
              )}
              placeholder="1887-03-14"
              value={a.date}
              onChange={(e) => patchDate(a.id, { date: e.target.value })}
              onBlur={flush}
              spellCheck={false}
            />
            <input
              className={cn(
                "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 text-sm",
                controlH,
              )}
              placeholder="March 1887"
              value={a.dateDisplay}
              onChange={(e) => patchDate(a.id, { dateDisplay: e.target.value })}
              onBlur={flush}
            />
            <input
              className={cn(
                "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
                controlH,
              )}
              placeholder="1920-12-31 (optional end date)"
              value={a.endDate}
              onChange={(e) => patchDate(a.id, { endDate: e.target.value })}
              onBlur={flush}
              spellCheck={false}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("w-full gap-2 font-medium", touchComfort ? "min-h-11 h-11" : "h-9")}
          onClick={() => setDates((cur) => [...cur, { id: newStoryId(), date: "", dateDisplay: "", endDate: "" }])}
        >
          <Plus className="size-3.5" aria-hidden />
          Add date annotation
        </Button>
      </div>

      <div className="mt-5 border-t border-base-content/10 pt-4">
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">Add one or more place annotations.</p>
        <div className="space-y-3">
          {places.map((p, idx) => (
            <div key={p.id} className="space-y-2 rounded-lg border border-base-content/10 bg-base-100/60 p-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Place annotation {idx + 1}</FieldLabel>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                  onClick={() => {
                    setPlaces((cur) => cur.filter((x) => x.id !== p.id));
                    queueMicrotask(flush);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
              <input
                className={cn(
                  "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 text-sm",
                  controlH,
                )}
                placeholder="Place label"
                value={p.label}
                onChange={(e) => patchPlace(p.id, { label: e.target.value })}
                onBlur={flush}
              />
              <input
                className={cn(
                  "input input-bordered input-sm w-full rounded-lg border-base-content/12 bg-base-100 font-mono text-xs",
                  controlH,
                )}
                placeholder="place id (optional)"
                value={p.placeId}
                onChange={(e) => patchPlace(p.id, { placeId: e.target.value })}
                onBlur={flush}
                spellCheck={false}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("w-full gap-2 font-medium", touchComfort ? "min-h-11 h-11" : "h-9")}
            onClick={() => setPlaces((cur) => [...cur, { id: newStoryId(), label: "", placeId: "" }])}
          >
            <Plus className="size-3.5" aria-hidden />
            Add place annotation
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("w-full gap-2 font-medium", touchComfort ? "min-h-11 h-11" : "h-9")}
          onClick={() => {
            setDates([]);
            setPlaces([]);
            onCommit({});
          }}
        >
          Clear annotations
        </Button>
      </div>
    </CollapsibleFormSection>
  );
}

const RICH_TEXT_PRESET_OPTIONS: StoryRichTextTextPreset[] = ["paragraph", "heading", "list", "verse", "quote"];

export function RichTextBlockInspector({
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
  const rowLayout = effectiveRowLayoutForRichText(block.rowLayout);
  const alignmentOptions: StoryBlockRowAlignment[] = ["left", "center", "right"];
  const lineLayoutOptions: { value: StoryVerseLineLayout; label: string }[] = [
    { value: "normal", label: "Normal" },
    { value: "staggered", label: "Staggered" },
  ];
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
      {block.headingPresetLocked ? (
        <HelperCard title="Heading (fixed preset)">
          This block was added from full-screen <strong className="font-semibold text-base-content">Add block</strong> as a heading. It
          stays a heading; use <strong className="font-semibold text-base-content">Heading level</strong> below to change H1–H6.
        </HelperCard>
      ) : block.listPresetLocked ? (
        <HelperCard title="List (fixed preset)">
          This block was added from <strong className="font-semibold text-base-content">Add block</strong> as a list. It stays a list; use{" "}
          <strong className="font-semibold text-base-content">List style</strong> below for bullets vs numbered.
        </HelperCard>
      ) : (
        <div>
          <FieldLabel>Text preset</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {RICH_TEXT_PRESET_OPTIONS.map((p) => (
              <button key={p} type="button" className={chipBtn(preset === p)} onClick={() => onPatch({ preset: p })}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
      {preset === "heading" ? (
        <div>
          <FieldLabel>Heading level</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5, 6] as const).map((lvl) => (
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
        <div className="space-y-4 rounded-xl border border-base-content/10 bg-base-100/45 p-3">
          <div>
            <FieldLabel>Verse title</FieldLabel>
            <Input
              className={cn("input input-bordered input-sm mt-2 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              placeholder="Optional title"
              value={block.verseTitle ?? ""}
              onChange={(e) => onPatch({ verseTitle: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Verse content</FieldLabel>
            <StoryTipTapEditor
              editorKey={`verse-inspector-${block.id}`}
              content={block.doc as JSONContent}
              onChange={(doc) => onPatch({ doc, verseContent: verseTextFromTipTapDoc(doc) })}
              richTextBlockId={block.id}
              placeholder="Enter each verse line on its own line"
              className="mt-2"
              toolbarDensity={touchComfort ? "touch" : "default"}
              surface="card"
              richTextPreset="verse"
              enableGlobalToolbar={false}
            />
            <p className="mt-2 text-xs leading-relaxed text-base-content/55">
              Use the toolbar for inline formatting, person links, and removing links. Each paragraph is treated as a verse line.
            </p>
          </div>
          <div>
            <FieldLabel>Block alignment</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {alignmentOptions.map((align) => (
                <button
                  key={align}
                  type="button"
                  className={chipBtn((rowLayout.alignment ?? "center") === align)}
                  onClick={() => onPatchRowLayout({ alignment: align, displayMode: "block", float: undefined })}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Title alignment</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {alignmentOptions.map((align) => (
                <button
                  key={align}
                  type="button"
                  className={chipBtn((block.verseTitleAlign ?? "center") === align)}
                  onClick={() => onPatch({ verseTitleAlign: align })}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Content alignment</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {alignmentOptions.map((align) => (
                <button
                  key={align}
                  type="button"
                  className={chipBtn((block.verseContentAlign ?? "center") === align)}
                  onClick={() => onPatch({ verseContentAlign: align })}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Line layout</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {lineLayoutOptions.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  className={chipBtn((block.verseLineLayout ?? "normal") === layout.value)}
                  onClick={() => onPatch({ verseLineLayout: layout.value })}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </div>
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
        </div>
      ) : null}
      <StoryBlockRowLayoutInspector
        rowLayout={rowLayout}
        onPatch={(patch) => onPatchRowLayout({ ...patch, displayMode: "block", float: undefined })}
        touchComfort={touchComfort}
      />
    </div>
  );
}

const DIVIDER_PRESET_OPTIONS: StoryDividerVariant[] = ["line", "ornamental", "spacer", "sectionBreak"];

export function DividerBlockInspector({
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

// ─── Table block inspector ────────────────────────────────────────────────────

export type TableLayoutPatch = Partial<Pick<StoryTableBlock, "hasHeaderRow" | "hasHeaderColumn" | "rowCount" | "columnCount" | "widthPct" | "widthAlign">>;

const TABLE_WIDTH_PRESETS = [
  { pct: 33, label: "33%" },
  { pct: 50, label: "50%" },
  { pct: 66, label: "66%" },
  { pct: 75, label: "75%" },
  { pct: 100, label: "Full" },
] as const;

export function TableBlockInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StoryTableBlock;
  onPatch: (patch: TableLayoutPatch) => void;
  touchComfort?: boolean;
}) {
  const widthPct = block.widthPct ?? 100;
  const widthAlign = block.widthAlign ?? "center";
  const bodyRowCount = Math.max(1, block.rowCount ?? 1);
  const bodyColumnCount = Math.max(1, block.columnCount ?? 1);
  const chipH = touchComfort ? "h-9 min-h-[36px]" : "h-8";
  return (
    <div className="space-y-4">
      <HelperCard title="Table">
        Click any cell to edit its rich-text content. Rows/columns below are body counts; enabling headers adds an
        extra top row and/or first column.
      </HelperCard>

      <CollapsibleFormSection title="Body dimensions" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <FieldLabel>Rows</FieldLabel>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={cn(
                  "inline-flex w-8 items-center justify-center rounded-md border border-base-content/15 bg-base-100 text-base-content transition-colors hover:bg-base-200 disabled:opacity-40",
                  chipH,
                )}
                onClick={() => onPatch({ rowCount: Math.max(1, bodyRowCount - 1) })}
                disabled={bodyRowCount <= 1}
              >
                <ArrowDown className="size-3.5" />
              </button>
              <Input
                type="number"
                min={1}
                value={bodyRowCount}
                onChange={(e) => {
                  const next = Number.parseInt(e.currentTarget.value || "", 10);
                  if (Number.isFinite(next)) onPatch({ rowCount: Math.max(1, next) });
                }}
                className={cn(chipH, "text-center")}
              />
              <button
                type="button"
                className={cn(
                  "inline-flex w-8 items-center justify-center rounded-md border border-base-content/15 bg-base-100 text-base-content transition-colors hover:bg-base-200",
                  chipH,
                )}
                onClick={() => onPatch({ rowCount: bodyRowCount + 1 })}
              >
                <ArrowUp className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Columns</FieldLabel>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={cn(
                  "inline-flex w-8 items-center justify-center rounded-md border border-base-content/15 bg-base-100 text-base-content transition-colors hover:bg-base-200 disabled:opacity-40",
                  chipH,
                )}
                onClick={() => onPatch({ columnCount: Math.max(1, bodyColumnCount - 1) })}
                disabled={bodyColumnCount <= 1}
              >
                <ArrowDown className="size-3.5" />
              </button>
              <Input
                type="number"
                min={1}
                value={bodyColumnCount}
                onChange={(e) => {
                  const next = Number.parseInt(e.currentTarget.value || "", 10);
                  if (Number.isFinite(next)) onPatch({ columnCount: Math.max(1, next) });
                }}
                className={cn(chipH, "text-center")}
              />
              <button
                type="button"
                className={cn(
                  "inline-flex w-8 items-center justify-center rounded-md border border-base-content/15 bg-base-100 text-base-content transition-colors hover:bg-base-200",
                  chipH,
                )}
                onClick={() => onPatch({ columnCount: bodyColumnCount + 1 })}
              >
                <ArrowUp className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </CollapsibleFormSection>

      {/* Headers */}
      <CollapsibleFormSection title="Headers" defaultOpen>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={block.hasHeaderRow ?? false}
              onCheckedChange={(v) => onPatch({ hasHeaderRow: Boolean(v) })}
            />
            Header row (first row)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox
              checked={block.hasHeaderColumn ?? false}
              onCheckedChange={(v) => onPatch({ hasHeaderColumn: Boolean(v) })}
            />
            Header column (first column)
          </label>
        </div>
      </CollapsibleFormSection>

      {/* Block width */}
      <CollapsibleFormSection title="Block width" defaultOpen>
        <div className="flex flex-wrap gap-1.5">
          {TABLE_WIDTH_PRESETS.map(({ pct, label }) => (
            <button
              key={pct}
              type="button"
              className={cn(
                "rounded-md border px-2.5 text-xs font-medium transition-colors",
                chipH,
                widthPct === pct
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-base-content/15 bg-base-100 text-base-content hover:bg-base-200",
              )}
              onClick={() => onPatch({ widthPct: pct })}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Alignment — only when not full-width */}
        {widthPct < 100 && (
          <div className="mt-2 flex gap-1.5">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                title={`Align ${a}`}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-md border transition-colors",
                  chipH,
                  widthAlign === a
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-base-content/15 bg-base-100 text-base-content hover:bg-base-200",
                )}
                onClick={() => onPatch({ widthAlign: a })}
              >
                {a === "left" ? <AlignLeft className="size-3.5" /> : a === "right" ? <AlignRight className="size-3.5" /> : <AlignCenter className="size-3.5" />}
              </button>
            ))}
          </div>
        )}
      </CollapsibleFormSection>
    </div>
  );
}

const SPLIT_WIDTH_PRESETS = [
  { pct: 20, label: "20%" },
  { pct: 25, label: "25%" },
  { pct: 33, label: "33%" },
  { pct: 40, label: "40%" },
  { pct: 50, label: "50%" },
] as const;

const SPLIT_GAP_PRESETS = [
  { rem: 0.75, label: "Tight" },
  { rem: 1.5, label: "Normal" },
  { rem: 2.5, label: "Wide" },
] as const;

export function SplitContentInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StorySplitContentBlock;
  onPatch: (patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => void;
  touchComfort?: boolean;
}) {
  const chip = touchComfort ? "min-h-11 px-3 text-sm" : "h-9 px-2.5 text-xs";
  const chipBtn = (active: boolean) =>
    cn(
      "rounded-lg border text-center font-semibold uppercase tracking-wide transition-colors",
      chip,
      active
        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
    );
  const widthPct = block.supportingWidthPct ?? 33;
  const gapRem = block.supportingGapRem ?? 1.5;
  const side = block.supportingSide ?? "right";

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Panel side</FieldLabel>
        <div className="flex gap-2">
          {(["left", "right"] as const).map((s) => (
            <button key={s} type="button" className={cn(chipBtn(side === s), "flex-1 capitalize")} onClick={() => onPatch({ supportingSide: s })}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Panel width</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {SPLIT_WIDTH_PRESETS.map(({ pct, label }) => (
            <button key={pct} type="button" className={chipBtn(Math.abs(widthPct - pct) <= 2)} onClick={() => onPatch({ supportingWidthPct: pct })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <FieldLabel>Gap</FieldLabel>
        <div className="flex gap-2">
          {SPLIT_GAP_PRESETS.map(({ rem, label }) => (
            <button key={rem} type="button" className={cn(chipBtn(Math.abs(gapRem - rem) < 0.1), "flex-1")} onClick={() => onPatch({ supportingGapRem: rem })}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Block tab component was extracted to ./inspector.

export function StoryCreatorInspector({
  doc,
  storyId,
  inspectorTab,
  onInspectorTab,
  selectedSection,
  selectedBlock,
  selectedBlockId = null,
  selectedFlowNode = null,
  storyEditorDirty = false,
  columnsLayoutBlock,
  columnsNestingDepth,
  onPatchColumns,
  onPatchColumnSlot,
  onEditColumnContent,
  onPatchEmbed,
  onPatchMedia,
  onPatchContainer,
  onPatchBlockRowLayout,
  onPatchBlockDesign,
  onPatchBlockDateAnnotation,
  onPatchSection,
  onPatchRichTextMeta,
  onPatchDividerMeta,
  onPatchSplitContent,
  onPatchTable,
  onPatchFlowNode,
  selectedBlockInSplitPanel = false,
  onTitleChange,
  onExcerptChange,
  onStoryMetaChange,
  onClose,
  onDeleteBlock,
  className,
  layout = "sidebar",
}: {
  doc: StoryDocument;
  storyId: string;
  inspectorTab: StoryInspectorTab;
  onInspectorTab: (t: StoryInspectorTab) => void;
  selectedSection?: StorySection | null;
  selectedBlock: StoryBlock | null;
  /** Block id in the active section (for Debug tab). */
  selectedBlockId?: string | null;
  selectedFlowNode?: StoryFlowNodeSelection | null;
  /** True when in-memory document differs from last localStorage save. */
  storyEditorDirty?: boolean;
  columnsLayoutBlock?: StoryColumnsBlock | null;
  /** Depth of the columns block shown in the layout inspector (1 or 2). */
  columnsNestingDepth?: number;
  onPatchColumns?: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem" | "mobileBehavior" | "advancedColumnLayoutEnabled">>) => void;
  onPatchColumnSlot?: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  onEditColumnContent?: (columnIndex: 0 | 1) => void;
  onPatchEmbed: (patch: Partial<StoryEmbedBlock>) => void;
  onPatchMedia: (patch: Partial<StoryMediaBlock>) => void;
  onPatchContainer?: (patch: Partial<StoryContainerBlockProps>) => void;
  onPatchBlockRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  onPatchBlockDesign: (patch: Partial<StoryBlockDesign> | null) => void;
  onPatchBlockDateAnnotation?: (next: { dateAnnotations?: StoryBlockDateAnnotation[]; placeAnnotations?: StoryBlockPlaceAnnotation[] }) => void;
  onPatchSection?: (sectionId: string, patch: Partial<StorySection>) => void;
  onPatchRichTextMeta?: (patch: StoryRichTextMetaPatch) => void;
  onPatchDividerMeta?: (patch: StoryDividerMetaPatch) => void;
  onPatchSplitContent?: (patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => void;
  onPatchTable?: (patch: TableLayoutPatch) => void;
  onPatchFlowNode?: (selection: StoryFlowNodeSelection, patch: Record<string, unknown>) => void;
  /** True when the selected media/embed block lives inside a splitContent supporting panel. */
  selectedBlockInSplitPanel?: boolean;
  onTitleChange: (title: string) => void;
  onExcerptChange: (excerpt: string) => void;
  onStoryMetaChange?: (patch: StoryDocumentMetaPatch) => void;
  onClose?: () => void;
  onDeleteBlock?: () => void;
  className?: string;
  layout?: StoryInspectorLayout;
}) {
  const storyMeta = onStoryMetaChange ?? (() => {});
  if (layout === "sheet-block") {
    return (
      <div className={cn("flex min-h-0 w-full flex-col bg-transparent", className)}>
        <div className="min-h-0 flex-1 space-y-6">
          <StoryBlockInspector
            storyId={storyId}
            selectedBlock={selectedBlock}
            selectedSection={selectedSection ?? null}
            columnsLayoutBlock={columnsLayoutBlock ?? null}
            columnsNestingDepth={columnsNestingDepth ?? 1}
            onPatchColumns={onPatchColumns}
            onPatchColumnSlot={onPatchColumnSlot}
            onEditColumnContent={onEditColumnContent}
            onPatchEmbed={onPatchEmbed}
            onPatchMedia={onPatchMedia}
            onPatchContainer={onPatchContainer}
            onPatchBlockRowLayout={onPatchBlockRowLayout}
            onPatchBlockDesign={onPatchBlockDesign}
            onPatchBlockDateAnnotation={onPatchBlockDateAnnotation}
            onPatchSection={onPatchSection}
            onPatchRichTextMeta={onPatchRichTextMeta}
            onPatchDividerMeta={onPatchDividerMeta}
            onPatchSplitContent={onPatchSplitContent}
            onPatchTable={onPatchTable}
            selectedFlowNode={selectedFlowNode}
            onPatchFlowNode={onPatchFlowNode}
            selectedBlockInSplitPanel={selectedBlockInSplitPanel}
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
      <div className="flex shrink-0 items-center gap-1 border-b border-base-content/10 p-2.5">
        {onClose ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 shrink-0 rounded-lg p-0 text-base-content/65 hover:bg-base-content/[0.08] hover:text-base-content"
            title="Hide inspector"
            aria-label="Hide inspector panel"
            onClick={onClose}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : null}
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
          <StorySettingsInspector
            doc={doc}
            storyId={storyId}
            onTitleChange={onTitleChange}
            onExcerptChange={onExcerptChange}
            onStoryMetaChange={storyMeta}
          />
        ) : inspectorTab === "debug" ? (
          <StoryDebugInspector
            doc={doc}
            selectedBlockId={selectedBlockId}
            selectedBlock={selectedBlock}
            storyEditorDirty={storyEditorDirty}
          />
        ) : (
          <StoryBlockInspector
            storyId={storyId}
            selectedBlock={selectedBlock}
            selectedSection={selectedSection ?? null}
            columnsLayoutBlock={columnsLayoutBlock ?? null}
            columnsNestingDepth={columnsNestingDepth ?? 1}
            onPatchColumns={onPatchColumns}
            onPatchColumnSlot={onPatchColumnSlot}
            onEditColumnContent={onEditColumnContent}
            onPatchEmbed={onPatchEmbed}
            onPatchMedia={onPatchMedia}
            onPatchContainer={onPatchContainer}
            onPatchBlockRowLayout={onPatchBlockRowLayout}
            onPatchBlockDesign={onPatchBlockDesign}
            onPatchBlockDateAnnotation={onPatchBlockDateAnnotation}
            onPatchSection={onPatchSection}
            onPatchRichTextMeta={onPatchRichTextMeta}
            onPatchDividerMeta={onPatchDividerMeta}
            onPatchSplitContent={onPatchSplitContent}
            onPatchTable={onPatchTable}
            selectedFlowNode={selectedFlowNode}
            onPatchFlowNode={onPatchFlowNode}
            selectedBlockInSplitPanel={selectedBlockInSplitPanel}
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

export function StoryBlockRowLayoutInspector({
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

const MEDIA_WIDTH_PRESETS: { label: string; pct: number }[] = [
  { label: "25%", pct: 25 },
  { label: "33%", pct: 33 },
  { label: "50%", pct: 50 },
  { label: "66%", pct: 66 },
  { label: "75%", pct: 75 },
  { label: "Full", pct: 100 },
];

const STORY_MEDIA_EMBED_LAYOUT_ALIGN_OPTIONS: { value: StoryEmbedLayoutAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
];

/** Standalone media/embed: percentage width presets + column alignment. */
function StandaloneMediaEmbedLayoutInspectorSection({
  block,
  onPatchLayout,
  touchComfort,
}: {
  block: StoryMediaBlock | StoryEmbedBlock;
  onPatchLayout: (p: Partial<StoryMediaBlock> | Partial<StoryEmbedBlock>) => void;
  touchComfort?: boolean;
}) {
  const rl = effectiveMediaEmbedInspectorRowLayout(block);
  const layoutAlign = block.layoutAlign ?? "center";
  const chip = touchComfort ? "min-h-[44px] px-2 text-sm" : "h-9 px-2 text-xs";

  // Resolve current width as a percentage for button highlighting
  const currentPct =
    rl.widthMode === "full"
      ? 100
      : rl.widthMode === "custom" && rl.widthValue != null
        ? rl.widthValue
        : rl.widthMode === "wide"
          ? 80
          : rl.widthMode === "medium"
            ? 65
            : rl.widthMode === "narrow"
              ? 45
              : 100;

  function applyWidth(pct: number) {
    onPatchLayout(
      mergeMediaEmbedRowLayoutPatch(block, {
        widthMode: pct >= 100 ? "full" : "custom",
        widthValue: pct >= 100 ? undefined : pct,
        widthUnit: "%",
        displayMode: "block",
        float: undefined,
      }),
    );
  }

  return (
    <CollapsibleFormSection title="Size & alignment" defaultOpen>
      <p className="mb-3 text-xs leading-relaxed text-base-content/55">
        Drag the handles on the image edges to resize, or pick a preset below.
      </p>
      <FieldLabel>Width</FieldLabel>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MEDIA_WIDTH_PRESETS.map(({ label, pct }) => {
          const active = Math.abs(currentPct - pct) <= 2;
          return (
            <button
              key={pct}
              type="button"
              onClick={() => applyWidth(pct)}
              className={cn(
                "rounded-lg border text-center font-semibold transition-colors",
                chip,
                active
                  ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                  : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {rl.widthMode === "custom" && rl.widthValue != null ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={Math.round(rl.widthValue)}
            onChange={(e) => applyWidth(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary"
          />
          <span className="w-10 text-right text-xs font-semibold tabular-nums text-base-content/70">
            {Math.round(rl.widthValue)}%
          </span>
        </div>
      ) : null}
      <div className="mt-4">
        <FieldLabel>Alignment in column</FieldLabel>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {STORY_MEDIA_EMBED_LAYOUT_ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => onPatchLayout(mergeMediaEmbedRowLayoutPatch(block, { alignment: layoutAlignToRowAlignment(value), displayMode: "block", float: undefined }))}
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

export function MediaBlockInspector({
  storyId,
  block,
  onPatch,
  hideLayoutSection,
  touchComfort,
}: {
  storyId: string;
  block: StoryMediaBlock;
  onPatch: (p: Partial<StoryMediaBlock>) => void;
  /** Suppress Size & alignment when block lives inside a split content supporting panel. */
  hideLayoutSection?: boolean;
  touchComfort?: boolean;
}) {
  const { data, isLoading } = useStoryMediaById(block.mediaId);
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
          <StoryCaptionRichTextEditor
            caption={block.caption}
            placeholder="Optional caption shown with the media…"
            touchComfort={touchComfort}
            onChange={(caption) => onPatch({ caption })}
          />
        </div>
        <div className="mt-4 space-y-3 rounded-lg border border-base-content/10 bg-base-100/50 p-3">
          <p className="text-xs font-semibold text-base-content/70">Story display</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideTitle}
              onChange={(e) => onPatch({ hideTitle: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display title in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the title editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideCaption}
              onChange={(e) => onPatch({ hideCaption: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display caption in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the caption editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
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

      {!hideLayoutSection && (
        <StandaloneMediaEmbedLayoutInspectorSection block={block} onPatchLayout={(p) => onPatch(p as Partial<StoryMediaBlock>)} touchComfort={touchComfort} />
      )}

      <CollapsibleFormSection title="Appearance" defaultOpen={block.heightPx != null}>
        <FieldLabel>Height</FieldLabel>
        {block.heightPx != null ? (
          <div className="mt-1 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={60}
                max={900}
                step={10}
                value={block.heightPx}
                onChange={(e) => onPatch({ heightPx: Number(e.target.value) })}
                className="h-2 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-14 text-right text-xs font-semibold tabular-nums text-base-content/70">
                {block.heightPx}px
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("w-full rounded-lg border-base-content/12 font-medium", controlH)}
              onClick={() => onPatch({ heightPx: undefined })}
            >
              Reset to natural height
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-base-content/55">
            Natural — height follows the image aspect ratio. Drag the bottom handle on the image to set a fixed crop height.
          </p>
        )}
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
          <FieldLabel>Legacy layout fields (read-only)</FieldLabel>
          <p className="mt-0.5 text-[10px] leading-relaxed text-base-content/40">
            Deprecated fields kept for backward compatibility. Use Size &amp; alignment above to migrate.
          </p>
          <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-base-content/50">
            widthPreset={block.widthPreset ?? "—"} · layoutAlign={block.layoutAlign ?? "—"} · textWrap=
            {String(block.textWrap ?? false)} · fullWidth={String(block.fullWidth ?? false)}
          </p>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}

export function OtherEmbedInspector({
  block,
  onPatch,
  touchComfort,
}: {
  block: StoryEmbedBlock;
  onPatch: (p: Partial<StoryEmbedBlock>) => void;
  touchComfort?: boolean;
}) {
  const title = block.title ?? block.label ?? "";
  const presentation = block.presentation ?? {};
  const textSectionOpenDefault = Boolean(title.trim() || block.caption?.trim() || block.sublabel?.trim());
  const controlH = touchComfort ? "min-h-[44px] h-11" : "h-10";
  const dataRecord = block.data && typeof block.data === "object" ? (block.data as Record<string, unknown>) : {};
  const patchData = (patch: Record<string, unknown>) => onPatch({ data: { ...dataRecord, ...patch } } as Partial<StoryEmbedBlock>);

  const semanticConfig = (() => {
    if (block.embedKind === "tree") {
      const data = (block.data ?? { generations: 5, chartType: "fan" }) as StoryTreeEmbedData;
      return (
        <CollapsibleFormSection title="Tree configuration" defaultOpen>
          <FieldLabel>Root person</FieldLabel>
          {data.rootPersonLabel || data.rootPersonId || data.rootPersonXref ? (
            <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
              {data.rootPersonLabel || data.rootPersonXref || data.rootPersonId}
            </p>
          ) : null}
          <IndividualSearchPicker
            idPrefix={`story-tree-root-${block.id}`}
            onPick={(ind) => {
              patchData({
                rootPersonId: ind.id,
                rootPersonXref: ind.xref ?? undefined,
                rootPersonLabel: ind.fullName?.trim() || ind.xref || ind.id,
              });
              onPatch({
                subject: {
                  type: "individual",
                  id: ind.id,
                  xref: ind.xref ?? undefined,
                  label: ind.fullName?.trim() || ind.xref || ind.id,
                },
              });
            }}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Generations</FieldLabel>
              <input
                type="number"
                min={1}
                max={10}
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.generations ?? 5}
                onChange={(e) => patchData({ generations: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              />
            </div>
            <div>
              <FieldLabel>Chart type</FieldLabel>
              <select
                className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.chartType ?? "fan"}
                onChange={(e) => patchData({ chartType: e.target.value })}
              >
                {TREE_CHART_TYPES.map((chartType) => (
                  <option key={chartType} value={chartType}>
                    {TREE_CHART_TYPE_LABELS[chartType]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel>Card style</FieldLabel>
            <p className="mb-2 text-xs text-base-content/50">When set, overrides the renderer&apos;s default. Leave unset to let the renderer choose.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {([undefined, ...TREE_CARD_VARIANTS] as (StoryTreeCardVariant | undefined)[]).map((v) => (
                <button
                  key={v ?? "__default__"}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    data.cardVariant === v
                      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                      : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
                  )}
                  onClick={() => patchData({ cardVariant: v, cardLayout: undefined, compactCardSize: undefined })}
                >
                  {v == null ? "Renderer default" : TREE_CARD_VARIANT_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          {(data.cardVariant === "full" || data.cardVariant == null) && (
            <div className="mt-3">
              <FieldLabel>Card layout</FieldLabel>
              <select
                className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.cardLayout ?? ""}
                onChange={(e) => patchData({ cardLayout: (e.target.value as StoryTreeCardLayout) || undefined })}
              >
                <option value="">Renderer default</option>
                {TREE_CARD_LAYOUTS.map((layout) => (
                  <option key={layout} value={layout}>
                    {TREE_CARD_LAYOUT_LABELS[layout]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(data.cardVariant === "compact-name" || data.cardVariant === "compact-avatar") && (
            <div className="mt-3">
              <FieldLabel>Card size</FieldLabel>
              <div className="mt-1 flex flex-wrap gap-2">
                {([undefined, ...TREE_COMPACT_SIZES] as (StoryTreeCompactCardSize | undefined)[]).map((size) => (
                  <button
                    key={size ?? "__default__"}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      data.compactCardSize === size
                        ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                        : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
                    )}
                    onClick={() => patchData({ compactCardSize: size })}
                  >
                    {size == null ? "Renderer default" : TREE_COMPACT_SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "personSpotlight") {
      const data = (block.data ?? { fields: ["profileImage", "name", "lifespan"] }) as StoryPersonSpotlightEmbedData;
      const fields = new Set(data.fields ?? []);
      return (
        <CollapsibleFormSection title="Person spotlight configuration" defaultOpen>
          <FieldLabel>Person</FieldLabel>
          {data.personLabel || data.personId || data.personXref ? (
            <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
              {data.personLabel || data.personXref || data.personId}
            </p>
          ) : null}
          <IndividualSearchPicker
            idPrefix={`story-person-spotlight-${block.id}`}
            onPick={(ind) => {
              const label = ind.fullName?.trim() || ind.xref || ind.id;
              patchData({ personId: ind.id, personXref: ind.xref ?? undefined, personLabel: label });
              onPatch({ subject: { type: "individual", id: ind.id, xref: ind.xref ?? undefined, label } });
            }}
          />
          <FieldLabel>Fields to show</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {PERSON_SPOTLIGHT_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 rounded-lg border border-base-content/10 bg-base-100/55 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={fields.has(field)}
                  onChange={(e) => {
                    const next = new Set(fields);
                    if (e.target.checked) next.add(field);
                    else next.delete(field);
                    if (!e.target.checked) patchData({ fields: Array.from(next), customFields: [] });
                    else patchData({ fields: Array.from(next) });
                  }}
                />
                {PERSON_SPOTLIGHT_FIELD_LABELS[field]}
              </label>
            ))}
          </div>
          {fields.has("custom") ? (
            <CustomFieldsEditor
              customFields={data.customFields ?? []}
              onChange={(customFields) => patchData({ customFields })}
            />
          ) : null}
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "gallery") {
      const data = (block.data ?? { sourceType: "custom" }) as StoryGalleryEmbedData;

      const gallerySourcePicker = (() => {
        if (data.sourceType === "album") {
          return (
            <AlbumsPicker
              selected={data.sourceId ? [{ id: data.sourceId, name: data.sourceLabel ?? data.sourceId }] : []}
              onAdd={(album) => patchData({ sourceId: album.id, sourceLabel: album.name })}
              onRemove={() => patchData({ sourceId: undefined, sourceLabel: undefined })}
              placeholder="Search albums…"
            />
          );
        }
        if (data.sourceType === "tag") {
          return (
            <TagsPicker
              selected={data.sourceId ? [{ id: data.sourceId, name: data.sourceLabel ?? data.sourceId, color: null }] : []}
              onAdd={(tag) => patchData({ sourceId: tag.id, sourceLabel: displayTagName(tag.name) })}
              onRemove={() => patchData({ sourceId: undefined, sourceLabel: undefined })}
              placeholder="Search tags…"
            />
          );
        }
        if (data.sourceType === "personMedia") {
          return (
            <>
              {data.sourceLabel || data.sourceId ? (
                <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
                  {data.sourceLabel ?? data.sourceId}
                </p>
              ) : null}
              <IndividualSearchPicker
                idPrefix={`story-gallery-person-${block.id}`}
                onPick={(ind) => {
                  const label = ind.fullName?.trim() || ind.xref || ind.id;
                  patchData({ sourceId: ind.id, sourceLabel: label });
                }}
              />
            </>
          );
        }
        if (data.sourceType === "familyMedia") {
          return (
            <>
              {data.sourceLabel || data.sourceId ? (
                <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
                  {data.sourceLabel ?? data.sourceId}
                </p>
              ) : null}
              <FamilySearchPicker
                idPrefix={`story-gallery-family-${block.id}`}
                onPick={(fam) => {
                  const label = familyUnionPrimaryLine(fam);
                  patchData({ sourceId: fam.id, sourceLabel: label });
                }}
              />
            </>
          );
        }
        if (data.sourceType === "eventMedia") {
          return (
            <>
              {data.sourceLabel || data.sourceId ? (
                <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
                  {data.sourceLabel ?? data.sourceId}
                </p>
              ) : null}
              <EventPickerModal
                triggerLabel={data.sourceId ? "Change event" : "Choose event"}
                onPick={(ev) => {
                  const label = formatNoteEventPickerLabel(ev);
                  patchData({ sourceId: ev.id, sourceLabel: label });
                }}
              />
            </>
          );
        }
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Source ID</FieldLabel>
              <input
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                placeholder="Any identifier your renderer recognises"
                value={data.sourceId ?? ""}
                onChange={(e) => patchData({ sourceId: e.target.value || undefined })}
              />
            </div>
            <div>
              <FieldLabel>Display label</FieldLabel>
              <input
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                placeholder="Shown in the editor preview"
                value={data.sourceLabel ?? ""}
                onChange={(e) => patchData({ sourceLabel: e.target.value || undefined })}
              />
            </div>
          </div>
        );
      })();

      return (
        <CollapsibleFormSection title="Gallery configuration" defaultOpen>
          <FieldLabel>Source</FieldLabel>
          <select
            className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={data.sourceType ?? "custom"}
            onChange={(e) => patchData({ sourceType: e.target.value, sourceId: undefined, sourceLabel: undefined })}
          >
            {GALLERY_SOURCE_TYPES.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {GALLERY_SOURCE_TYPE_LABELS[sourceType]}
              </option>
            ))}
          </select>
          <div className="mt-3">{gallerySourcePicker}</div>
          <div className="mt-3">
            <FieldLabel>Photo limit</FieldLabel>
            <input
              type="number"
              min={1}
              max={100}
              className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              value={data.limit ?? ""}
              onChange={(e) => patchData({ limit: e.target.value ? Number(e.target.value) : undefined })}
            />
            <p className="mt-1 text-xs text-base-content/55">Maximum photos to display. Leave blank for the renderer default.</p>
          </div>
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "map") {
      const data = (block.data ?? { eventIds: [], mapMode: "events" }) as StoryMapEmbedData;
      const eventLabels = (dataRecord.eventLabels ?? {}) as Record<string, string>;
      return (
        <CollapsibleFormSection title="Map configuration" defaultOpen>
          <FieldLabel>Map mode</FieldLabel>
          <select
            className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={data.mapMode ?? "events"}
            onChange={(e) => patchData({ mapMode: e.target.value })}
          >
            {MAP_MODES.map((mode) => (
              <option key={mode} value={mode}>{MAP_MODE_LABELS[mode]}</option>
            ))}
          </select>
          <div className="mt-4">
            <FieldLabel>Events on this map</FieldLabel>
            {(data.eventIds ?? []).length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(data.eventIds ?? []).map((id) => (
                  <span
                    key={id}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/15 bg-base-200/60 px-2.5 py-0.5 text-xs font-medium text-base-content"
                  >
                    <span className="truncate">{eventLabels[id] ?? id}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-base-content/60 hover:bg-base-300/80 hover:text-base-content"
                      onClick={() => {
                        const nextLabels = { ...eventLabels };
                        delete nextLabels[id];
                        patchData({ eventIds: (data.eventIds ?? []).filter((x) => x !== id), eventLabels: nextLabels });
                      }}
                      aria-label={`Remove ${eventLabels[id] ?? id}`}
                    >
                      <X className="size-3 shrink-0" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-xs text-base-content/55">No events added yet.</p>
            )}
            <EventPickerModal
              triggerLabel="Add event"
              excludeEventIds={new Set(data.eventIds ?? [])}
              onPick={(event) => {
                const label = formatNoteEventPickerLabel(event);
                patchData({
                  eventIds: [...(data.eventIds ?? []), event.id],
                  eventLabels: { ...eventLabels, [event.id]: label },
                });
              }}
            />
          </div>
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "event") {
      const data = (block.data ?? {}) as StoryEventEmbedData;
      return (
        <CollapsibleFormSection title="Event configuration" defaultOpen>
          {data.eventLabel || data.eventId || data.eventXref ? (
            <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
              {data.eventLabel || data.eventXref || data.eventId}
            </p>
          ) : (
            <p className="mb-3 text-xs text-base-content/55">No event selected. Use the button below to find one.</p>
          )}
          <EventPickerModal
            triggerLabel={data.eventId ? "Change event" : "Choose event"}
            onPick={(event) => {
              const label = formatNoteEventPickerLabel(event);
              patchData({ eventId: event.id, eventLabel: label });
              onPatch({ subject: { type: "event", id: event.id, label } });
            }}
          />
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "familyGroup") {
      const data = (block.data ?? {}) as StoryFamilyGroupEmbedData;
      return (
        <CollapsibleFormSection title="Family group configuration" defaultOpen>
          <p className="mb-3 text-xs leading-relaxed text-base-content/55">
            Displays partners, children, and key events for the selected family unit.
          </p>
          {data.familyLabel || data.familyId || data.familyXref ? (
            <p className="mb-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] px-3 py-2 text-sm text-base-content/70">
              {data.familyLabel || data.familyXref || data.familyId}
            </p>
          ) : null}
          <FamilySearchPicker
            idPrefix={`story-family-group-${block.id}`}
            onPick={(fam) => {
              const label = familyUnionPrimaryLine(fam);
              patchData({ familyId: fam.id, familyXref: fam.xref, familyLabel: label });
              onPatch({ subject: { type: "family", id: fam.id, xref: fam.xref, label } });
            }}
          />
        </CollapsibleFormSection>
      );
    }

    if (block.embedKind === "recipe") {
      const data = (block.data ?? { ingredientGroups: [], stepGroups: [] }) as StoryRecipeEmbedData;
      return (
        <CollapsibleFormSection title="Recipe configuration" defaultOpen>
          <p className="mb-3 text-xs leading-relaxed text-base-content/55">
            Recipe embeds store structured ingredient and step data. A full ingredient and step editor is coming; for now configure the basic recipe details.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Yield</FieldLabel>
              <input
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                placeholder="e.g. 4 servings, 12 cookies"
                value={data.yield ?? ""}
                onChange={(e) => patchData({ yield: e.target.value || undefined })}
              />
            </div>
            <div>
              <FieldLabel>Prep time (min)</FieldLabel>
              <input
                type="number"
                min={0}
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.prepTimeMinutes ?? ""}
                onChange={(e) => patchData({ prepTimeMinutes: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <FieldLabel>Cook time (min)</FieldLabel>
              <input
                type="number"
                min={0}
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.cookTimeMinutes ?? ""}
                onChange={(e) => patchData({ cookTimeMinutes: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <FieldLabel>Total time (min)</FieldLabel>
              <input
                type="number"
                min={0}
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.totalTimeMinutes ?? ""}
                onChange={(e) => patchData({ totalTimeMinutes: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <FieldLabel>Difficulty</FieldLabel>
              <select
                className={cn("select select-bordered select-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                value={data.difficulty ?? ""}
                onChange={(e) => patchData({ difficulty: (e.target.value as StoryRecipeEmbedData["difficulty"]) || undefined })}
              >
                <option value="">Not set</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <FieldLabel>Cuisine</FieldLabel>
              <input
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                placeholder="e.g. Portuguese, Cape Verdean"
                value={data.cuisine ?? ""}
                onChange={(e) => patchData({ cuisine: e.target.value || undefined })}
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Source / credit</FieldLabel>
              <input
                className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
                placeholder="Where this recipe comes from"
                value={data.source ?? ""}
                onChange={(e) => patchData({ source: e.target.value || undefined })}
              />
            </div>
          </div>
          <p className="mt-4 text-xs text-base-content/45">
            {data.ingredientGroups.length} ingredient group{data.ingredientGroups.length === 1 ? "" : "s"} · {data.stepGroups.length} step group{data.stepGroups.length === 1 ? "" : "s"} — full editor coming soon.
          </p>
        </CollapsibleFormSection>
      );
    }

    return (
      <CollapsibleFormSection title="Source" defaultOpen>
        <p className="mb-3 text-xs leading-relaxed text-base-content/55">
          This embed type doesn't have a dedicated picker yet. Enter the source ID and a display label so
          the renderer can resolve it when it is ready.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Source ID</FieldLabel>
            <input
              className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              placeholder="Internal ID for the source record"
              value={String(dataRecord.documentId ?? dataRecord.subjectId ?? "")}
              onChange={(e) => patchData({ documentId: e.target.value || undefined, subjectId: e.target.value || undefined })}
            />
          </div>
          <div>
            <FieldLabel>Display label</FieldLabel>
            <input
              className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
              placeholder="Name shown in the editor preview"
              value={String(dataRecord.documentLabel ?? dataRecord.subjectLabel ?? "")}
              onChange={(e) => patchData({ documentLabel: e.target.value || undefined, subjectLabel: e.target.value || undefined })}
            />
          </div>
        </div>
      </CollapsibleFormSection>
    );
  })();

  return (
    <div className="space-y-3">
      <HelperCard title="Semantic embed">
        Embeds store the meaning and source for a structured block. The admin preview is only a lightweight visualization;
        final styling belongs to the public renderer.
      </HelperCard>

      <CollapsibleFormSection title="Source" defaultOpen>
        <FieldLabel>Preview</FieldLabel>
        <div className="mt-2 rounded-xl border border-base-content/10 bg-base-100/70 p-3 shadow-sm ring-1 ring-base-content/[0.04]">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-base-300 via-base-300/90 to-base-200/80 shadow-inner ring-1 ring-base-content/[0.06]">
            <div
              className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.04)_50%,transparent_60%)]"
              aria-hidden
            />
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-base-content">{title || "Untitled embed"}</p>
          <p className="mt-0.5 truncate text-xs text-base-content/50">{EMBED_KIND_LABELS[block.embedKind] ?? block.embedKind} · local draft</p>
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
                {EMBED_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-base-content/55">
            Choose what this block means. Kind-specific configuration lives in the data section, not in visual style fields.
          </p>
        </div>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Editorial metadata" defaultOpen={textSectionOpenDefault}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input
            className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            value={title}
            onChange={(e) => onPatch({ title: e.target.value, label: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Editorial note</FieldLabel>
          <input
            className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100", controlH)}
            placeholder="Optional short line for the preview"
            value={block.sublabel ?? ""}
            onChange={(e) => onPatch({ sublabel: e.target.value || undefined })}
          />
        </div>
        <div className="mt-3">
          <FieldLabel>Caption</FieldLabel>
          <StoryCaptionRichTextEditor
            caption={block.caption}
            placeholder="Optional caption…"
            touchComfort={touchComfort}
            onChange={(caption) => onPatch({ caption })}
          />
        </div>
        <div className="mt-4 space-y-3 rounded-lg border border-base-content/10 bg-base-100/50 p-3">
          <p className="text-xs font-semibold text-base-content/70">Story display</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideTitle}
              onChange={(e) => onPatch({ hideTitle: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display title in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the title editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-base-content/80">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-base-content/45 bg-base-100 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              checked={!block.hideCaption}
              onChange={(e) => onPatch({ hideCaption: !e.target.checked })}
            />
            <span>
              <span className="font-medium text-base-content">Display caption in story</span>
              <span className="mt-0.5 block text-xs leading-snug text-base-content/55">
                Keep the caption editable here, but omit it from every story rendering when this is off.
              </span>
            </span>
          </label>
        </div>
      </CollapsibleFormSection>

      {semanticConfig}

      <CollapsibleFormSection title="Preview behavior" defaultOpen={false}>
        <FieldLabel>Frame style</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["none", "minimal", "full"] as const).map((chrome) => {
            const chromeLabels = { none: "No frame", minimal: "Minimal", full: "Full" } as const;
            return (
              <button
                key={chrome}
                type="button"
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                  (presentation.chrome ?? "minimal") === chrome
                    ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
                    : "border-base-content/10 bg-base-100/60 text-base-content/55 hover:border-base-content/18",
                )}
                onClick={() => onPatch({ presentation: { ...presentation, chrome } })}
              >
                {chromeLabels[chrome]}
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-base-content/70">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={presentation.controls ?? false}
            onChange={(e) => onPatch({ presentation: { ...presentation, controls: e.target.checked } })}
          />
          Show preview/editor controls when this embed supports them
        </label>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="Advanced" defaultOpen={false}>
        <FieldLabel>Block ID</FieldLabel>
        <input readOnly className={cn("input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-200/40 font-mono text-xs", controlH)} value={block.id} />
        <div className="mt-3">
          <FieldLabel>Stored type</FieldLabel>
          <p className="mt-1 rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 font-mono text-xs text-base-content/75">embed</p>
        </div>
        <div className="mt-3">
          <FieldLabel>Compatibility aliases</FieldLabel>
          <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-base-content/50">
            label={block.label || "—"} · widthPreset={block.widthPreset ?? "—"} · layoutAlign={block.layoutAlign ?? "—"}
          </p>
        </div>
      </CollapsibleFormSection>
    </div>
  );
}
