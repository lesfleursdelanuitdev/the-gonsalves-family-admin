"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  FileText,
  FolderTree,
  Globe,
  GripVertical,
  Leaf,
  Minimize2,
  Pencil,
  PanelRight,
  PanelRightClose,
  Loader2,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPortal,
  DialogPopup,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StoryGlobalTipTapToolbar } from "@/components/admin/story-creator/StoryGlobalTipTapToolbar";
import { StoryTipTapCanvasToneProvider } from "@/components/admin/story-creator/story-tiptap-canvas-tone";
import { StoryDividerEditorChrome } from "@/components/admin/story-creator/StoryDividerEditorChrome";
import { StoryEditPreviewModeToggle } from "@/components/admin/story-creator/StoryEditPreviewModeToggle";
import { StoryTipTapEditor } from "@/components/admin/story-creator/StoryTipTapEditor";
import {
  StoryGlobalToolbarSelectionSync,
  StoryTiptapActiveEditorProvider,
} from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import { StoryTipTapStoryDocProvider } from "@/components/admin/story-creator/story-tiptap-story-doc-context";
import { StoryCreatorPreview } from "@/components/admin/story-creator/story-creator-preview";
import type { JSONContent } from "@tiptap/core";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
  StoryBlockPlaceAnnotation,
  StoryBlockDesign,
  StoryBlockRowLayout,
  StoryColumnNestedBlock,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlock,
  StoryContainerBlockProps,
  StoryDocument,
  StoryDocumentMetaPatch,
  StoryEmbedBlock,
  StoryMediaBlock,
  StoryRichTextBlock,
  StorySection,
  StorySplitContentBlock,
  StorySplitSupportBlock,
  StoryTableBlock,
} from "@/lib/admin/story-creator/story-types";
import { getStoryContainerPreset, getStoryRichTextPreset, newStoryId } from "@/lib/admin/story-creator/story-types";
import { loadStoryDocument, saveStoryDocument } from "@/lib/admin/story-creator/story-storage";
import { EmbedBlockContentRenderer } from "@/components/admin/story-creator/story-block-embed-content";
import { MediaBlockContentRenderer } from "@/components/admin/story-creator/story-block-media-content";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { StoryCreatorInspector, type StoryInspectorTab } from "@/components/admin/story-creator/StoryCreatorInspector";
import { useStoryEditorStore } from "@/features/story-creator/state/storyEditorStore";
import {
  StoryAddBlockBottomSheet,
  StoryBlockSettingsBottomSheet,
  StoryEditorBottomDock,
  StoryEditorDockPullTab,
  StoryMobileFullScreenPanel,
  type StoryMobileShellTab,
} from "@/components/admin/story-creator/story-creator-mobile";
import {
  OutlineRenameInput,
  StoryStructureSidebar,
  type OutlineRenameTarget,
} from "@/components/admin/story-creator/StoryStructureSidebar";
import "./story-preview-themes.css";
import {
  getContainerClasses,
  getContainerCustomBackgroundStyle,
  getContainerPresetEmptyHint,
} from "@/lib/admin/story-creator/story-container-preset-styles";
import { migrateStoryDocument } from "@/lib/admin/story-creator/migrate-story-document";
import { normalizeStorySlugInput, slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { ApiError } from "@/lib/infra/api";
import { mergeMediaEmbedRowLayoutPatch } from "@/lib/admin/story-creator/story-media-embed-layout-sync";
import { columnsBlockDepthInSection, MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import {
  resolveColumnGapRem,
  storyColumnStackStyle,
  storyColumnsGridStyle,
} from "@/lib/admin/story-creator/story-columns-layout";
import { moveStoryBlockRelative } from "@/lib/admin/story-creator/story-block-move-relative";
import {
  appendBlockIntoContainer,
  appendSupportingBlockToSplit,
  duplicateBlockRelativeToBlockId,
  findStoryBlockAnywhere,
  isBlockInSplitSupportingSlot,
  insertBlockAtIndex,
  insertBlockRelativeToBlockId,
  insertColumnNestedAt,
  patchBlockDesignInSection,
  patchBlockRowLayoutInSection,
  patchColumnSlotLayout,
  patchColumnsInSection,
  patchContainerInSection,
  patchBlockAnnotationsInSection,
  patchEmbedInSection,
  patchMediaInSection,
  patchSplitContentLayoutInSection,
  patchDividerBlockInSection,
  patchRichTextInSection,
  patchRichTextMetaInSection,
  patchTableInSection,
  setTableCellInSection,
  setTableColumnWidthsInSection,
  addTableRowInSection,
  removeTableRowInSection,
  addTableColumnInSection,
  removeTableColumnInSection,
  removeBlockById,
  type StoryDividerMetaPatch,
  type StoryRichTextMetaPatch,
} from "@/lib/admin/story-creator/story-doc-mutators";
import { StoryTableBlockEditor, type TableBlockOps } from "@/components/admin/story-creator/story-block-table-editor";
import {
  groupColumnNestedBlocksForLayout,
  groupStoryBlocksForLayout,
} from "@/lib/admin/story-creator/story-block-layout";
import { createDefaultSectionBlocks } from "@/lib/admin/story-creator/story-block-factory";
import {
  createColumnNestedBlockFromPreset,
  createSplitSupportBlockFromPreset,
  createStoryBlockFromPreset,
  STORY_ADD_BLOCK_DOCK_PRESET_GROUPS,
  STORY_ADD_BLOCK_PRESET_GROUPS,
  STORY_SPLIT_SUPPORT_ADD_PRESET_IDS,
  storyBlockDisplayLabel,
  type StoryAddBlockPresetId,
} from "@/lib/admin/story-creator/story-block-presets";
import { resolveStorySelection, type StorySelection } from "@/lib/admin/story-creator/story-selection";
import {
  StoryBlockPlacementDialog,
  type StoryBlockPlacementVariant,
} from "@/components/admin/story-creator/StoryBlockPlacementDialog";
import { StoryBlockRowDesignWrap } from "@/components/admin/story-creator/StoryBlockDesignWrap";
import { StoryEditorBlockFrame } from "@/components/admin/story-creator/StoryEditorBlockFrame";
import { StoryColumnInsertAffordance } from "@/components/admin/story-creator/StoryColumnInsertAffordance";
import { StoryEmptySlotAddBlockMenu } from "@/components/admin/story-creator/StoryEmptySlotAddBlockMenu";
import { StoryAddBlockPresetTypeGrid } from "@/components/admin/story-creator/StoryAddBlockPresetTypeGrid";
import {
  appendChildSection,
  findSectionPath,
  firstSectionInOrder,
  flattenSectionsDepthFirst,
  insertSectionAfterSibling,
  mapSectionInDocument,
  moveSectionInDocument,
  normalizeStorySection,
  removeSectionFromTree,
} from "@/lib/admin/story-creator/story-section-tree";

/** True when this block is focused — {@link resolveStorySelection} uses `section` or `column` depending on tree path (e.g. columns under a section container resolve as `section`). */
function isStoryChromeBlockSelected(storySelection: StorySelection | null, blockId: string): boolean {
  return !!storySelection && storySelection.block.id === blockId;
}

/** True when story chrome / outline targets this rich-text block, including the parent split row for main text. */
function isStoryRichTextBlockToolbarSelected(storySelection: StorySelection | null, richTextBlockId: string): boolean {
  if (!storySelection) return false;
  if (isStoryChromeBlockSelected(storySelection, richTextBlockId)) return true;
  const b = storySelection.block;
  return b.type === "splitContent" && b.text.id === richTextBlockId;
}

function wordsInText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function wordsInTipTapContent(doc: unknown): number {
  if (!doc || typeof doc !== "object") return 0;
  let text = "";
  const stack: unknown[] = [doc];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    const rec = node as Record<string, unknown>;
    if (typeof rec.text === "string") text += ` ${rec.text}`;
    const content = rec.content;
    if (Array.isArray(content)) {
      for (let i = content.length - 1; i >= 0; i -= 1) stack.push(content[i]);
    }
  }
  return wordsInText(text);
}

function wordsInStoryBlocks(blocks: readonly StoryBlock[]): number {
  let words = 0;
  for (const block of blocks) {
    if (block.type === "richText") {
      words += wordsInTipTapContent(block.doc);
      continue;
    }
    if (block.type === "columns") {
      words += wordsInStoryBlocks(block.columns[0].blocks as StoryBlock[]);
      words += wordsInStoryBlocks(block.columns[1].blocks as StoryBlock[]);
      continue;
    }
    if (block.type === "container") {
      words += wordsInStoryBlocks(block.children ?? []);
      continue;
    }
    if (block.type === "splitContent") {
      words += wordsInTipTapContent(block.text.doc);
      words += wordsInStoryBlocks(block.supporting.blocks as StoryBlock[]);
      continue;
    }
    if (block.type === "table") {
      for (const row of block.cells ?? []) {
        for (const cell of row ?? []) words += wordsInTipTapContent(cell);
      }
    }
  }
  return words;
}

function StoryCanvasRichTextEditor({
  editorKey,
  rich,
  onJson,
  isLg,
  surface = "canvas",
  syncGlobalToolbarSelection = false,
}: {
  editorKey: string;
  rich: StoryRichTextBlock;
  onJson: (json: JSONContent) => void;
  isLg: boolean;
  /** `canvas`: flat shell inside section canvas. `card`: bordered shell when nested in containers/columns so the edit region is visible. */
  surface?: "canvas" | "card";
  syncGlobalToolbarSelection?: boolean;
}) {
  const preset = getStoryRichTextPreset(rich);
  return (
    <StoryTipTapEditor
      editorKey={editorKey}
      content={rich.doc}
      onChange={onJson}
      toolbarDensity={isLg ? "default" : "touch"}
      surface={surface}
      richTextPreset={preset}
      listVariant={preset === "list" ? (rich.listVariant ?? "bullet") : undefined}
      quoteStyle={rich.quoteStyle}
      verseSpacing={rich.verseSpacing}
      headingLevel={preset === "heading" ? rich.headingLevel : undefined}
      syncGlobalToolbarSelection={syncGlobalToolbarSelection}
    />
  );
}

const VERSE_WIDTH_SNAPS = [25, 33, 50, 66, 75, 100];

function snapVerseWidth(pct: number): number {
  for (const s of VERSE_WIDTH_SNAPS) {
    if (Math.abs(pct - s) <= 3) return s;
  }
  return Math.min(100, Math.max(15, Math.round(pct)));
}

function StoryCanvasVerseResizableEditor({
  editorKey,
  rich,
  onJson,
  isLg,
  surface = "canvas",
  syncGlobalToolbarSelection = false,
  onResizeWidth,
}: {
  editorKey: string;
  rich: StoryRichTextBlock;
  onJson: (json: JSONContent) => void;
  isLg: boolean;
  surface?: "canvas" | "card";
  syncGlobalToolbarSelection?: boolean;
  onResizeWidth?: (pct: number) => void;
}) {
  const preset = getStoryRichTextPreset(rich);
  const showHandles = (preset === "verse" || preset === "quote") && Boolean(onResizeWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startWidthPx: number;
    parentWidthPx: number;
    scopeEl: HTMLElement;
    side: "left" | "right";
  } | null>(null);
  const lastWidthPctRef = useRef(100);

  function onSidePointerDown(e: ReactPointerEvent<HTMLDivElement>, side: "left" | "right") {
    if (!showHandles || !onResizeWidth) return;
    e.stopPropagation();
    e.preventDefault();
    const scopeEl = e.currentTarget.closest<HTMLElement>("[data-story-block-scope]");
    const parentEl = scopeEl?.parentElement;
    if (!scopeEl || !parentEl) return;
    const scopeRect = scopeEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const cs = window.getComputedStyle(parentEl);
    const parentContentWidth = parentRect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    dragRef.current = { startX: e.clientX, startWidthPx: scopeRect.width, parentWidthPx: parentContentWidth, scopeEl, side };
    lastWidthPctRef.current = Math.round((scopeRect.width / parentContentWidth) * 100);
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  return (
    <div className={cn("group/verseresize relative min-w-0", showHandles && "px-1")}>
      {showHandles ? (
        <div
          className={cn(
            "absolute inset-y-0 -left-2 z-20 flex w-4 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity duration-150 group-hover/verseresize:opacity-100",
            isDragging && "opacity-100",
          )}
          onPointerDown={(e) => onSidePointerDown(e, "left")}
          onPointerMove={(e) => {
            const state = dragRef.current;
            if (!state) return;
            const delta = state.side === "right" ? e.clientX - state.startX : state.startX - e.clientX;
            const pct = Math.min(100, Math.max(15, Math.round(((state.startWidthPx + delta) / state.parentWidthPx) * 100)));
            lastWidthPctRef.current = pct;
            state.scopeEl.style.width = `${pct}%`;
            state.scopeEl.style.maxWidth = "100%";
          }}
          onPointerUp={() => {
            const state = dragRef.current;
            if (!state || !onResizeWidth) return;
            state.scopeEl.style.width = "";
            state.scopeEl.style.maxWidth = "";
            dragRef.current = null;
            setIsDragging(false);
            onResizeWidth(snapVerseWidth(lastWidthPctRef.current));
          }}
          onPointerCancel={() => {
            const state = dragRef.current;
            if (!state || !onResizeWidth) return;
            state.scopeEl.style.width = "";
            state.scopeEl.style.maxWidth = "";
            dragRef.current = null;
            setIsDragging(false);
            onResizeWidth(snapVerseWidth(lastWidthPctRef.current));
          }}
        >
          <div className="h-10 w-1 rounded-full bg-primary/60 shadow" />
        </div>
      ) : null}
      {showHandles ? (
        <div
          className={cn(
            "absolute inset-y-0 -right-2 z-20 flex w-4 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity duration-150 group-hover/verseresize:opacity-100",
            isDragging && "opacity-100",
          )}
          onPointerDown={(e) => onSidePointerDown(e, "right")}
          onPointerMove={(e) => {
            const state = dragRef.current;
            if (!state) return;
            const delta = state.side === "right" ? e.clientX - state.startX : state.startX - e.clientX;
            const pct = Math.min(100, Math.max(15, Math.round(((state.startWidthPx + delta) / state.parentWidthPx) * 100)));
            lastWidthPctRef.current = pct;
            state.scopeEl.style.width = `${pct}%`;
            state.scopeEl.style.maxWidth = "100%";
          }}
          onPointerUp={() => {
            const state = dragRef.current;
            if (!state || !onResizeWidth) return;
            state.scopeEl.style.width = "";
            state.scopeEl.style.maxWidth = "";
            dragRef.current = null;
            setIsDragging(false);
            onResizeWidth(snapVerseWidth(lastWidthPctRef.current));
          }}
          onPointerCancel={() => {
            const state = dragRef.current;
            if (!state || !onResizeWidth) return;
            state.scopeEl.style.width = "";
            state.scopeEl.style.maxWidth = "";
            dragRef.current = null;
            setIsDragging(false);
            onResizeWidth(snapVerseWidth(lastWidthPctRef.current));
          }}
        >
          <div className="h-10 w-1 rounded-full bg-primary/60 shadow" />
        </div>
      ) : null}
      <div className="max-w-full overflow-x-auto">
        <StoryCanvasRichTextEditor
          editorKey={editorKey}
          rich={rich}
          onJson={onJson}
          isLg={isLg}
          surface={surface}
          syncGlobalToolbarSelection={syncGlobalToolbarSelection}
        />
      </div>
    </div>
  );
}

function formatLastSaved(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 15_000) return "Just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const STORY_LEFT_PANEL_WIDTH_KEY = "story-creator:left-panel-width";
const STORY_LEFT_PANEL_MIN = 260;
const STORY_LEFT_PANEL_DEFAULT = 340;
const STORY_LEFT_PANEL_MAX = 520;
const STORY_RIGHT_PANEL_WIDTH_KEY = "story-creator:right-panel-width";
const STORY_RIGHT_PANEL_MIN = 260;
const STORY_RIGHT_PANEL_DEFAULT = 320;
const STORY_RIGHT_PANEL_MAX = 520;
const STORY_PANEL_TRANSITION = "transition-[width] duration-[250ms] ease-in-out";

function clampStoryLeftPanelWidth(px: number) {
  return Math.min(STORY_LEFT_PANEL_MAX, Math.max(STORY_LEFT_PANEL_MIN, Math.round(px)));
}

function clampStoryRightPanelWidth(px: number) {
  return Math.min(STORY_RIGHT_PANEL_MAX, Math.max(STORY_RIGHT_PANEL_MIN, Math.round(px)));
}

function cloneDoc(d: StoryDocument): StoryDocument {
  return JSON.parse(JSON.stringify(d)) as StoryDocument;
}

function mapDocSection(doc: StoryDocument, sectionId: string, fn: (sec: StorySection) => StorySection): StoryDocument {
  return mapSectionInDocument(doc, sectionId, fn);
}


const SPLIT_SNAP_POINTS = [20, 25, 33, 40, 50] as const;

function snapSplitWidth(pct: number): number {
  for (const s of SPLIT_SNAP_POINTS) {
    if (Math.abs(pct - s) <= 3) return s;
  }
  return Math.min(50, Math.max(20, pct));
}

function StorySplitContentEditorLayout({
  block,
  textEditor,
  supportingAside,
  onResizeSupportingWidth,
}: {
  block: StorySplitContentBlock;
  textEditor: ReactNode;
  supportingAside: ReactNode;
  onResizeSupportingWidth?: (pct: number) => void;
}) {
  const containerId = useId().replace(/:/g, "");
  const widthPct = block.supportingWidthPct ?? 33;
  const gapRem = block.supportingGapRem ?? 1.5;
  const side = block.supportingSide ?? "right";
  const floatPos = block.supportingFloatPosition ?? "top";
  const alignSelf = floatPos === "center" ? "center" : floatPos === "bottom" ? "end" : "start";
  const mdGridCols = side === "left" ? `${widthPct}% 1fr` : `1fr ${widthPct}%`;
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{ startX: number; startWidthPx: number; containerWidthPx: number; containerEl: HTMLElement } | null>(null);
  const lastPctRef = useRef(widthPct);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!onResizeSupportingWidth) return;
    e.stopPropagation();
    e.preventDefault();
    const containerEl = e.currentTarget.closest<HTMLElement>("[data-split-container]");
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const cs = window.getComputedStyle(containerEl);
    const containerW = containerRect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const railEl = containerEl.querySelector<HTMLElement>("[data-split-rail]");
    const railWidth = railEl ? railEl.getBoundingClientRect().width : (containerW * widthPct) / 100;
    dragState.current = { startX: e.clientX, startWidthPx: railWidth, containerWidthPx: containerW, containerEl };
    lastPctRef.current = widthPct;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    if (!state) return;
    const delta = side === "left" ? e.clientX - state.startX : state.startX - e.clientX;
    const pct = Math.min(50, Math.max(20, Math.round(((state.startWidthPx + delta) / state.containerWidthPx) * 100)));
    lastPctRef.current = pct;
    const cols = side === "left" ? `${pct}% 1fr` : `1fr ${pct}%`;
    state.containerEl.style.gridTemplateColumns = cols;
  }

  function onHandlePointerUp(_e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    if (!state) return;
    state.containerEl.style.gridTemplateColumns = "";
    dragState.current = null;
    setIsDragging(false);
    onResizeSupportingWidth?.(snapSplitWidth(lastPctRef.current));
  }

  const handleEvents = {
    onPointerDown: onHandlePointerDown,
    onPointerMove: onHandlePointerMove,
    onPointerUp: onHandlePointerUp,
    onPointerCancel: onHandlePointerUp,
  };

  const handleBar = onResizeSupportingWidth ? (
    <div
      className={cn(
        "group/splithandle absolute inset-y-0 z-20 flex w-4 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity duration-150 hover:opacity-100",
        isDragging && "opacity-100",
        side === "left" ? "-right-2" : "-left-2",
      )}
      {...handleEvents}
    >
      <div className="h-10 w-1 rounded-full bg-primary/60 shadow" />
    </div>
  ) : null;

  const rail = (
    <div
      data-split-rail
      className="relative rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-3"
      style={{ alignSelf }}
    >
      {handleBar}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Supporting content</p>
      {supportingAside}
    </div>
  );
  const textCol = <div className="min-w-0" style={{ alignSelf: "stretch" }}>{textEditor}</div>;

  return (
    <>
      {/* scoped grid layout: two columns at md+, stacked on mobile */}
      <style dangerouslySetInnerHTML={{ __html: `@media (min-width: 768px){[data-split-container="${containerId}"]{display:grid;grid-template-columns:${mdGridCols};column-gap:${gapRem}rem;}}` }} />
      <div data-split-container={containerId} className="flex flex-col gap-4">
        {side === "left" ? rail : textCol}
        {side === "left" ? textCol : rail}
      </div>
    </>
  );
}

function storyAddPresetLabel(id: StoryAddBlockPresetId): string {
  for (const g of STORY_ADD_BLOCK_PRESET_GROUPS) {
    const it = g.items.find((x) => x.id === id);
    if (it) return it.label;
  }
  return id;
}

function storyKindUiLabel(kind: StoryDocument["kind"]): string {
  switch (kind ?? "story") {
    case "article":
      return "Article";
    case "post":
      return "Post";
    default:
      return "Story";
  }
}

/** Lowercase label for compact header pills (matches `StoryDocumentKind`). */
function storyKindPillText(kind: StoryDocument["kind"] | undefined): string {
  return kind ?? "story";
}

/** Publish-style state for the header: published, saved draft (clean), or draft with local edits. */
function storyDocumentPublishStateText(
  status: StoryDocument["status"],
  editorDirty: boolean,
): "draft" | "saved" | "published" {
  if (status === "published") return "published";
  return editorDirty ? "draft" : "saved";
}

type StoryBlockPlacementModalArgs = {
  flow: "add" | "duplicate";
  targetBlockId: string;
  variant: StoryBlockPlacementVariant;
  allowNestedColumns: boolean;
  initialAddPosition?: "above" | "below";
  presetAllowlist?: readonly StoryAddBlockPresetId[] | null;
};

type StoryNestedColumnsGridProps = {
  sectionId: string;
  columnsBlock: StoryColumnsBlock;
  /** 1 = first columns under the section; 2 = columns nested inside a column. */
  depth: number;
  isSm: boolean;
  isLg: boolean;
  storySelection: StorySelection | null;
  insertColumnNested: (
    sectionId: string,
    columnsBlockId: string,
    columnIndex: 0 | 1,
    atIndex: number,
    presetId: StoryAddBlockPresetId,
  ) => void;
  removeBlock: (sectionId: string, blockId: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setInspectorTab: (t: StoryInspectorTab) => void;
  setInspectorOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setBlockSettingsSheetOpen: (open: boolean) => void;
  updateRichBlock: (sectionId: string, blockId: string, json: JSONContent) => void;
  patchRichBlockRowLayout: (sectionId: string, blockId: string, patch: Partial<StoryBlockRowLayout>) => void;
  openBlockPlacement: (args: StoryBlockPlacementModalArgs) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  appendIntoContainer: (sectionId: string, containerId: string, block: StoryBlock) => void;
  appendSplitSupportingPreset: (sectionId: string, splitBlockId: string, presetId: StoryAddBlockPresetId) => void;
  tableOps?: (sectionId: string, blockId: string) => TableBlockOps;
};

type StorySplitSupportBlockSectionChromeProps = {
  sectionId: string;
  splitBlockId: string;
  sb: StorySplitSupportBlock;
  supportPlacementVariant: StoryBlockPlacementVariant;
  allowNestedColumns: boolean;
  isLg: boolean;
  isSm: boolean;
  /** Floating toolbar depth for this supporting block. */
  chromeDepth?: number;
  /** `depth` passed to {@link StoryNestedColumnsGrid} when `sb` is columns. */
  columnsNestedDepth: number;
  storySelection: StorySelection | null;
  insertColumnNested: StoryNestedColumnsGridProps["insertColumnNested"];
  removeBlock: (sectionId: string, blockId: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setInspectorTab: (t: StoryInspectorTab) => void;
  setInspectorOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setBlockSettingsSheetOpen: (open: boolean) => void;
  updateRichBlock: (sectionId: string, blockId: string, json: JSONContent) => void;
  patchRichBlockRowLayout: (sectionId: string, blockId: string, patch: Partial<StoryBlockRowLayout>) => void;
  openBlockPlacement: (args: StoryBlockPlacementModalArgs) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  appendIntoContainer: (sectionId: string, containerId: string, block: StoryBlock) => void;
  appendSplitSupportingPreset: (sectionId: string, splitBlockId: string, presetId: StoryAddBlockPresetId) => void;
  tableOps?: (sectionId: string, blockId: string) => TableBlockOps;
  renderNestedContainer: (nest: StoryContainerBlock) => ReactNode;
};

function StorySplitSupportBlockSectionChrome({
  sectionId,
  splitBlockId: _splitBlockId,
  sb,
  supportPlacementVariant,
  allowNestedColumns,
  isLg,
  isSm,
  chromeDepth = 1,
  columnsNestedDepth,
  storySelection,
  insertColumnNested,
  removeBlock,
  setSelectedBlockId,
  setInspectorTab,
  setInspectorOpen,
  setBlockSettingsSheetOpen,
  updateRichBlock,
  patchRichBlockRowLayout,
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
  appendSplitSupportingPreset,
  tableOps,
  renderNestedContainer,
}: StorySplitSupportBlockSectionChromeProps) {
  const asBlock = sb as StoryBlock;
  const nestedSelected = isStoryChromeBlockSelected(storySelection, sb.id);
  const splitAllowlist = STORY_SPLIT_SUPPORT_ADD_PRESET_IDS;
  const openInspector = () => {
    setSelectedBlockId(sb.id);
    setInspectorTab("block");
    if (isLg) setInspectorOpen(true);
    else setBlockSettingsSheetOpen(true);
  };
  return (
    <StoryEditorBlockFrame
      block={asBlock}
      frameLabel={storyBlockDisplayLabel(asBlock)}
      selected={nestedSelected}
      isLg={isLg}
      chromeDepth={chromeDepth}
      onSelect={() => {
        setSelectedBlockId(sb.id);
        setInspectorTab("block");
      }}
      onAddAbove={() =>
        openBlockPlacement({
          flow: "add",
          targetBlockId: sb.id,
          variant: supportPlacementVariant,
          allowNestedColumns,
          initialAddPosition: "above",
          presetAllowlist: splitAllowlist,
        })
      }
      onAddBelow={() =>
        openBlockPlacement({
          flow: "add",
          targetBlockId: sb.id,
          variant: supportPlacementVariant,
          allowNestedColumns,
          initialAddPosition: "below",
          presetAllowlist: splitAllowlist,
        })
      }
      onDuplicate={() =>
        openBlockPlacement({
          flow: "duplicate",
          targetBlockId: sb.id,
          variant: supportPlacementVariant,
          allowNestedColumns,
        })
      }
      onDelete={() => removeBlock(sectionId, sb.id)}
      onOpenInspector={openInspector}
      onMove={(dir) => moveBlock(sectionId, sb.id, dir)}
      contentClassName={undefined}
    >
      {sb.type === "richText" ? (
        <StoryCanvasVerseResizableEditor
          editorKey={`${sectionId}-${sb.id}`}
          rich={sb}
          onJson={(json) => updateRichBlock(sectionId, sb.id, json)}
          isLg={isLg}
          surface="card"
          syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, sb.id)}
          onResizeWidth={(pct) =>
            patchRichBlockRowLayout(sectionId, sb.id, {
              widthMode: pct >= 100 ? "full" : "custom",
              widthValue: pct >= 100 ? undefined : pct,
              widthUnit: "%",
              displayMode: "block",
              float: undefined,
            })
          }
        />
      ) : sb.type === "media" ? (
        <MediaEmbedCanvasCard
          compact
          block={sb}
          onConfigure={() => {
            setSelectedBlockId(sb.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
        />
      ) : sb.type === "embed" ? (
        <EmbedCanvasCard
          block={sb}
          compact
          onConfigure={() => {
            setSelectedBlockId(sb.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
        />
      ) : sb.type === "table" ? (
        tableOps ? (
          <StoryTableBlockEditor block={sb} ops={tableOps(sectionId, sb.id)} />
        ) : (
          <div className="rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-4 text-sm text-neutral-400">Table</div>
        )
      ) : null}
    </StoryEditorBlockFrame>
  );
}

function StoryNestedColumnsGrid({
  sectionId,
  columnsBlock,
  depth,
  isSm,
  isLg,
  storySelection,
  insertColumnNested,
  removeBlock,
  setSelectedBlockId,
  setInspectorTab,
  setInspectorOpen,
  setBlockSettingsSheetOpen,
  updateRichBlock,
  patchRichBlockRowLayout,
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
  appendSplitSupportingPreset,
  tableOps,
}: StoryNestedColumnsGridProps) {
  const allowNestedColumns = depth < MAX_STORY_COLUMNS_NEST_DEPTH;
  const layoutMode = isSm ? "two-column" : "stacked";
  const gapRem = resolveColumnGapRem(columnsBlock);
  const gridStyle: CSSProperties =
    depth >= 2
      ? {
          ...storyColumnsGridStyle(columnsBlock, layoutMode),
          gap: `${Math.max(0.35, gapRem * 0.65)}rem`,
        }
      : storyColumnsGridStyle(columnsBlock, layoutMode);
  const cellPad = depth >= 2 ? "p-2 sm:p-2.5" : "p-3";
  const cellMinH = depth >= 2 ? "min-h-[8rem]" : "min-h-[10rem]";
  const cellBorder = depth >= 2 ? "border-black/20 ring-primary/10" : "border-black/20 hover:border-black/25";
  const cellActiveBorder = depth >= 2 ? "border-primary/35 ring-1 ring-primary/12" : "border-primary/40 ring-1 ring-primary/18";

  function renderContainerInColumn(nest: StoryContainerBlock) {
    const nestSelected = isStoryChromeBlockSelected(storySelection, nest.id);
    const colContainerEmptyHint = getContainerPresetEmptyHint(getStoryContainerPreset(nest.props));
    const colContainerShellClass = getContainerClasses(nest, "editor", {
      selected: nestSelected,
      emptyChildren: nest.children.length === 0,
    });
    const colContainerShellStyle = getContainerCustomBackgroundStyle(nest.props);
    const frameLabel = nest.props.label?.trim() || "Container";
    const placementVariant: StoryBlockPlacementVariant = "column";

    function renderColContainerChildBody(child: StoryBlock) {
      if (child.type === "richText") {
        return (
          <StoryCanvasVerseResizableEditor
            editorKey={`${sectionId}-${nest.id}-${child.id}`}
            rich={child}
            onJson={(json) => updateRichBlock(sectionId, child.id, json)}
            isLg={isLg}
            surface="card"
            syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, child.id)}
            onResizeWidth={(pct) =>
              patchRichBlockRowLayout(sectionId, child.id, {
                widthMode: pct >= 100 ? "full" : "custom",
                widthValue: pct >= 100 ? undefined : pct,
                widthUnit: "%",
                displayMode: "block",
                float: undefined,
              })
            }
          />
        );
      }
      if (child.type === "media") {
        return (
          <MediaEmbedCanvasCard
            compact
            block={child}
            onConfigure={() => {
              setSelectedBlockId(child.id);
              setInspectorTab("block");
              if (isLg) setInspectorOpen(true);
              else setBlockSettingsSheetOpen(true);
            }}
          />
        );
      }
      if (child.type === "embed") {
        return (
          <EmbedCanvasCard
            block={child}
            compact
            onConfigure={() => {
              setSelectedBlockId(child.id);
              setInspectorTab("block");
              if (isLg) setInspectorOpen(true);
              else setBlockSettingsSheetOpen(true);
            }}
          />
        );
      }
      if (child.type === "divider") {
        return <StoryDividerEditorChrome block={child} />;
      }
      if (child.type === "table") {
        return tableOps ? (
          <StoryTableBlockEditor block={child} ops={tableOps(sectionId, child.id)} />
        ) : (
          <div className="rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-4 text-sm text-neutral-400">Table</div>
        );
      }
      if (child.type === "splitContent") {
        return (
          <StorySplitContentEditorLayout
            block={child}
            textEditor={
              <div className="max-w-full">
                <StoryCanvasVerseResizableEditor
                  editorKey={`${sectionId}-${nest.id}-${child.text.id}`}
                  rich={child.text}
                  onJson={(json) => updateRichBlock(sectionId, child.text.id, json)}
                  isLg={isLg}
                  surface="card"
                  syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, child.text.id)}
                  onResizeWidth={(pct) =>
                    patchRichBlockRowLayout(sectionId, child.text.id, {
                      widthMode: pct >= 100 ? "full" : "custom",
                      widthValue: pct >= 100 ? undefined : pct,
                      widthUnit: "%",
                      displayMode: "block",
                      float: undefined,
                    })
                  }
                />
              </div>
            }
            supportingAside={
              <div className="space-y-2">
                {child.supporting.blocks.length === 0 ? (
                  <p className="text-center text-xs text-base-content/45">Empty supporting area.</p>
                ) : (
                  child.supporting.blocks.map((sb) => (
                    <StorySplitSupportBlockSectionChrome
                      key={sb.id}
                      sectionId={sectionId}
                      splitBlockId={child.id}
                      sb={sb}
                      supportPlacementVariant="column"
                      allowNestedColumns={allowNestedColumns}
                      isLg={isLg}
                      isSm={isSm}
                      chromeDepth={depth + 1}
                      columnsNestedDepth={depth + 1}
                      storySelection={storySelection}
                      insertColumnNested={insertColumnNested}
                      removeBlock={removeBlock}
                      setSelectedBlockId={setSelectedBlockId}
                      setInspectorTab={setInspectorTab}
                      setInspectorOpen={setInspectorOpen}
                      setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                      updateRichBlock={updateRichBlock}
                      patchRichBlockRowLayout={patchRichBlockRowLayout}
                      openBlockPlacement={openBlockPlacement}
                      moveBlock={moveBlock}
                      appendIntoContainer={appendIntoContainer}
                      appendSplitSupportingPreset={appendSplitSupportingPreset}
                      tableOps={tableOps}
                      renderNestedContainer={(cn) => renderContainerInColumn(cn)}
                    />
                  ))
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full gap-2 border-base-content/15 font-medium text-xs",
                    )}
                  >
                    Add to supporting area
                    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 min-w-[11rem] overflow-y-auto">
                    {STORY_SPLIT_SUPPORT_ADD_PRESET_IDS.map((id) => (
                      <DropdownMenuItem key={id} className="text-xs font-medium" onClick={() => appendSplitSupportingPreset(sectionId, child.id, id)}>
                        {storyAddPresetLabel(id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        );
      }
      if (child.type === "columns") {
        return (
          <StoryNestedColumnsGrid
            sectionId={sectionId}
            columnsBlock={child}
            depth={depth + 1}
            isSm={isSm}
            isLg={isLg}
            storySelection={storySelection}
            insertColumnNested={insertColumnNested}
            removeBlock={removeBlock}
            setSelectedBlockId={setSelectedBlockId}
            setInspectorTab={setInspectorTab}
            setInspectorOpen={setInspectorOpen}
            setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
            updateRichBlock={updateRichBlock}
            patchRichBlockRowLayout={patchRichBlockRowLayout}
            openBlockPlacement={openBlockPlacement}
            moveBlock={moveBlock}
            appendIntoContainer={appendIntoContainer}
            appendSplitSupportingPreset={appendSplitSupportingPreset}
            tableOps={tableOps}
          />
        );
      }
      return renderContainerInColumn(child);
    }

    function renderColContainerChildCard(child: StoryBlock) {
      const sel = isStoryChromeBlockSelected(storySelection, child.id);
      const v: StoryBlockPlacementVariant = child.type === "container" ? "container" : "column";
      const openInspector = () => {
        setSelectedBlockId(child.id);
        setInspectorTab("block");
        if (isLg) setInspectorOpen(true);
        else setBlockSettingsSheetOpen(true);
      };
      return (
        <StoryEditorBlockFrame
          block={child}
          frameLabel={storyBlockDisplayLabel(child)}
          selected={sel}
          isLg={isLg}
          chromeDepth={depth}
          visualQuietContainer={child.type === "container"}
          onSelect={() => {
            setSelectedBlockId(child.id);
            setInspectorTab("block");
          }}
          onAddAbove={() =>
            openBlockPlacement({
              flow: "add",
              targetBlockId: child.id,
              variant: v,
              allowNestedColumns,
              initialAddPosition: "above",
            })
          }
          onAddBelow={() =>
            openBlockPlacement({
              flow: "add",
              targetBlockId: child.id,
              variant: v,
              allowNestedColumns,
              initialAddPosition: "below",
            })
          }
          onAddInsideContainer={
            child.type === "container"
              ? () =>
                  openBlockPlacement({
                    flow: "add",
                    targetBlockId: child.children?.[0]?.id ?? child.id,
                    variant: "container",
                    allowNestedColumns,
                  })
              : undefined
          }
          onDuplicate={() =>
            openBlockPlacement({
              flow: "duplicate",
              targetBlockId: child.id,
              variant: v,
              allowNestedColumns,
            })
          }
          onDelete={() => removeBlock(sectionId, child.id)}
          onOpenInspector={openInspector}
          onMove={(dir) => moveBlock(sectionId, child.id, dir)}
        >
          {renderColContainerChildBody(child)}
        </StoryEditorBlockFrame>
      );
    }

    /* Body only: parent {@link renderColumnNestedChrome} or {@link renderColContainerChildCard} already wraps this container in {@link StoryEditorBlockFrame}. */
    return (
      <div className={colContainerShellClass} style={colContainerShellStyle ?? undefined}>
        {nest.props.label?.trim() ? (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{nest.props.label.trim()}</p>
        ) : null}
        {nest.children.length === 0 ? (
          <>
            <p className="text-center text-xs leading-relaxed text-neutral-600">{colContainerEmptyHint}</p>
            <StoryColumnInsertAffordance
              mobile={!isLg}
              allowNestedColumns={allowNestedColumns}
              onInsert={(presetId) => {
                const b = createColumnNestedBlockFromPreset(presetId);
                appendIntoContainer(sectionId, nest.id, b as StoryBlock);
              }}
            />
          </>
        ) : (
          <div className="space-y-2">
            {groupStoryBlocksForLayout(nest.children).map((group) => {
              if (group.kind === "float-wrap") {
                return (
                  <div key={`${group.float.id}-${group.text.id}`} className="flow-root min-w-0">
                    <StoryBlockRowDesignWrap block={group.float} floated>
                      {renderColContainerChildCard(group.float)}
                    </StoryBlockRowDesignWrap>
                    <StoryBlockRowDesignWrap block={group.text} floated={false} wrapperClassName="min-w-0">
                      {renderColContainerChildCard(group.text)}
                    </StoryBlockRowDesignWrap>
                  </div>
                );
              }
              const child = group.block;
              return (
                <StoryBlockRowDesignWrap key={child.id} block={child} floated={false}>
                  {renderColContainerChildCard(child)}
                </StoryBlockRowDesignWrap>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderColumnNestedChrome(nested: StoryColumnNestedBlock) {
    const nestedSelected = isStoryChromeBlockSelected(storySelection, nested.id);
    const asBlock = nested as StoryBlock;
    const placementVariant: StoryBlockPlacementVariant = nested.type === "container" ? "container" : "column";
    const openInspector = () => {
      setSelectedBlockId(nested.id);
      setInspectorTab("block");
      if (isLg) setInspectorOpen(true);
      else setBlockSettingsSheetOpen(true);
    };

    return (
      <StoryEditorBlockFrame
        block={asBlock}
        frameLabel={storyBlockDisplayLabel(asBlock)}
        selected={nestedSelected}
        isLg={isLg}
        chromeDepth={depth}
        visualQuietContainer={nested.type === "container"}
        onSelect={() => {
          setSelectedBlockId(nested.id);
          setInspectorTab("block");
        }}
        onAddAbove={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: nested.id,
            variant: placementVariant,
            allowNestedColumns,
            initialAddPosition: "above",
          })
        }
        onAddBelow={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: nested.id,
            variant: placementVariant,
            allowNestedColumns,
            initialAddPosition: "below",
          })
        }
        onAddInsideContainer={
          nested.type === "container"
            ? () =>
                openBlockPlacement({
                  flow: "add",
                  targetBlockId: nested.children?.[0]?.id ?? nested.id,
                  variant: "container",
                  allowNestedColumns,
                })
            : undefined
        }
        onDuplicate={() =>
          openBlockPlacement({
            flow: "duplicate",
            targetBlockId: nested.id,
            variant: placementVariant,
            allowNestedColumns,
          })
        }
        onDelete={() => removeBlock(sectionId, nested.id)}
        onOpenInspector={openInspector}
        onMove={(dir) => moveBlock(sectionId, nested.id, dir)}
      >
        {nested.type === "richText" ? (
          <StoryCanvasVerseResizableEditor
            editorKey={`${sectionId}-${columnsBlock.id}-${nested.id}`}
            rich={nested}
            onJson={(json) => updateRichBlock(sectionId, nested.id, json)}
            isLg={isLg}
            surface="card"
            syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, nested.id)}
            onResizeWidth={(pct) =>
              patchRichBlockRowLayout(sectionId, nested.id, {
                widthMode: pct >= 100 ? "full" : "custom",
                widthValue: pct >= 100 ? undefined : pct,
                widthUnit: "%",
                displayMode: "block",
                float: undefined,
              })
            }
          />
        ) : nested.type === "media" ? (
          <MediaEmbedCanvasCard
            compact
            block={nested}
            onConfigure={() => {
              setSelectedBlockId(nested.id);
              setInspectorTab("block");
              if (isLg) setInspectorOpen(true);
              else setBlockSettingsSheetOpen(true);
            }}
          />
        ) : nested.type === "columns" ? (
          <StoryNestedColumnsGrid
            sectionId={sectionId}
            columnsBlock={nested}
            depth={depth + 1}
            isSm={isSm}
            isLg={isLg}
            storySelection={storySelection}
            insertColumnNested={insertColumnNested}
            removeBlock={removeBlock}
            setSelectedBlockId={setSelectedBlockId}
            setInspectorTab={setInspectorTab}
            setInspectorOpen={setInspectorOpen}
            setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
            updateRichBlock={updateRichBlock}
            patchRichBlockRowLayout={patchRichBlockRowLayout}
            openBlockPlacement={openBlockPlacement}
            moveBlock={moveBlock}
            appendIntoContainer={appendIntoContainer}
            appendSplitSupportingPreset={appendSplitSupportingPreset}
            tableOps={tableOps}
          />
        ) : nested.type === "embed" ? (
          <EmbedCanvasCard
            block={nested}
            compact
            onConfigure={() => {
              setSelectedBlockId(nested.id);
              setInspectorTab("block");
              if (isLg) setInspectorOpen(true);
              else setBlockSettingsSheetOpen(true);
            }}
          />
        ) : nested.type === "table" ? (
          tableOps ? (
            <StoryTableBlockEditor block={nested} ops={tableOps(sectionId, nested.id)} />
          ) : (
            <div className="rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-4 text-sm text-neutral-400">Table</div>
          )
        ) : nested.type === "splitContent" ? (
          <StorySplitContentEditorLayout
            block={nested}
            textEditor={
              <div className="max-w-full">
                <StoryCanvasVerseResizableEditor
                  editorKey={`${sectionId}-${columnsBlock.id}-${nested.text.id}`}
                  rich={nested.text}
                  onJson={(json) => updateRichBlock(sectionId, nested.text.id, json)}
                  isLg={isLg}
                  surface="card"
                  syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, nested.text.id)}
                  onResizeWidth={(pct) =>
                    patchRichBlockRowLayout(sectionId, nested.text.id, {
                      widthMode: pct >= 100 ? "full" : "custom",
                      widthValue: pct >= 100 ? undefined : pct,
                      widthUnit: "%",
                      displayMode: "block",
                      float: undefined,
                    })
                  }
                />
              </div>
            }
            supportingAside={
              <div className="space-y-2">
                {nested.supporting.blocks.length === 0 ? (
                  <p className="text-center text-xs text-base-content/45">Empty supporting area.</p>
                ) : (
                  nested.supporting.blocks.map((sb) => (
                    <StorySplitSupportBlockSectionChrome
                      key={sb.id}
                      sectionId={sectionId}
                      splitBlockId={nested.id}
                      sb={sb}
                      supportPlacementVariant="column"
                      allowNestedColumns={allowNestedColumns}
                      isLg={isLg}
                      isSm={isSm}
                      chromeDepth={depth + 1}
                      columnsNestedDepth={depth + 1}
                      storySelection={storySelection}
                      insertColumnNested={insertColumnNested}
                      removeBlock={removeBlock}
                      setSelectedBlockId={setSelectedBlockId}
                      setInspectorTab={setInspectorTab}
                      setInspectorOpen={setInspectorOpen}
                      setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                      updateRichBlock={updateRichBlock}
                      patchRichBlockRowLayout={patchRichBlockRowLayout}
                      openBlockPlacement={openBlockPlacement}
                      moveBlock={moveBlock}
                      appendIntoContainer={appendIntoContainer}
                      appendSplitSupportingPreset={appendSplitSupportingPreset}
                      tableOps={tableOps}
                      renderNestedContainer={(cn) => renderContainerInColumn(cn)}
                    />
                  ))
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full gap-2 border-base-content/15 font-medium text-xs",
                    )}
                  >
                    Add to supporting area
                    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 min-w-[11rem] overflow-y-auto">
                    {STORY_SPLIT_SUPPORT_ADD_PRESET_IDS.map((id) => (
                      <DropdownMenuItem key={id} className="text-xs font-medium" onClick={() => appendSplitSupportingPreset(sectionId, nested.id, id)}>
                        {storyAddPresetLabel(id)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        ) : nested.type === "container" ? (
          renderContainerInColumn(nested)
        ) : null}
      </StoryEditorBlockFrame>
    );
  }

  return (
    <div className="grid min-w-0 pt-0.5" style={gridStyle}>
      {([0, 1] as const).map((colIdx) => {
        const slot = columnsBlock.columns[colIdx];
        const columnActive =
          storySelection?.mode === "column" &&
          storySelection.columnsBlock.id === columnsBlock.id &&
          storySelection.columnIndex === colIdx;
        return (
          <div
            key={slot.id}
            className={cn(
              "flex min-w-0 flex-col overflow-visible rounded-xl border bg-neutral-50/70 transition-[border-color,box-shadow]",
              cellMinH,
              cellPad,
              columnActive ? cellActiveBorder : cellBorder,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-visible" style={storyColumnStackStyle(slot)}>
              {slot.blocks.length === 0 ? (
                <>
                  <StoryColumnInsertAffordance
                    mobile={!isLg}
                    allowNestedColumns={allowNestedColumns}
                    onInsert={(presetId) => insertColumnNested(sectionId, columnsBlock.id, colIdx, 0, presetId)}
                  />
                  <p className="mt-2 px-1 text-center text-xs leading-relaxed text-neutral-500">
                    Or use a block’s floating toolbar to add above or below once this column has content.
                  </p>
                </>
              ) : (
                <>
                  {groupColumnNestedBlocksForLayout(slot.blocks).map((grp) => (
                    <Fragment key={grp.kind === "single" ? grp.block.id : `${grp.float.id}-${grp.text.id}`}>
                      {grp.kind === "float-wrap" ? (
                        <div className="flow-root min-w-0">
                          <StoryBlockRowDesignWrap block={grp.float as StoryBlock} floated>
                            {renderColumnNestedChrome(grp.float)}
                          </StoryBlockRowDesignWrap>
                          <StoryBlockRowDesignWrap block={grp.text as StoryBlock} floated={false} wrapperClassName="min-w-0">
                            {renderColumnNestedChrome(grp.text)}
                          </StoryBlockRowDesignWrap>
                        </div>
                      ) : (
                        <StoryBlockRowDesignWrap block={grp.block as StoryBlock} floated={false}>
                          {renderColumnNestedChrome(grp.block)}
                        </StoryBlockRowDesignWrap>
                      )}
                    </Fragment>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type StoryEditorSectionBlockCardProps = {
  sectionId: string;
  block: StoryBlock;
  patchMediaBlock?: (sectionId: string, blockId: string, patch: Partial<StoryMediaBlock>) => void;
  patchSplitContentBlock?: (sectionId: string, blockId: string, patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => void;
  tableOps?: (sectionId: string, blockId: string) => TableBlockOps;
} & Pick<
  StoryNestedColumnsGridProps,
  | "storySelection"
  | "isLg"
  | "isSm"
  | "insertColumnNested"
  | "removeBlock"
  | "setSelectedBlockId"
  | "setInspectorTab"
  | "setInspectorOpen"
  | "setBlockSettingsSheetOpen"
  | "updateRichBlock"
  | "patchRichBlockRowLayout"
  | "openBlockPlacement"
  | "moveBlock"
  | "appendIntoContainer"
  | "appendSplitSupportingPreset"
>;

function StoryEditorSectionBlockCard({
  sectionId,
  block,
  patchMediaBlock,
  patchSplitContentBlock,
  tableOps,
  storySelection,
  isLg,
  isSm,
  insertColumnNested,
  removeBlock,
  setSelectedBlockId,
  setInspectorTab,
  setInspectorOpen,
  setBlockSettingsSheetOpen,
  updateRichBlock,
  patchRichBlockRowLayout,
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
  appendSplitSupportingPreset,
}: StoryEditorSectionBlockCardProps) {
  const selected = isStoryChromeBlockSelected(storySelection, block.id);
  const header = storyBlockDisplayLabel(block);
  const placementVariant: StoryBlockPlacementVariant = block.type === "container" ? "container" : "section";
  const allowNested = true;

  const onSelect = () => {
    setSelectedBlockId(block.id);
    setInspectorTab("block");
  };

  const openInspector = () => {
    setSelectedBlockId(block.id);
    setInspectorTab("block");
    if (isLg) {
      setInspectorOpen(true);
    } else {
      setBlockSettingsSheetOpen(true);
    }
  };

  return (
    <StoryEditorBlockFrame
      block={block}
      frameLabel={header}
      selected={selected}
      isLg={isLg}
      visualQuietContainer={block.type === "container"}
      onSelect={onSelect}
      onAddAbove={() =>
        openBlockPlacement({
          flow: "add",
          targetBlockId: block.id,
          variant: placementVariant,
          allowNestedColumns: allowNested,
          initialAddPosition: "above",
        })
      }
      onAddBelow={() =>
        openBlockPlacement({
          flow: "add",
          targetBlockId: block.id,
          variant: placementVariant,
          allowNestedColumns: allowNested,
          initialAddPosition: "below",
        })
      }
      onAddInsideContainer={
        block.type === "container"
          ? () =>
              openBlockPlacement({
                flow: "add",
                targetBlockId: block.children?.[0]?.id ?? block.id,
                variant: "container",
                allowNestedColumns: allowNested,
              })
          : undefined
      }
      onDuplicate={() =>
        openBlockPlacement({
          flow: "duplicate",
          targetBlockId: block.id,
          variant: placementVariant,
          allowNestedColumns: allowNested,
        })
      }
      onDelete={() => removeBlock(sectionId, block.id)}
      onOpenInspector={openInspector}
      onMove={(dir) => moveBlock(sectionId, block.id, dir)}
      contentClassName={cn(block.type === "richText" && "pb-4 pt-5")}
    >
      {block.type === "richText" ? (
        <StoryCanvasVerseResizableEditor
          editorKey={`${sectionId}-${block.id}`}
          rich={block}
          onJson={(json) => updateRichBlock(sectionId, block.id, json)}
          isLg={isLg}
          syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, block.id)}
          onResizeWidth={(pct) =>
            patchRichBlockRowLayout(sectionId, block.id, {
              widthMode: pct >= 100 ? "full" : "custom",
              widthValue: pct >= 100 ? undefined : pct,
              widthUnit: "%",
              displayMode: "block",
              float: undefined,
            })
          }
        />
      ) : block.type === "columns" ? (
        <StoryNestedColumnsGrid
          sectionId={sectionId}
          columnsBlock={block}
          depth={1}
          isSm={isSm}
          isLg={isLg}
          storySelection={storySelection}
          insertColumnNested={insertColumnNested}
          removeBlock={removeBlock}
          setSelectedBlockId={setSelectedBlockId}
          setInspectorTab={setInspectorTab}
          setInspectorOpen={setInspectorOpen}
          setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
          updateRichBlock={updateRichBlock}
          patchRichBlockRowLayout={patchRichBlockRowLayout}
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
          appendSplitSupportingPreset={appendSplitSupportingPreset}
          tableOps={tableOps}
        />
      ) : block.type === "divider" ? (
        <StoryDividerEditorChrome block={block} />
      ) : block.type === "table" ? (
        tableOps ? (
          <StoryTableBlockEditor block={block} ops={tableOps(sectionId, block.id)} />
        ) : (
          <div className="rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-4 text-sm text-neutral-400">Table</div>
        )
      ) : block.type === "splitContent" ? (
        <StorySplitContentEditorLayout
          block={block}
          onResizeSupportingWidth={patchSplitContentBlock ? (pct) => patchSplitContentBlock(sectionId, block.id, { supportingWidthPct: pct }) : undefined}
          textEditor={
            <div className="pb-4 pt-5">
              <StoryCanvasVerseResizableEditor
                editorKey={`${sectionId}-${block.text.id}`}
                rich={block.text}
                onJson={(json) => updateRichBlock(sectionId, block.text.id, json)}
                isLg={isLg}
                syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, block.text.id)}
                onResizeWidth={(pct) =>
                  patchRichBlockRowLayout(sectionId, block.text.id, {
                    widthMode: pct >= 100 ? "full" : "custom",
                    widthValue: pct >= 100 ? undefined : pct,
                    widthUnit: "%",
                    displayMode: "block",
                    float: undefined,
                  })
                }
              />
            </div>
          }
          supportingAside={
            <div className="space-y-2">
              {block.supporting.blocks.length === 0 ? (
                <p className="text-center text-xs text-base-content/45">Nothing in the supporting area yet.</p>
              ) : (
                block.supporting.blocks.map((sb) => (
                  <StorySplitSupportBlockSectionChrome
                    key={sb.id}
                    sectionId={sectionId}
                    splitBlockId={block.id}
                    sb={sb}
                    supportPlacementVariant="section"
                    allowNestedColumns={allowNested}
                    isLg={isLg}
                    isSm={isSm}
                    chromeDepth={2}
                    columnsNestedDepth={1}
                    storySelection={storySelection}
                    insertColumnNested={insertColumnNested}
                    removeBlock={removeBlock}
                    setSelectedBlockId={setSelectedBlockId}
                    setInspectorTab={setInspectorTab}
                    setInspectorOpen={setInspectorOpen}
                    setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                    updateRichBlock={updateRichBlock}
                    patchRichBlockRowLayout={patchRichBlockRowLayout}
                    openBlockPlacement={openBlockPlacement}
                    moveBlock={moveBlock}
                    appendIntoContainer={appendIntoContainer}
                    appendSplitSupportingPreset={appendSplitSupportingPreset}
                    tableOps={tableOps}
                    renderNestedContainer={(nest) => (
                      <StorySectionContainerInner
                        nest={nest}
                        sectionId={sectionId}
                        isLg={isLg}
                        isSm={isSm}
                        storySelection={storySelection}
                        updateRichBlock={updateRichBlock}
                        patchRichBlockRowLayout={patchRichBlockRowLayout}
                        insertColumnNested={insertColumnNested}
                        removeBlock={removeBlock}
                        setSelectedBlockId={setSelectedBlockId}
                        setInspectorTab={setInspectorTab}
                        setInspectorOpen={setInspectorOpen}
                        setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                        openBlockPlacement={openBlockPlacement}
                        moveBlock={moveBlock}
                        appendIntoContainer={appendIntoContainer}
                        appendSplitSupportingPreset={appendSplitSupportingPreset}
                        patchSplitContentBlock={patchSplitContentBlock}
                        tableOps={tableOps}
                        chromeDepth={2}
                      />
                    )}
                  />
                ))
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full gap-2 border-base-content/15 font-medium",
                  )}
                >
                  Add to supporting area
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 min-w-[12rem] overflow-y-auto">
                  {STORY_SPLIT_SUPPORT_ADD_PRESET_IDS.map((id) => (
                    <DropdownMenuItem key={id} className="font-medium" onClick={() => appendSplitSupportingPreset(sectionId, block.id, id)}>
                      {storyAddPresetLabel(id)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      ) : block.type === "media" ? (
        <MediaEmbedCanvasCard
          block={block}
          onConfigure={() => {
            setSelectedBlockId(block.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
          onResizeWidth={
            patchMediaBlock
              ? (pct) =>
                  patchMediaBlock(
                    sectionId,
                    block.id,
                    mergeMediaEmbedRowLayoutPatch(block as StoryMediaBlock, {
                      widthMode: pct >= 100 ? "full" : "custom",
                      widthValue: pct >= 100 ? undefined : pct,
                      widthUnit: "%",
                    }),
                  )
              : undefined
          }
          onResizeHeight={
            patchMediaBlock
              ? (px) => patchMediaBlock(sectionId, block.id, { heightPx: px })
              : undefined
          }
        />
      ) : block.type === "embed" ? (
        <EmbedCanvasCard
          block={block}
          onConfigure={() => {
            setSelectedBlockId(block.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
        />
      ) : block.type === "container" ? (
        <StorySectionContainerInner
          nest={block}
          sectionId={sectionId}
          isLg={isLg}
          isSm={isSm}
          storySelection={storySelection}
          updateRichBlock={updateRichBlock}
                        patchRichBlockRowLayout={patchRichBlockRowLayout}
          insertColumnNested={insertColumnNested}
          removeBlock={removeBlock}
          setSelectedBlockId={setSelectedBlockId}
          setInspectorTab={setInspectorTab}
          setInspectorOpen={setInspectorOpen}
          setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
          appendSplitSupportingPreset={appendSplitSupportingPreset}
          patchSplitContentBlock={patchSplitContentBlock}
          tableOps={tableOps}
        />
      ) : null}
    </StoryEditorBlockFrame>
  );
}

type StorySaveStatus = "idle" | "saving" | "error";

/** Green leaf + “StoryCreator” — matches fullscreen writing bar branding. */
function StoryCreatorBrandMark() {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 sm:h-9">
      <Leaf className="size-5 shrink-0 text-success sm:size-[1.15rem]" strokeWidth={2} aria-hidden />
      <span className="font-heading text-sm font-semibold tracking-tight text-base-content sm:text-base">StoryCreator</span>
    </div>
  );
}

export function StoryCreatorClient({ storyId }: { storyId: string }) {
  const router = useRouter();
  const doc = useStoryEditorStore((s) => s.document);
  const mode = useStoryEditorStore((s) => s.mode);
  const activeSectionId = useStoryEditorStore((s) => s.selectedSectionId);
  const selectedBlockId = useStoryEditorStore((s) => s.selectedBlockId);
  const inspectorTab = useStoryEditorStore((s) => s.inspectorTab);
  const isLeftPanelOpen = useStoryEditorStore((s) => s.leftPanelOpen);
  const inspectorOpen = useStoryEditorStore((s) => s.rightPanelOpen);
  const storyEditorDirty = useStoryEditorStore((s) => s.dirty);
  const initializeDocument = useStoryEditorStore((s) => s.initializeDocument);
  const setSelectedBlockId = useStoryEditorStore((s) => s.selectBlock);
  const setActiveSectionId = useStoryEditorStore((s) => s.selectSection);
  const setInspectorTab = useStoryEditorStore((s) => s.setInspectorTab);
  const setPanelOpen = useStoryEditorStore((s) => s.setPanelOpen);
  const setMode = useStoryEditorStore((s) => s.setMode);
  const markSaved = useStoryEditorStore((s) => s.markSaved);
  const updateDocumentRecipe = useStoryEditorStore((s) => s.updateDocumentRecipe);
  const [mobileShellTab, setMobileShellTab] = useState<StoryMobileShellTab>("add-block");
  const [addBlockSheetOpen, setAddBlockSheetOpen] = useState(false);
  const [blockSettingsSheetOpen, setBlockSettingsSheetOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [leftPanelWidthPx, setLeftPanelWidthPx] = useState(STORY_LEFT_PANEL_DEFAULT);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [rightPanelWidthPx, setRightPanelWidthPx] = useState(STORY_RIGHT_PANEL_DEFAULT);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [outlineRename, setOutlineRename] = useState<OutlineRenameTarget | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const docRef = useRef<StoryDocument | null>(null);
  const storyTitleInputRef = useRef<HTMLInputElement>(null);
  const isLg = useMediaQueryMinLg();
  const isSm = useMediaQuery("(min-width: 640px)");
  const setLeftPanelOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(isLeftPanelOpen) : next;
      setPanelOpen("left", resolved);
    },
    [isLeftPanelOpen, setPanelOpen],
  );
  const setInspectorOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(inspectorOpen) : next;
      setPanelOpen("right", resolved);
    },
    [inspectorOpen, setPanelOpen],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setSaveStatus("idle");
    (async () => {
      try {
        const existing = await loadStoryDocument(storyId);
        if (cancelled) return;
        if (!existing) {
          useStoryEditorStore.setState({ document: null, selectedSectionId: null, selectedBlockId: null, dirty: false });
          setLoadError("Story not found.");
          return;
        }
        if (existing.id !== storyId) {
          router.replace(`/admin/stories/${existing.id}`);
          return;
        }
        const migrated = migrateStoryDocument(existing);
        let loadedDoc = migrated;
        if (JSON.stringify(existing) !== JSON.stringify(migrated)) {
          loadedDoc = await saveStoryDocument(migrated);
          if (cancelled) return;
          toast.message("Story format updated", {
            description:
              "Chapters use a flexible section tree; columns, media/embed, and legacy tables were upgraded to native table blocks where applicable.",
          });
        }
        initializeDocument(loadedDoc);
        const roots = Array.isArray(loadedDoc.sections) ? loadedDoc.sections : [];
        const firstSec = firstSectionInOrder(roots);
        setActiveSectionId(firstSec?.id ?? null);
        setSelectedBlockId(firstSec?.blocks?.[0]?.id ?? null);
      } catch (err) {
        console.error("Story load / migration failed", err);
        if (cancelled) return;
        useStoryEditorStore.setState({ document: null, selectedSectionId: null, selectedBlockId: null, dirty: false });
        const msg =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not load story.";
        setLoadError(msg);
        toast.error("Story could not be loaded", { description: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, router, initializeDocument, setActiveSectionId, setSelectedBlockId]);

  useEffect(() => {
    if (isLg) {
      setBlockSettingsSheetOpen(false);
      setAddBlockSheetOpen(false);
      setMobileShellTab("add-block");
    }
  }, [isLg]);

  useEffect(() => {
    if (!isLg && mobileShellTab !== "add-block") {
      setBlockSettingsSheetOpen(false);
    }
  }, [isLg, mobileShellTab]);

  useEffect(() => {
    if (!isLg && isFullscreen) setIsFullscreen(false);
  }, [isLg, isFullscreen]);

  useLayoutEffect(() => {
    try {
      const rawL = sessionStorage.getItem(STORY_LEFT_PANEL_WIDTH_KEY);
      if (rawL) {
        const n = Number.parseInt(rawL, 10);
        if (Number.isFinite(n)) setLeftPanelWidthPx(clampStoryLeftPanelWidth(n));
      }
      const rawR = sessionStorage.getItem(STORY_RIGHT_PANEL_WIDTH_KEY);
      if (rawR) {
        const n = Number.parseInt(rawR, 10);
        if (Number.isFinite(n)) setRightPanelWidthPx(clampStoryRightPanelWidth(n));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORY_LEFT_PANEL_WIDTH_KEY, String(leftPanelWidthPx));
    } catch {
      /* ignore */
    }
  }, [leftPanelWidthPx]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORY_RIGHT_PANEL_WIDTH_KEY, String(rightPanelWidthPx));
    } catch {
      /* ignore */
    }
  }, [rightPanelWidthPx]);

  const onLeftPanelResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      const startX = e.clientX;
      const startW = leftPanelWidthPx;
      setIsResizingLeftPanel(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const onMove = (ev: PointerEvent) => {
        const d = ev.clientX - startX;
        setLeftPanelWidthPx(clampStoryLeftPanelWidth(startW + d));
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsResizingLeftPanel(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [leftPanelWidthPx],
  );

  const onRightPanelResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      const startX = e.clientX;
      const startW = rightPanelWidthPx;
      setIsResizingRightPanel(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const onMove = (ev: PointerEvent) => {
        const d = ev.clientX - startX;
        setRightPanelWidthPx(clampStoryRightPanelWidth(startW + d));
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setIsResizingRightPanel(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [rightPanelWidthPx],
  );

  useEffect(() => {
    setIsFullscreen(false);
  }, [storyId]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const activePair = useMemo(() => {
    if (!doc || !activeSectionId) return null;
    return findSectionPath(doc.sections ?? [], activeSectionId);
  }, [doc, activeSectionId]);

  const storySelection = useMemo(() => {
    if (!activePair || !selectedBlockId) return null;
    return resolveStorySelection(activePair.section, selectedBlockId);
  }, [activePair, selectedBlockId]);

  const selectedBlock = storySelection?.block ?? null;
  const selectedBlockInSplitPanel =
    activePair != null && selectedBlockId != null
      ? isBlockInSplitSupportingSlot(activePair.section, selectedBlockId)
      : false;

  /** After doc edits, migrations, or deletes, keep outline + canvas pointing at a real section and block. */
  useEffect(() => {
    if (!doc) return;
    const roots = doc.sections ?? [];
    const path = activeSectionId ? findSectionPath(roots, activeSectionId) : null;
    if (!path) {
      const first = firstSectionInOrder(roots);
      if (first) {
        setActiveSectionId(first.id);
        setSelectedBlockId(first.blocks[0]?.id ?? null);
      }
      return;
    }
    if (!selectedBlockId || !resolveStorySelection(path.section, selectedBlockId)) {
      const fb = path.section.blocks[0]?.id ?? null;
      if (fb !== selectedBlockId) setSelectedBlockId(fb);
    }
  }, [doc, activeSectionId, selectedBlockId]);

  const columnsLayoutBlock = useMemo((): StoryColumnsBlock | null => {
    if (!storySelection) return null;
    if (storySelection.mode === "column") return storySelection.columnsBlock;
    if (storySelection.mode === "section" && storySelection.block.type === "columns") return storySelection.block;
    return null;
  }, [storySelection]);

  const columnsNestingDepth = useMemo(() => {
    if (!activePair?.section || !columnsLayoutBlock) return 1;
    return columnsBlockDepthInSection(activePair.section, columnsLayoutBlock.id) ?? 1;
  }, [activePair?.section, columnsLayoutBlock]);

  const fullscreenStoryStats = useMemo(() => {
    if (!doc) return { wordCount: 0, sectionCount: 0 };
    const flatSections = flattenSectionsDepthFirst(doc.sections ?? []);
    let wordCount = 0;
    for (const sec of flatSections) {
      wordCount += wordsInStoryBlocks(sec.blocks ?? []);
    }
    return { wordCount, sectionCount: flatSections.length };
  }, [doc]);

  const flushSave = useCallback(async (next: StoryDocument) => {
    setSaveStatus("saving");
    try {
      const saved = await saveStoryDocument(next);
      markSaved(saved);
      setSaveStatus("idle");
      return saved;
    } catch (e) {
      console.error("Story save failed", e);
      setSaveStatus("error");
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      toast.error("Save failed", { description: msg });
      throw e;
    }
  }, [markSaved]);

  docRef.current = doc;

  const storySelectionRepairRef = useRef<{ doc: StoryDocument | null; activeSectionId: string | null }>({
    doc: null,
    activeSectionId: null,
  });
  storySelectionRepairRef.current = { doc, activeSectionId };

  const updateDoc = useCallback((fn: (d: StoryDocument) => StoryDocument, snapshotReason?: string) => {
    updateDocumentRecipe((cur: StoryDocument) => fn(cloneDoc(cur)), snapshotReason);
  }, [updateDocumentRecipe]);

  const handleSaveDraft = useCallback(() => {
    if (!doc) return;
    void (async () => {
      try {
        await flushSave({ ...doc, status: "draft" });
        toast.success("Draft saved.");
      } catch {
        /* toast in flushSave */
      }
    })();
  }, [doc, flushSave]);

  const handlePublish = useCallback(() => {
    if (!doc) return;
    void (async () => {
      try {
        await flushSave({ ...doc, status: "published" });
        toast.success("Published.");
      } catch {
        /* toast in flushSave */
      }
    })();
  }, [doc, flushSave]);

  const handleRetrySave = useCallback(() => {
    const cur = docRef.current;
    if (!cur) return;
    void (async () => {
      try {
        await flushSave(cur);
      } catch {
        /* toast in flushSave */
      }
    })();
  }, [flushSave]);

  const setTitle = useCallback(
    (title: string) => {
      updateDoc((d) => {
        const next = { ...d, title };
        if (!d.slugManuallyEdited) {
          if (!title.trim()) {
            next.slug = undefined;
          } else {
            const auto = normalizeStorySlugInput(slugifyStoryTitle(title));
            next.slug = auto.length > 0 ? auto : undefined;
          }
        }
        return next;
      });
    },
    [updateDoc],
  );

  const setExcerpt = useCallback(
    (excerpt: string) => {
      updateDoc((d) => ({ ...d, excerpt }));
    },
    [updateDoc],
  );

  const patchStoryMeta = useCallback(
    (patch: StoryDocumentMetaPatch) => {
      updateDoc((d) => ({ ...d, ...patch }));
    },
    [updateDoc],
  );

  const patchEmbed = useCallback(
    (patch: Partial<StoryEmbedBlock>) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchEmbedInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchMedia = useCallback(
    (patch: Partial<StoryMediaBlock>) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchMediaInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchMediaBlock = useCallback(
    (sectionId: string, blockId: string, patch: Partial<StoryMediaBlock>) => {
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => patchMediaInSection(sec, blockId, patch)));
    },
    [updateDoc],
  );

  const patchSplitContentBlock = useCallback(
    (sectionId: string, blockId: string, patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => {
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => patchSplitContentLayoutInSection(sec, blockId, patch)));
    },
    [updateDoc],
  );

  const patchTable = useCallback(
    (patch: Parameters<typeof patchTableInSection>[2]) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchTableInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const tableOps = useCallback(
    (sectionId: string, blockId: string): TableBlockOps => ({
      onPatchLayout: (patch) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => patchTableInSection(sec, blockId, patch))),
      onSetCell: (row, col, content) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => setTableCellInSection(sec, blockId, row, col, content))),
      onAddRow: (afterIndex) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => addTableRowInSection(sec, blockId, afterIndex))),
      onRemoveRow: (rowIndex) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => removeTableRowInSection(sec, blockId, rowIndex))),
      onAddColumn: (afterIndex) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => addTableColumnInSection(sec, blockId, afterIndex))),
      onRemoveColumn: (colIndex) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => removeTableColumnInSection(sec, blockId, colIndex))),
      onSetColumnWidths: (widths) =>
        updateDoc((d) => mapDocSection(d, sectionId, (sec) => setTableColumnWidthsInSection(sec, blockId, widths))),
    }),
    [updateDoc],
  );

  const patchContainer = useCallback(
    (patch: Partial<StoryContainerBlockProps>) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchContainerInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchBlockRowLayout = useCallback(
    (patch: Partial<StoryBlockRowLayout>) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchBlockRowLayoutInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchRichBlockRowLayout = useCallback(
    (sectionId: string, blockId: string, patch: Partial<StoryBlockRowLayout>) => {
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => patchBlockRowLayoutInSection(sec, blockId, patch)));
    },
    [updateDoc],
  );

  const patchBlockDesign = useCallback(
    (patch: Partial<StoryBlockDesign> | null) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchBlockDesignInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchBlockDateAnnotation = useCallback(
    (patch: { dateAnnotations?: StoryBlockDateAnnotation[]; placeAnnotations?: StoryBlockPlaceAnnotation[] }) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchBlockAnnotationsInSection(sec, bid, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchRichTextMeta = useCallback(
    (patch: StoryRichTextMetaPatch) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchRichTextMetaInSection(sec, selectedBlockId, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const patchDividerMeta = useCallback(
    (patch: StoryDividerMetaPatch) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchDividerBlockInSection(sec, selectedBlockId, patch)));
    },
    [activePair, selectedBlockId, updateDoc],
  );

  const appendIntoContainer = useCallback(
    (sectionId: string, containerId: string, block: StoryBlock) => {
      updateDoc((d) =>
        mapDocSection(d, sectionId, (sec) => {
          const next = appendBlockIntoContainer(sec, containerId, block);
          return next ?? sec;
        }),
      );
      setActiveSectionId(sectionId);
      setSelectedBlockId(block.id);
      setInspectorTab("block");
    },
    [updateDoc],
  );

  const patchColumns = useCallback(
    (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>) => {
      if (!activePair || !columnsLayoutBlock) return;
      const sid = activePair.section.id;
      const id = columnsLayoutBlock.id;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchColumnsInSection(sec, id, patch)));
    },
    [activePair, columnsLayoutBlock, updateDoc],
  );

  const patchColumnSlot = useCallback(
    (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => {
      if (!activePair || !columnsLayoutBlock) return;
      const sid = activePair.section.id;
      const id = columnsLayoutBlock.id;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchColumnSlotLayout(sec, id, columnIndex, patch)));
    },
    [activePair, columnsLayoutBlock, updateDoc],
  );

  const toggleSectionCollapsed = useCallback(
    (sectionId: string) => {
      updateDoc((d) =>
        mapDocSection(d, sectionId, (s) => ({
          ...s,
          collapsed: !(s.collapsed ?? false),
        })),
      );
    },
    [updateDoc],
  );

  const renameSectionTitle = useCallback(
    (sectionId: string, title: string) => {
      const t = title.trim() || "Untitled section";
      updateDoc((d) => mapDocSection(d, sectionId, (s) => ({ ...s, title: t })));
    },
    [updateDoc],
  );

  const toggleSectionChapter = useCallback(
    (sectionId: string, isChapter: boolean) => {
      updateDoc((d) => mapDocSection(d, sectionId, (s) => ({ ...s, isChapter })));
    },
    [updateDoc],
  );

  const toggleSectionPage = useCallback(
    (sectionId: string, isPage: boolean) => {
      updateDoc((d) => mapDocSection(d, sectionId, (s) => ({ ...s, isPage })));
    },
    [updateDoc],
  );

  const addSectionAfter = useCallback(
    (afterSectionId: string | null) => {
      const secId = newStoryId();
      const initialBlocks = createDefaultSectionBlocks();
      const containerId = initialBlocks[0]!.id;
      const node = normalizeStorySection({
        id: secId,
        title: "New section",
        collapsed: false,
        blocks: initialBlocks,
      });
      updateDoc((d) => insertSectionAfterSibling(d, afterSectionId, node));
      setActiveSectionId(secId);
      setSelectedBlockId(containerId);
      setOutlineRename({ kind: "section", id: secId });
      setInspectorTab("block");
    },
    [updateDoc],
  );

  const addChildSection = useCallback(
    (parentSectionId: string) => {
      const secId = newStoryId();
      const initialBlocks = createDefaultSectionBlocks();
      const containerId = initialBlocks[0]!.id;
      const node = normalizeStorySection({
        id: secId,
        title: "New section",
        collapsed: false,
        blocks: initialBlocks,
      });
      updateDoc((d) => appendChildSection(d, parentSectionId, node));
      setActiveSectionId(secId);
      setSelectedBlockId(containerId);
      setOutlineRename({ kind: "section", id: secId });
      setInspectorTab("block");
    },
    [updateDoc],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!doc) return;
      const flat = flattenSectionsDepthFirst(doc.sections ?? []);
      if (flat.length <= 1) {
        toast.error("A story needs at least one section.");
        return;
      }
      const path = findSectionPath(doc.sections ?? [], sectionId);
      if (!path) return;
      if (!window.confirm(`Delete “${path.section.title}” and any nested subsections? Blocks in this section will be removed.`)) {
        return;
      }
      const removedIdx = flat.findIndex((s) => s.id === sectionId);
      const neighbor = flat[removedIdx + 1] ?? flat[removedIdx - 1];
      const { next, removed } = removeSectionFromTree(doc.sections ?? [], sectionId);
      if (!removed) return;
      const activeWas = activeSectionId === sectionId;
      updateDoc((d) => ({ ...d, sections: next }));
      if (activeWas) {
        setActiveSectionId(neighbor?.id ?? null);
        setSelectedBlockId(neighbor?.blocks?.[0]?.id ?? null);
      }
    },
    [doc, activeSectionId, updateDoc],
  );

  const moveSection = useCallback(
    (draggedId: string, newParentId: string | null, insertBeforeId: string | null) => {
      updateDoc((d) => {
        const next = moveSectionInDocument(d, draggedId, newParentId, insertBeforeId);
        return next ?? d;
      });
    },
    [updateDoc],
  );

  const selectSectionFromOutline = useCallback(
    (sectionId: string, firstBlockId: string | null) => {
      const path = doc ? findSectionPath(doc.sections ?? [], sectionId) : null;
      const fallback = path?.section.blocks[0]?.id ?? null;
      setActiveSectionId(sectionId);
      setSelectedBlockId(firstBlockId ?? fallback);
      setInspectorTab("block");
      if (!isLg) {
        setMobileShellTab("add-block");
        setBlockSettingsSheetOpen(false);
        setAddBlockSheetOpen(false);
      }
    },
    [doc, isLg],
  );

  const insertBlockWithPreset = useCallback(
    (
      sectionId: string,
      index: number,
      presetId: StoryAddBlockPresetId,
      opts?: { headingPresetLocked?: boolean },
    ) => {
      let block = createStoryBlockFromPreset(presetId);
      if (opts?.headingPresetLocked && presetId === "text_heading" && block.type === "richText") {
        block = { ...block, headingPresetLocked: true };
      }
      if (presetId === "text_list" && block.type === "richText") {
        block = { ...block, listPresetLocked: true };
      }
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => insertBlockAtIndex(sec, index, block)));
      setActiveSectionId(sectionId);
      setSelectedBlockId(block.id);
      setInspectorTab("block");
    },
    [updateDoc],
  );

  const appendSplitSupportingPreset = useCallback(
    (sectionId: string, splitBlockId: string, presetId: StoryAddBlockPresetId) => {
      const add = createSplitSupportBlockFromPreset(presetId);
      if (!add) {
        toast.error("That choice cannot be placed in the split supporting area.");
        return;
      }
      updateDoc((d) =>
        mapDocSection(d, sectionId, (sec) => appendSupportingBlockToSplit(sec, splitBlockId, add) ?? sec),
      );
      setActiveSectionId(sectionId);
      setSelectedBlockId(add.id);
      setInspectorTab("block");
    },
    [updateDoc],
  );

  const removeBlock = useCallback(
    (sectionId: string, blockId: string) => {
      if (!doc) return;
      const pair = findSectionPath(doc.sections ?? [], sectionId);
      if (!pair) return;
      const nested = resolveStorySelection(pair.section, blockId);
      const msg =
        nested?.mode === "column"
          ? "Remove this content from the column?"
          : "Remove this block from the section?";
      if (!window.confirm(msg)) return;
      const next = removeBlockById(pair.section, blockId);
      if (!next) return;
      updateDoc((d) => mapDocSection(d, sectionId, () => next.section));
      setSelectedBlockId(next.nextSelectedId);
    },
    [doc, updateDoc],
  );

  const moveBlock = useCallback(
    (sectionId: string, blockId: string, direction: -1 | 1) => {
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => moveStoryBlockRelative(sec, blockId, direction)));
    },
    [updateDoc],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest(".ProseMirror") || t?.closest('[contenteditable="true"]')) return;
      const { doc: d, activeSectionId: sid } = storySelectionRepairRef.current;
      if (!d || !sid) return;
      const path = findSectionPath(d.sections ?? [], sid);
      if (!path) return;
      const fb = path.section.blocks[0]?.id ?? null;
      setSelectedBlockId(fb);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deleteSelectedBlock = useCallback(() => {
    if (!activePair || !selectedBlockId) return;
    removeBlock(activePair.section.id, selectedBlockId);
    setBlockSettingsSheetOpen(false);
  }, [activePair, selectedBlockId, removeBlock]);

  const handleDockNavigate = useCallback(
    (tab: StoryMobileShellTab) => {
      if (isLg) {
        if (tab === "structure") {
          setLeftPanelOpen(true);
        } else if (tab === "settings") {
          setInspectorOpen(true);
          setInspectorTab("story");
        } else {
          setAddBlockSheetOpen(true);
        }
      } else {
        setMobileShellTab(tab);
        if (tab === "add-block") {
          setBlockSettingsSheetOpen(false);
          setAddBlockSheetOpen(true);
        }
        if (tab === "structure" || tab === "settings") {
          setAddBlockSheetOpen(false);
        }
      }
    },
    [isLg],
  );

  const insertBlockFromDockPicker = useCallback(
    (presetId: StoryAddBlockPresetId, opts?: { fromFullscreenAddModal?: boolean }) => {
      if (!activePair) {
        toast.error("Pick a section in the outline first.");
        return;
      }
      const blocks = activePair.section.blocks;
      const idx = selectedBlockId ? blocks.findIndex((b) => b.id === selectedBlockId) : -1;
      const insertIndex = idx >= 0 ? idx + 1 : blocks.length;
      const headingLocked = Boolean(opts?.fromFullscreenAddModal && presetId === "text_heading");
      insertBlockWithPreset(activePair.section.id, insertIndex, presetId, { headingPresetLocked: headingLocked });
      setAddBlockSheetOpen(false);
      setFullscreenAddBlockOpen(false);
    },
    [activePair, selectedBlockId, insertBlockWithPreset],
  );

  const updateRichBlock = useCallback(
    (sectionId: string, blockId: string, json: JSONContent) => {
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => patchRichTextInSection(sec, blockId, json)));
    },
    [updateDoc],
  );

  const insertColumnNested = useCallback(
    (
      sectionId: string,
      columnsBlockId: string,
      columnIndex: 0 | 1,
      atIndex: number,
      presetId: StoryAddBlockPresetId,
    ) => {
      if (presetId === "layout_columns" && doc) {
        const pair = findSectionPath(doc.sections ?? [], sectionId);
        const depth = pair ? columnsBlockDepthInSection(pair.section, columnsBlockId) : null;
        if (depth != null && depth >= MAX_STORY_COLUMNS_NEST_DEPTH) {
          toast.error("Nested columns are limited to 2 levels.");
          return;
        }
      }
      const nested = createColumnNestedBlockFromPreset(presetId);
      updateDoc((d) =>
        mapDocSection(d, sectionId, (sec) => insertColumnNestedAt(sec, columnsBlockId, columnIndex, atIndex, nested)),
      );
      setActiveSectionId(sectionId);
      setSelectedBlockId(nested.id);
      setInspectorTab("block");
    },
    [doc, updateDoc],
  );

  const [blockPlacementModal, setBlockPlacementModal] = useState<StoryBlockPlacementModalArgs | null>(null);
  const blockPlacementModalRef = useRef<StoryBlockPlacementModalArgs | null>(null);
  blockPlacementModalRef.current = blockPlacementModal;

  const [fullscreenAddBlockOpen, setFullscreenAddBlockOpen] = useState(false);

  const fullscreenAddBlockPresetGroups = useMemo(
    () => STORY_ADD_BLOCK_PRESET_GROUPS.map((g) => ({ ...g, items: [...g.items] })).filter((g) => g.items.length > 0),
    [],
  );

  const openBlockPlacement = useCallback((args: StoryBlockPlacementModalArgs) => {
    setBlockPlacementModal(args);
  }, []);

  const handlePlacementModalOpenChange = useCallback((open: boolean) => {
    if (!open) setBlockPlacementModal(null);
  }, []);

  const applyPlacementAdd = useCallback(
    (position: "above" | "below", presetId: StoryAddBlockPresetId) => {
      const ctx = blockPlacementModalRef.current;
      if (!activePair || !ctx) return;
      const block =
        ctx.variant === "column" ? createColumnNestedBlockFromPreset(presetId) : createStoryBlockFromPreset(presetId);
      if (ctx.variant === "container") {
        const target = findStoryBlockAnywhere(activePair.section, ctx.targetBlockId);
        if (target?.type === "container" && target.children.length === 0 && target.id === ctx.targetBlockId) {
          const next = appendBlockIntoContainer(activePair.section, target.id, block);
          if (next) {
            updateDoc((d) => mapDocSection(d, activePair.section.id, () => next));
            setSelectedBlockId(block.id);
            setInspectorTab("block");
            setBlockPlacementModal(null);
            return;
          }
        }
      }
      const next = insertBlockRelativeToBlockId(activePair.section, ctx.targetBlockId, position, block);
      if (!next) {
        toast.error("Could not insert that block here (nested columns may be at the maximum depth).");
        return;
      }
      updateDoc((d) => mapDocSection(d, activePair.section.id, () => next));
      setSelectedBlockId(block.id);
      setInspectorTab("block");
      setBlockPlacementModal(null);
    },
    [activePair, updateDoc],
  );

  const applyPlacementDuplicate = useCallback(
    (position: "above" | "below") => {
      const ctx = blockPlacementModalRef.current;
      if (!activePair || !ctx) return;
      const result = duplicateBlockRelativeToBlockId(activePair.section, ctx.targetBlockId, position);
      if (!result) {
        toast.error("Could not duplicate this block (nested columns may be at the maximum depth).");
        return;
      }
      updateDoc((d) => mapDocSection(d, activePair.section.id, () => result.section));
      setSelectedBlockId(result.duplicateId);
      setInspectorTab("block");
      setBlockPlacementModal(null);
    },
    [activePair, updateDoc],
  );

  const renderStructureSidebar = (mobileOverlay: boolean) =>
    doc ? (
      <StoryStructureSidebar
        doc={doc}
        activeSectionId={activeSectionId}
        activeBlockId={selectedBlockId}
        onSelectSection={selectSectionFromOutline}
        outlineOpen
        onOutlineOpenChange={(open) => {
          if (mobileOverlay) return;
          if (!open) setLeftPanelOpen(false);
        }}
        renameTarget={outlineRename}
        onRenameTargetChange={setOutlineRename}
        onRenameSection={renameSectionTitle}
        onAddSectionAfter={addSectionAfter}
        onAddChildSection={addChildSection}
        onDeleteSection={deleteSection}
        onToggleCollapsed={toggleSectionCollapsed}
        onMoveSection={moveSection}
        onToggleSectionChapter={toggleSectionChapter}
        onToggleSectionPage={toggleSectionPage}
        isCompact={!isLg}
        mobileOverlay={mobileOverlay}
        onCloseMobileOverlay={mobileOverlay ? () => setMobileShellTab("add-block") : undefined}
        showCollapsedRail={Boolean(mobileOverlay)}
        outlineSectionNavDeferMs={mobileOverlay || !isFullscreen ? 300 : undefined}
      />
    ) : null;

  const structurePanel = renderStructureSidebar(false);

  const lastSavedLabel = doc ? formatLastSaved(doc.updatedAt) : "";

  const headerSaveLine =
    saveStatus === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-base-content/65">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    ) : saveStatus === "error" ? (
      <span className="flex flex-wrap items-center gap-2 text-xs text-destructive">
        Save failed
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs font-medium" onClick={handleRetrySave}>
          Retry
        </Button>
      </span>
    ) : !storyEditorDirty && lastSavedLabel ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="size-3.5 shrink-0 opacity-90" aria-hidden />
        Saved · {lastSavedLabel}
      </span>
    ) : storyEditorDirty ? (
      <span className="text-xs text-base-content/50">Unsaved changes</span>
    ) : null;

  const publishSplitControl = (opts?: { tall?: boolean }) => {
    const h = opts?.tall ? "h-11 min-h-[44px]" : "h-9";
    return (
      <div className={cn("flex items-stretch", opts?.tall && "shadow-sm")}>
        <Button
          type="button"
          size="sm"
          className={cn(h, "shrink-0 gap-1.5 rounded-l-lg rounded-r-none px-3.5 font-semibold sm:px-4")}
          onClick={handlePublish}
        >
          Publish
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              buttonVariants({ size: "sm" }),
              h,
              "inline-flex shrink-0 items-center justify-center rounded-l-none rounded-r-lg border-l border-black/10 px-2.5 font-semibold",
              opts?.tall && "min-w-[44px]",
            )}
            aria-label="More publish options"
          >
            <ChevronDown className="size-4 opacity-90" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5" onClick={handlePublish}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="size-3.5 opacity-80" aria-hidden />
                Publish now
              </span>
              <span className="pl-5 text-xs font-normal text-muted-foreground">Make this story live</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2.5" onClick={handleSaveDraft}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-3.5 opacity-80" aria-hidden />
                Save draft
              </span>
              <span className="pl-5 text-xs font-normal text-muted-foreground">Keep working without publishing</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="cursor-not-allowed flex-col items-start gap-0.5 py-2.5 opacity-60">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="size-3.5 opacity-80" aria-hidden />
                Schedule
              </span>
              <span className="pl-5 text-xs font-normal text-muted-foreground">Pick a future date (coming soon)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const headerPublishState =
    doc && activePair ? storyDocumentPublishStateText(doc.status, storyEditorDirty) : null;

  const editorPanel =
    doc && activePair ? (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          /* Outer shell; document “desk” surface is on the scroll region below. */
          isFullscreen ? "bg-base-300" : "bg-base-300/35",
        )}
      >
        {isFullscreen ? (
          <div className="sticky top-0 z-20 shrink-0 border-b border-base-content/10 bg-base-300/95 px-3 py-2.5 shadow-sm backdrop-blur-md lg:px-4">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 w-10 shrink-0 rounded-xl border-base-content/15 p-0 font-medium sm:h-9 sm:w-9 sm:rounded-lg"
                title="Exit fullscreen (Esc)"
                aria-label="Exit fullscreen writing mode"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="size-4 shrink-0 opacity-90" aria-hidden />
              </Button>
              <StoryCreatorBrandMark />
              {!isLg && isFullscreen ? (
                <StoryEditPreviewModeToggle mode={mode} onMode={setMode} layout="dense" />
              ) : null}
              {!isLg && mode === "edit" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10 shrink-0 gap-1.5 rounded-xl border-base-content/15 px-3 font-medium sm:h-9 sm:rounded-lg"
                    aria-label="Add block"
                    onClick={() => setAddBlockSheetOpen(true)}
                  >
                    <Plus className="size-4 shrink-0 opacity-90" aria-hidden />
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10 shrink-0 gap-1.5 rounded-xl border-base-content/15 px-3 font-medium sm:h-9 sm:rounded-lg"
                    aria-label="Open block inspector"
                    onClick={() => {
                      setInspectorTab("block");
                      setBlockSettingsSheetOpen(true);
                    }}
                  >
                    <PanelRight className="size-4 shrink-0 opacity-90" aria-hidden />
                    Inspect
                  </Button>
                </>
              ) : null}
              <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:basis-[min(100%,14rem)] sm:flex-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-base-content/45">
                    {doc.title}
                  </p>
                  {activePair.breadcrumb.length > 0 ? (
                    <p className="truncate text-xs text-base-content/50">
                      {activePair.breadcrumb.map((b) => b.title).join(" · ")}
                    </p>
                  ) : null}
                  <p className="truncate font-heading text-base font-semibold leading-snug text-base-content lg:text-lg">
                    {activePair.section.title}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary"
                    title="Article type"
                  >
                    {storyKindPillText(doc.kind)}
                  </span>
                  {headerPublishState != null ? (
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                        headerPublishState === "published" &&
                          "border-success/40 bg-success/15 text-success",
                        headerPublishState === "saved" &&
                          "border-base-content/20 bg-base-content/[0.08] text-base-content/80",
                        headerPublishState === "draft" &&
                          "border-warning/40 bg-warning/12 text-warning",
                      )}
                      title={
                        headerPublishState === "published"
                          ? "Published"
                          : headerPublishState === "saved"
                            ? "Draft saved — no unsaved changes"
                            : "Unsaved changes"
                      }
                    >
                      {headerPublishState}
                    </span>
                  ) : null}
                </div>
              </div>
              {isLg ? (
                <>
                  <StoryEditPreviewModeToggle mode={mode} onMode={setMode} layout="compact" />
                  {mode === "edit" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0 font-medium",
                          isLeftPanelOpen && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                        )}
                        title={isLeftPanelOpen ? "Hide structure" : "Show structure"}
                        aria-label={isLeftPanelOpen ? "Hide structure panel" : "Show structure panel"}
                        onClick={() => setLeftPanelOpen((o) => !o)}
                      >
                        <FolderTree className="size-4 opacity-90" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0 font-medium",
                          inspectorOpen && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                        )}
                        title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                        aria-label={inspectorOpen ? "Hide inspector panel" : "Show inspector panel"}
                        onClick={() => setInspectorOpen((o) => !o)}
                      >
                        {inspectorOpen ? (
                          <PanelRightClose className="size-4 opacity-90" aria-hidden />
                        ) : (
                          <SlidersHorizontal className="size-4 opacity-90" aria-hidden />
                        )}
                      </Button>
                    </>
                  ) : null}
                  {publishSplitControl()}
                  {mode === "edit" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0 font-medium"
                      title="Add block"
                      aria-label="Add block — choose a block type"
                      onClick={() => setFullscreenAddBlockOpen(true)}
                    >
                      <Plus className="size-4 opacity-90" aria-hidden />
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {isFullscreen && mode === "edit" ? (
          <StoryGlobalTipTapToolbar
            toolbarDensity={isLg ? "default" : "touch"}
            className="px-2 pb-2 pt-1 lg:px-4"
            frameClassName="rounded-lg border-base-content/10 bg-base-200/70"
          />
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            /* Desk surface: full width of editor column, matches admin shell. */
            "bg-base-300/65 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
            isFullscreen && "bg-base-300/80",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-full min-w-0",
              /* Inner padding only around the document sheet. */
              isFullscreen
                ? "px-3 pb-8 pt-3 sm:px-5 sm:pb-10 sm:pt-4 lg:px-8 lg:pb-14 lg:pt-5"
                : mode === "edit"
                  ? "px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-8 lg:pb-20 lg:pt-6"
                  : "px-3 pb-8 pt-4 sm:px-5 lg:px-8 lg:pb-8",
            )}
          >
          <StoryTipTapCanvasToneProvider tone="paper">
            <div
              className={cn(
                "story-doc-paper-surface w-full min-w-0",
                "rounded-lg border border-black/20 bg-white text-neutral-900",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.1),0_20px_48px_-12px_rgba(0,0,0,0.12)]",
                "ring-1 ring-black/[0.04]",
              )}
            >
              {isFullscreen && mode === "preview" ? (
                <div className="min-h-[min(32rem,70vh)] overflow-auto px-3 py-4 sm:px-5 sm:py-6">
                  <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
                </div>
              ) : null}
              {!isFullscreen ? (
                <div className="border-b border-black/20 px-4 py-4 sm:px-5 lg:px-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Section</p>
                  {outlineRename?.kind === "section" && outlineRename.id === activePair.section.id ? (
                    <div className="mt-2 max-w-xl" onClick={(e) => e.stopPropagation()}>
                      <OutlineRenameInput
                        initial={activePair.section.title}
                        onCommit={(v) => {
                          renameSectionTitle(activePair.section.id, v);
                          setOutlineRename(null);
                        }}
                        onCancel={() => setOutlineRename(null)}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        {activePair.breadcrumb.length > 0 ? (
                          <p className="truncate text-xs text-neutral-600">
                            {activePair.breadcrumb.map((b) => b.title).join(" · ")}
                          </p>
                        ) : null}
                        <p className="truncate font-heading text-lg font-semibold leading-snug tracking-tight text-neutral-900">
                          {activePair.section.title}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-10 w-10 shrink-0 rounded-lg p-0 text-neutral-600 hover:bg-neutral-100",
                        )}
                        aria-label="Rename section"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          queueMicrotask(() => setOutlineRename({ kind: "section", id: activePair.section.id }));
                        }}
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {!(isFullscreen && mode === "preview") ? (
              <div className={cn("space-y-4 px-4 py-6 sm:px-6 lg:space-y-2 lg:px-8 lg:py-8", isFullscreen && "pb-2")}>
            {groupStoryBlocksForLayout(activePair.section.blocks).map((group) => {
              const sectionId = activePair.section.id;
              const shared: Pick<
                StoryEditorSectionBlockCardProps,
                | "storySelection"
                | "isLg"
                | "isSm"
                | "insertColumnNested"
                | "removeBlock"
                | "setSelectedBlockId"
                | "setInspectorTab"
                | "setInspectorOpen"
                | "setBlockSettingsSheetOpen"
                | "updateRichBlock"
                | "patchRichBlockRowLayout"
                | "openBlockPlacement"
                | "moveBlock"
                | "appendIntoContainer"
                | "appendSplitSupportingPreset"
                | "patchMediaBlock"
                | "patchSplitContentBlock"
                | "tableOps"
              > = {
                storySelection,
                isLg,
                isSm,
                insertColumnNested,
                removeBlock,
                setSelectedBlockId,
                setInspectorTab,
                setInspectorOpen,
                setBlockSettingsSheetOpen,
                updateRichBlock,
                patchRichBlockRowLayout,
                openBlockPlacement,
                moveBlock,
                appendIntoContainer,
                appendSplitSupportingPreset,
                patchMediaBlock,
                patchSplitContentBlock,
                tableOps,
              };
              if (group.kind === "float-wrap") {
                return (
                  <Fragment key={`${group.float.id}-${group.text.id}`}>
                    <div className="flow-root min-w-0">
                      <StoryBlockRowDesignWrap block={group.float} floated>
                        <StoryEditorSectionBlockCard sectionId={sectionId} block={group.float} {...shared} />
                      </StoryBlockRowDesignWrap>
                      <StoryBlockRowDesignWrap block={group.text} floated={false} wrapperClassName="min-w-0">
                        <StoryEditorSectionBlockCard sectionId={sectionId} block={group.text} {...shared} />
                      </StoryBlockRowDesignWrap>
                    </div>
                  </Fragment>
                );
              }
              const block = group.block;
              return (
                <Fragment key={block.id}>
                  <StoryBlockRowDesignWrap block={block} floated={false}>
                    <StoryEditorSectionBlockCard sectionId={sectionId} block={block} {...shared} />
                  </StoryBlockRowDesignWrap>
                </Fragment>
              );
            })}
              </div>
              ) : null}
            </div>
          </StoryTipTapCanvasToneProvider>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Select a section from the outline.
      </div>
    );

  if (!doc && loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <Link href="/admin/stories" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "font-medium")}>
          Back to stories
        </Link>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        Loading story…
      </div>
    );
  }

  const inspectorEl =
    doc && mode === "edit" ? (
      <StoryCreatorInspector
        doc={doc}
        storyId={storyId}
        inspectorTab={inspectorTab}
        onInspectorTab={setInspectorTab}
        selectedBlock={selectedBlock}
        selectedBlockId={selectedBlockId}
        storyEditorDirty={storyEditorDirty}
        columnsLayoutBlock={columnsLayoutBlock}
        columnsNestingDepth={columnsNestingDepth}
        onPatchColumns={patchColumns}
        onPatchColumnSlot={patchColumnSlot}
        onPatchEmbed={patchEmbed}
        onPatchMedia={patchMedia}
        onPatchContainer={patchContainer}
        onPatchBlockRowLayout={patchBlockRowLayout}
        onPatchBlockDesign={patchBlockDesign}
        onPatchBlockDateAnnotation={patchBlockDateAnnotation}
        onPatchRichTextMeta={patchRichTextMeta}
        onPatchDividerMeta={patchDividerMeta}
        onPatchSplitContent={activePair && selectedBlockId ? (patch) => patchSplitContentBlock(activePair.section.id, selectedBlockId, patch) : undefined}
        onPatchTable={selectedBlock?.type === "table" ? patchTable : undefined}
        selectedBlockInSplitPanel={selectedBlockInSplitPanel}
        onTitleChange={setTitle}
        onExcerptChange={setExcerpt}
        onStoryMetaChange={patchStoryMeta}
        onClose={isLg ? () => setInspectorOpen(false) : undefined}
        onDeleteBlock={deleteSelectedBlock}
        className={cn(
          !isLg && "w-full min-h-0 flex-1 border-l-0 border-t",
          isLg && "h-full min-h-0 w-full min-w-0 border-primary/20 shadow-[inset_1px_0_0_0] shadow-black/10",
        )}
      />
    ) : null;

  return (
    <StoryTipTapStoryDocProvider doc={doc}>
      <StoryTiptapActiveEditorProvider toolbarDensity={isLg ? "default" : "touch"}>
        <StoryGlobalToolbarSelectionSync selectedBlockId={selectedBlockId} selectedBlockKind={selectedBlock?.type ?? null} />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          mode === "edit" && "bg-base-300",
          mode === "preview" && !isFullscreen && "bg-base-100",
          isFullscreen &&
            "fixed inset-0 z-[100] h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] overflow-hidden bg-base-300",
        )}
      >
      {!isFullscreen ? (
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-base-content/10 bg-base-300/95 px-3 py-3 backdrop-blur-md sm:gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-2 lg:px-5 lg:py-3">
        {!isLg ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StoryCreatorBrandMark />
              {publishSplitControl({ tall: true })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 gap-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                <span
                  className={cn(
                    "badge h-6 shrink-0 gap-1 border px-2.5 text-[11px] font-semibold",
                    doc.status === "published" ? "badge-success border-transparent" : "badge-ghost border-base-content/15",
                  )}
                >
                  {doc.status === "draft" ? "Draft" : "Published"}
                </span>
                <span className="badge badge-outline h-6 shrink-0 border-primary/30 px-2.5 text-[11px] font-semibold text-primary">
                  {storyKindUiLabel(doc.kind)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StoryEditPreviewModeToggle mode={mode} onMode={setMode} layout="touch" />
                {mode === "edit" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-11 min-h-[44px] w-11 shrink-0 rounded-xl border-base-content/12 p-0",
                        mobileShellTab === "structure" && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                      )}
                      title="Story structure"
                      aria-label="Open story structure"
                      onClick={() => setMobileShellTab((t) => (t === "structure" ? "add-block" : "structure"))}
                    >
                      <FolderTree className="size-5 opacity-90" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-11 min-h-[44px] w-11 shrink-0 rounded-xl border-base-content/12 p-0",
                        blockSettingsSheetOpen && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                      )}
                      title="Block inspector"
                      aria-label="Open block inspector"
                      onClick={() => {
                        setInspectorTab("block");
                        setBlockSettingsSheetOpen((o) => !o);
                      }}
                    >
                      <SlidersHorizontal className="size-5 opacity-90" aria-hidden />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <div className="hidden shrink-0 lg:flex">
                  <StoryCreatorBrandMark />
                </div>
                <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 lg:max-w-xl">
                  <input
                    ref={storyTitleInputRef}
                    className="input input-ghost input-sm h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-base-200/50 px-2.5 font-semibold text-base-content hover:border-base-content/15 focus:border-primary/35"
                    value={doc.title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="Story title"
                  />
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "h-9 w-9 shrink-0 rounded-lg p-0 text-base-content/60 hover:bg-base-content/[0.08]",
                    )}
                    aria-label="Focus story title"
                    onClick={() => storyTitleInputRef.current?.focus()}
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span
                    className={cn(
                      "badge h-7 shrink-0 gap-1 border px-2.5 text-xs font-semibold",
                      doc.status === "published" ? "badge-success border-transparent" : "badge-ghost border-base-content/15",
                    )}
                  >
                    {doc.status === "draft" ? "Draft" : "Published"}
                  </span>
                  <span className="badge badge-outline h-7 shrink-0 border-primary/30 px-2.5 text-xs font-semibold text-primary">
                    {storyKindUiLabel(doc.kind)}
                  </span>
                  {headerSaveLine}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <StoryEditPreviewModeToggle mode={mode} onMode={setMode} layout="default" />
              {mode === "edit" && isLg ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0"
                  title="Fullscreen writing (Esc to exit)"
                  aria-label="Enter fullscreen writing mode"
                  onClick={() => {
                    setMobileShellTab("add-block");
                    setIsFullscreen(true);
                  }}
                >
                  <Expand className="size-4 opacity-90" aria-hidden />
                </Button>
              ) : null}
              {mode === "edit" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0",
                      isLeftPanelOpen && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                    )}
                    title={isLeftPanelOpen ? "Hide structure" : "Show structure"}
                    aria-label={isLeftPanelOpen ? "Hide structure panel" : "Show structure panel"}
                    onClick={() => setLeftPanelOpen((o) => !o)}
                  >
                    <FolderTree className="size-4 opacity-90" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-lg border-base-content/12 p-0 font-medium",
                      inspectorOpen && "border-primary/40 bg-primary/12 text-primary ring-1 ring-primary/20",
                    )}
                    title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                    aria-label={inspectorOpen ? "Hide inspector panel" : "Show inspector panel"}
                    onClick={() => setInspectorOpen((o) => !o)}
                  >
                    {inspectorOpen ? (
                      <PanelRightClose className="size-4 opacity-90" aria-hidden />
                    ) : (
                      <SlidersHorizontal className="size-4 opacity-90" aria-hidden />
                    )}
                  </Button>
                </>
              ) : null}
              {publishSplitControl()}
            </div>
          </>
        )}
      </header>
      ) : null}
      {!isFullscreen && mode === "edit" ? (
        <StoryGlobalTipTapToolbar
          toolbarDensity={isLg ? "default" : "touch"}
          className="shrink-0 border-b border-base-content/10 bg-base-300/90 px-2 py-1.5 lg:px-4"
          frameClassName="rounded-lg border-base-content/10 bg-base-200/75 shadow-sm"
        />
      ) : null}

      {isLg ? (
        mode === "preview" && !isFullscreen ? (
          <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
        ) : mode === "preview" && isFullscreen ? (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{editorPanel}</div>
        ) : (
          <div
            className={cn(
              "relative flex min-h-0 flex-1",
              !isFullscreen && "pb-16",
              isFullscreen && "min-h-0 flex-1 overflow-hidden pb-0",
              (isResizingLeftPanel || isResizingRightPanel) && "select-none",
            )}
          >
            <>
              <div
                className={cn(
                  "relative flex shrink-0 overflow-hidden border-r border-primary/20 bg-base-200/40 shadow-[inset_-1px_0_0_0] shadow-black/10",
                  STORY_PANEL_TRANSITION,
                )}
                style={{
                  width: isLeftPanelOpen ? leftPanelWidthPx + 6 : 0,
                }}
              >
                <div
                  className="flex h-full min-h-0"
                  style={{ width: isLeftPanelOpen ? leftPanelWidthPx + 6 : 0 }}
                >
                  <div className="flex h-full min-h-0 shrink-0 flex-col overflow-hidden" style={{ width: leftPanelWidthPx }}>
                    {structurePanel}
                  </div>
                  {isLeftPanelOpen ? (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize structure panel"
                      aria-valuemin={STORY_LEFT_PANEL_MIN}
                      aria-valuemax={STORY_LEFT_PANEL_MAX}
                      aria-valuenow={leftPanelWidthPx}
                      tabIndex={0}
                      className={cn(
                        "flex w-1.5 shrink-0 cursor-col-resize items-center justify-center border-l border-primary/25 bg-gradient-to-b from-base-300/80 via-primary/15 to-base-300/80 hover:from-primary/25 hover:via-primary/35 hover:to-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      )}
                      onPointerDown={onLeftPanelResizePointerDown}
                      onKeyDown={(ke) => {
                        if (ke.key === "ArrowLeft") {
                          ke.preventDefault();
                          setLeftPanelWidthPx((w) => clampStoryLeftPanelWidth(w - 12));
                        } else if (ke.key === "ArrowRight") {
                          ke.preventDefault();
                          setLeftPanelWidthPx((w) => clampStoryLeftPanelWidth(w + 12));
                        }
                      }}
                    >
                      <GripVertical className="pointer-events-none size-3 text-primary/50" aria-hidden />
                    </div>
                  ) : null}
                </div>
              </div>
              {!isLeftPanelOpen ? (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "absolute left-0 top-1/2 z-20 h-24 w-8 -translate-y-1/2 rounded-r-2xl border-primary/30 bg-base-200/90 px-0 text-primary shadow-md backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10",
                  )}
                  aria-label="Open story structure panel"
                  title="Open structure"
                  onClick={() => setLeftPanelOpen(true)}
                >
                  <ChevronRight className="mx-auto size-4" strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
            </>
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                /* Let the editor scroll region own the desk surface so padding + sheet read clearly. */
                !isFullscreen && "bg-base-300/25",
                isFullscreen && "min-h-0 min-w-0 flex-1 bg-base-300/20",
              )}
            >
              {editorPanel}
            </div>
            <>
              <div
                className={cn(
                  "relative shrink-0 overflow-hidden border-l border-primary/20 bg-base-200/40 shadow-[inset_1px_0_0_0] shadow-black/10",
                  STORY_PANEL_TRANSITION,
                )}
                style={{ width: inspectorOpen ? rightPanelWidthPx + 6 : 0 }}
              >
                <div
                  className="flex h-full min-h-0 flex-row"
                  style={{ width: inspectorOpen ? rightPanelWidthPx + 6 : 0 }}
                >
                  {inspectorOpen ? (
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Resize inspector panel"
                      aria-valuemin={STORY_RIGHT_PANEL_MIN}
                      aria-valuemax={STORY_RIGHT_PANEL_MAX}
                      aria-valuenow={rightPanelWidthPx}
                      tabIndex={0}
                      className={cn(
                        "flex w-1.5 shrink-0 cursor-col-resize items-center justify-center border-r border-primary/25 bg-gradient-to-b from-base-300/80 via-primary/15 to-base-300/80 hover:from-primary/25 hover:via-primary/35 hover:to-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      )}
                      onPointerDown={onRightPanelResizePointerDown}
                      onKeyDown={(ke) => {
                        if (ke.key === "ArrowLeft") {
                          ke.preventDefault();
                          setRightPanelWidthPx((w) => clampStoryRightPanelWidth(w + 12));
                        } else if (ke.key === "ArrowRight") {
                          ke.preventDefault();
                          setRightPanelWidthPx((w) => clampStoryRightPanelWidth(w - 12));
                        }
                      }}
                    >
                      <GripVertical className="pointer-events-none size-3 text-primary/50" aria-hidden />
                    </div>
                  ) : null}
                  <div
                    className="h-full min-h-0 flex-1 overflow-hidden"
                    style={{ width: rightPanelWidthPx, minWidth: rightPanelWidthPx }}
                  >
                    {inspectorEl}
                  </div>
                </div>
              </div>
              {!inspectorOpen ? (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "absolute right-0 top-1/2 z-20 h-24 w-8 -translate-y-1/2 rounded-l-2xl border-primary/30 bg-base-200/90 px-0 text-primary shadow-md backdrop-blur-sm hover:border-primary/50 hover:bg-primary/10",
                  )}
                  aria-label="Open inspector panel"
                  title="Open inspector"
                  onClick={() => setInspectorOpen(true)}
                >
                  <ChevronLeft className="mx-auto size-4" strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
            </>
          </div>
        )
      ) : (
        <>
          {mode === "preview" ? (
            isFullscreen ? (
              editorPanel
            ) : (
              <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
            )
          ) : (
            <>
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {mobileShellTab === "add-block" ? editorPanel : null}
              </div>
              <StoryMobileFullScreenPanel
                open={mobileShellTab === "structure"}
                onOpenChange={(open) => {
                  if (!open) setMobileShellTab("add-block");
                }}
                title="Story structure"
              >
                {renderStructureSidebar(true)}
              </StoryMobileFullScreenPanel>
              <StoryMobileFullScreenPanel
                open={mobileShellTab === "settings"}
                onOpenChange={(open) => {
                  if (!open) setMobileShellTab("add-block");
                }}
                title="Story settings"
              >
                <StoryCreatorInspector
                  layout="sheet-story"
                  doc={doc}
                  storyId={storyId}
                  inspectorTab="story"
                  onInspectorTab={setInspectorTab}
                  selectedBlock={selectedBlock}
                  selectedBlockId={selectedBlockId}
                  storyEditorDirty={storyEditorDirty}
                  onPatchEmbed={patchEmbed}
                  onPatchMedia={patchMedia}
                  onPatchBlockRowLayout={patchBlockRowLayout}
                  onPatchBlockDesign={patchBlockDesign}
                  onTitleChange={setTitle}
                  onExcerptChange={setExcerpt}
                  onStoryMetaChange={patchStoryMeta}
                  className="min-h-0 border-0 bg-transparent"
                />
              </StoryMobileFullScreenPanel>
              <StoryBlockSettingsBottomSheet
                open={blockSettingsSheetOpen}
                onOpenChange={setBlockSettingsSheetOpen}
                title="Block settings"
              >
                <StoryCreatorInspector
                  layout="sheet-block"
                  doc={doc}
                  storyId={storyId}
                  inspectorTab="block"
                  onInspectorTab={setInspectorTab}
                  selectedBlock={selectedBlock}
                  columnsLayoutBlock={columnsLayoutBlock}
                  columnsNestingDepth={columnsNestingDepth}
                  onPatchColumns={patchColumns}
                  onPatchColumnSlot={patchColumnSlot}
                  onPatchEmbed={patchEmbed}
                  onPatchMedia={patchMedia}
                  onPatchContainer={patchContainer}
                  onPatchBlockRowLayout={patchBlockRowLayout}
                  onPatchBlockDesign={patchBlockDesign}
                  onPatchBlockDateAnnotation={patchBlockDateAnnotation}
                  onPatchRichTextMeta={patchRichTextMeta}
                  onPatchDividerMeta={patchDividerMeta}
                  onPatchSplitContent={activePair && selectedBlockId ? (patch) => patchSplitContentBlock(activePair.section.id, selectedBlockId, patch) : undefined}
                  onPatchTable={selectedBlock?.type === "table" ? patchTable : undefined}
                  selectedBlockInSplitPanel={selectedBlockInSplitPanel}
                  onTitleChange={setTitle}
                  onExcerptChange={setExcerpt}
                  onStoryMetaChange={patchStoryMeta}
                  onDeleteBlock={deleteSelectedBlock}
                  className="min-h-0 border-0 bg-transparent"
                />
              </StoryBlockSettingsBottomSheet>
            </>
          )}
        </>
      )}
      {mode === "edit" ? (
        <StoryAddBlockBottomSheet open={addBlockSheetOpen} onOpenChange={setAddBlockSheetOpen} title="Add block">
          <StoryAddBlockPresetTypeGrid
            groups={STORY_ADD_BLOCK_DOCK_PRESET_GROUPS}
            onPick={(id) => insertBlockFromDockPicker(id)}
          />
          <p className="mt-4 text-center text-xs leading-relaxed text-base-content/45">
            New blocks insert after the selection when possible.
          </p>
        </StoryAddBlockBottomSheet>
      ) : null}
      {mode === "edit" && !isFullscreen ? (
        dockCollapsed ? (
          <StoryEditorDockPullTab onOpen={() => setDockCollapsed(false)} />
        ) : (
          <StoryEditorBottomDock
            active={isLg ? null : mobileShellTab}
            emphasizeAddBlockFab={isLg}
            onNavigate={handleDockNavigate}
            onCollapse={() => setDockCollapsed(true)}
          />
        )
      ) : null}
      {isFullscreen && mode === "edit" ? (
        <footer className="relative z-20 flex h-9 shrink-0 items-center justify-between border-t border-base-content/15 bg-base-200/92 px-3 text-[11px] font-medium tracking-wide text-base-content/70 backdrop-blur-sm sm:px-4">
          <div className="flex items-center gap-3">
            <span className="uppercase text-base-content/55">Status</span>
            <span>{fullscreenStoryStats.wordCount.toLocaleString()} words</span>
            <span className="text-base-content/35">|</span>
            <span>{fullscreenStoryStats.sectionCount.toLocaleString()} sections</span>
          </div>
          <span className="hidden uppercase text-base-content/45 sm:inline">Fullscreen writing</span>
        </footer>
      ) : null}
      <StoryBlockPlacementDialog
        open={blockPlacementModal !== null}
        onOpenChange={handlePlacementModalOpenChange}
        flow={blockPlacementModal?.flow ?? null}
        variant={blockPlacementModal?.variant ?? "section"}
        allowNestedColumns={blockPlacementModal?.allowNestedColumns ?? true}
        initialAddPosition={blockPlacementModal?.initialAddPosition ?? null}
        presetAllowlist={blockPlacementModal?.presetAllowlist ?? null}
        onAddComplete={applyPlacementAdd}
        onDuplicateComplete={applyPlacementDuplicate}
      />
      <Dialog open={fullscreenAddBlockOpen} onOpenChange={setFullscreenAddBlockOpen}>
        <DialogPortal>
          <DialogBackdrop className="z-[200]" />
          <DialogViewport className="fixed inset-0 z-[200] flex min-h-full w-full items-center justify-center p-4">
            <DialogPopup
              className={cn(
                "max-h-[min(90dvh,720px)] w-full max-w-2xl overflow-y-auto border-base-content/12 bg-base-100 p-5 shadow-xl ring-1 ring-base-content/[0.06]",
                "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
              )}
            >
              <DialogTitle className="font-heading text-lg text-base-content">Add block</DialogTitle>
              <DialogDescription className="text-sm text-base-content/65">
                New blocks are inserted after the selected block when possible, otherwise at the end of this section.
              </DialogDescription>
              <div className="mt-4 max-h-[min(52dvh,480px)] overflow-y-auto pr-1">
                <StoryAddBlockPresetTypeGrid
                  groups={fullscreenAddBlockPresetGroups}
                  onPick={(id) => insertBlockFromDockPicker(id, { fromFullscreenAddModal: true })}
                />
              </div>
              <div className="mt-5 flex justify-end border-t border-base-content/10 pt-4">
                <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setFullscreenAddBlockOpen(false)}>
                  Cancel
                </Button>
              </div>
            </DialogPopup>
          </DialogViewport>
        </DialogPortal>
      </Dialog>
      </div>
      </StoryTiptapActiveEditorProvider>
    </StoryTipTapStoryDocProvider>
  );
}

type StorySectionContainerInnerProps = {
  nest: StoryContainerBlock;
  sectionId: string;
  isLg: boolean;
  isSm: boolean;
  storySelection: StorySelection | null;
  updateRichBlock: (sectionId: string, blockId: string, json: JSONContent) => void;
  patchRichBlockRowLayout: (sectionId: string, blockId: string, patch: Partial<StoryBlockRowLayout>) => void;
  insertColumnNested: (
    sectionId: string,
    columnsBlockId: string,
    columnIndex: 0 | 1,
    atIndex: number,
    presetId: StoryAddBlockPresetId,
  ) => void;
  removeBlock: (sectionId: string, blockId: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setInspectorTab: (t: StoryInspectorTab) => void;
  setInspectorOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setBlockSettingsSheetOpen: (open: boolean) => void;
  openBlockPlacement: (args: StoryBlockPlacementModalArgs) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  appendIntoContainer: (sectionId: string, containerId: string, block: StoryBlock) => void;
  appendSplitSupportingPreset: (sectionId: string, splitBlockId: string, presetId: StoryAddBlockPresetId) => void;
  patchSplitContentBlock?: (sectionId: string, blockId: string, patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => void;
  tableOps?: (sectionId: string, blockId: string) => TableBlockOps;
  /** Floating toolbar depth for blocks inside this container. */
  chromeDepth?: number;
};

/** Recursive section-level container body (nested containers inside a section container). */
function StorySectionContainerInner({
  nest,
  sectionId,
  isLg,
  isSm,
  storySelection,
  updateRichBlock,
  patchRichBlockRowLayout,
  insertColumnNested,
  removeBlock,
  setSelectedBlockId,
  setInspectorTab,
  setInspectorOpen,
  setBlockSettingsSheetOpen,
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
  appendSplitSupportingPreset,
  patchSplitContentBlock,
  tableOps,
  chromeDepth = 1,
}: StorySectionContainerInnerProps) {
  const nestSelected = isStoryChromeBlockSelected(storySelection, nest.id);
  const containerEmptyHint = getContainerPresetEmptyHint(getStoryContainerPreset(nest.props));
  const containerShellClass = getContainerClasses(nest, "editor", {
    selected: nestSelected,
    emptyChildren: nest.children.length === 0,
  });
  const containerShellStyle = getContainerCustomBackgroundStyle(nest.props);

  function renderContainerChildBody(child: StoryBlock) {
    if (child.type === "richText") {
      return (
        <StoryCanvasVerseResizableEditor
          editorKey={`${sectionId}-${nest.id}-${child.id}`}
          rich={child}
          onJson={(json) => updateRichBlock(sectionId, child.id, json)}
          isLg={isLg}
          surface="card"
          syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, child.id)}
          onResizeWidth={(pct) =>
            patchRichBlockRowLayout(sectionId, child.id, {
              widthMode: pct >= 100 ? "full" : "custom",
              widthValue: pct >= 100 ? undefined : pct,
              widthUnit: "%",
              displayMode: "block",
              float: undefined,
            })
          }
        />
      );
    }
    if (child.type === "media") {
      return (
        <MediaEmbedCanvasCard
          block={child}
          onConfigure={() => {
            setSelectedBlockId(child.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
        />
      );
    }
    if (child.type === "embed") {
      return (
        <EmbedCanvasCard
          block={child}
          onConfigure={() => {
            setSelectedBlockId(child.id);
            setInspectorTab("block");
            if (isLg) setInspectorOpen(true);
            else setBlockSettingsSheetOpen(true);
          }}
        />
      );
    }
    if (child.type === "divider") {
      return <StoryDividerEditorChrome block={child} />;
    }
    if (child.type === "table") {
      return tableOps ? (
        <StoryTableBlockEditor block={child} ops={tableOps(sectionId, child.id)} />
      ) : (
        <div className="rounded-xl border border-neutral-200/95 bg-neutral-50/90 p-4 text-sm text-neutral-400">Table</div>
      );
    }
    if (child.type === "splitContent") {
      return (
        <StorySplitContentEditorLayout
          block={child}
          onResizeSupportingWidth={patchSplitContentBlock ? (pct) => patchSplitContentBlock(sectionId, child.id, { supportingWidthPct: pct }) : undefined}
          textEditor={
            <div className="max-w-full">
              <StoryCanvasVerseResizableEditor
                editorKey={`${sectionId}-${nest.id}-${child.text.id}`}
                rich={child.text}
                onJson={(json) => updateRichBlock(sectionId, child.text.id, json)}
                isLg={isLg}
                surface="card"
                syncGlobalToolbarSelection={isStoryRichTextBlockToolbarSelected(storySelection, child.text.id)}
                onResizeWidth={(pct) =>
                  patchRichBlockRowLayout(sectionId, child.text.id, {
                    widthMode: pct >= 100 ? "full" : "custom",
                    widthValue: pct >= 100 ? undefined : pct,
                    widthUnit: "%",
                    displayMode: "block",
                    float: undefined,
                  })
                }
              />
            </div>
          }
          supportingAside={
            <div className="space-y-2">
              {child.supporting.blocks.length === 0 ? (
                <p className="text-center text-xs text-base-content/45">Empty supporting area.</p>
              ) : (
                child.supporting.blocks.map((sb) => (
                  <StorySplitSupportBlockSectionChrome
                    key={sb.id}
                    sectionId={sectionId}
                    splitBlockId={child.id}
                    sb={sb}
                    supportPlacementVariant="section"
                    allowNestedColumns
                    isLg={isLg}
                    isSm={isSm}
                    chromeDepth={chromeDepth + 1}
                    columnsNestedDepth={1}
                    storySelection={storySelection}
                    insertColumnNested={insertColumnNested}
                    removeBlock={removeBlock}
                    setSelectedBlockId={setSelectedBlockId}
                    setInspectorTab={setInspectorTab}
                    setInspectorOpen={setInspectorOpen}
                    setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                    updateRichBlock={updateRichBlock}
                    patchRichBlockRowLayout={patchRichBlockRowLayout}
                    openBlockPlacement={openBlockPlacement}
                    moveBlock={moveBlock}
                    appendIntoContainer={appendIntoContainer}
                    appendSplitSupportingPreset={appendSplitSupportingPreset}
                    tableOps={tableOps}
                    renderNestedContainer={(cn) => (
                      <StorySectionContainerInner
                        nest={cn}
                        sectionId={sectionId}
                        isLg={isLg}
                        isSm={isSm}
                        storySelection={storySelection}
                        updateRichBlock={updateRichBlock}
                        patchRichBlockRowLayout={patchRichBlockRowLayout}
                        insertColumnNested={insertColumnNested}
                        removeBlock={removeBlock}
                        setSelectedBlockId={setSelectedBlockId}
                        setInspectorTab={setInspectorTab}
                        setInspectorOpen={setInspectorOpen}
                        setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
                        openBlockPlacement={openBlockPlacement}
                        moveBlock={moveBlock}
                        appendIntoContainer={appendIntoContainer}
                        appendSplitSupportingPreset={appendSplitSupportingPreset}
                        patchSplitContentBlock={patchSplitContentBlock}
                        tableOps={tableOps}
                        chromeDepth={chromeDepth + 1}
                      />
                    )}
                  />
                ))
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full gap-2 border-base-content/15 font-medium text-xs",
                  )}
                >
                  Add to supporting area
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 min-w-[11rem] overflow-y-auto">
                  {STORY_SPLIT_SUPPORT_ADD_PRESET_IDS.map((id) => (
                    <DropdownMenuItem key={id} className="text-xs font-medium" onClick={() => appendSplitSupportingPreset(sectionId, child.id, id)}>
                      {storyAddPresetLabel(id)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />
      );
    }
    if (child.type === "columns") {
      return (
        <StoryNestedColumnsGrid
          sectionId={sectionId}
          columnsBlock={child}
          depth={chromeDepth + 1}
          isSm={isSm}
          isLg={isLg}
          storySelection={storySelection}
          insertColumnNested={insertColumnNested}
          removeBlock={removeBlock}
          setSelectedBlockId={setSelectedBlockId}
          setInspectorTab={setInspectorTab}
          setInspectorOpen={setInspectorOpen}
          setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
          updateRichBlock={updateRichBlock}
          patchRichBlockRowLayout={patchRichBlockRowLayout}
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
          appendSplitSupportingPreset={appendSplitSupportingPreset}
          tableOps={tableOps}
        />
      );
    }
    if (child.type === "container") {
      return (
        <StorySectionContainerInner
          nest={child}
          sectionId={sectionId}
          isLg={isLg}
          isSm={isSm}
          storySelection={storySelection}
          updateRichBlock={updateRichBlock}
          patchRichBlockRowLayout={patchRichBlockRowLayout}
          insertColumnNested={insertColumnNested}
          removeBlock={removeBlock}
          setSelectedBlockId={setSelectedBlockId}
          setInspectorTab={setInspectorTab}
          setInspectorOpen={setInspectorOpen}
          setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
          appendSplitSupportingPreset={appendSplitSupportingPreset}
          patchSplitContentBlock={patchSplitContentBlock}
          tableOps={tableOps}
          chromeDepth={chromeDepth + 1}
        />
      );
    }
    return null;
  }

  function renderContainerChildCard(child: StoryBlock) {
    const sel = isStoryChromeBlockSelected(storySelection, child.id);
    const placementVariant: StoryBlockPlacementVariant = child.type === "container" ? "container" : "section";
    const openInspector = () => {
      setSelectedBlockId(child.id);
      setInspectorTab("block");
      if (isLg) setInspectorOpen(true);
      else setBlockSettingsSheetOpen(true);
    };
    return (
      <StoryEditorBlockFrame
        block={child}
        frameLabel={storyBlockDisplayLabel(child)}
        selected={sel}
        isLg={isLg}
        chromeDepth={chromeDepth}
        visualQuietContainer={child.type === "container"}
        onSelect={() => {
          setSelectedBlockId(child.id);
          setInspectorTab("block");
        }}
        onAddAbove={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: child.id,
            variant: placementVariant,
            allowNestedColumns: true,
            initialAddPosition: "above",
          })
        }
        onAddBelow={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: child.id,
            variant: placementVariant,
            allowNestedColumns: true,
            initialAddPosition: "below",
          })
        }
        onAddInsideContainer={
          child.type === "container"
            ? () =>
                openBlockPlacement({
                  flow: "add",
                  targetBlockId: child.children?.[0]?.id ?? child.id,
                  variant: "container",
                  allowNestedColumns: true,
                })
            : undefined
        }
        onDuplicate={() =>
          openBlockPlacement({
            flow: "duplicate",
            targetBlockId: child.id,
            variant: placementVariant,
            allowNestedColumns: true,
          })
        }
        onDelete={() => removeBlock(sectionId, child.id)}
        onOpenInspector={openInspector}
        onMove={(dir) => moveBlock(sectionId, child.id, dir)}
      >
        {renderContainerChildBody(child)}
      </StoryEditorBlockFrame>
    );
  }

  return (
    <div className={containerShellClass} style={containerShellStyle ?? undefined}>
      {nest.props.label?.trim() ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{nest.props.label.trim()}</p>
      ) : null}
      {nest.children.length === 0 ? (
        <>
          <p className="px-1 text-center text-sm leading-relaxed text-neutral-600">{containerEmptyHint}</p>
          <StoryEmptySlotAddBlockMenu
            mobile={!isLg}
            allowNestedColumns
            surface="sheet"
            density="compact"
            includeDivider
            onInsert={(presetId) =>
              appendIntoContainer(sectionId, nest.id, createStoryBlockFromPreset(presetId))
            }
          />
        </>
      ) : (
        <div className="space-y-3">
          {groupStoryBlocksForLayout(nest.children).map((group) => {
            if (group.kind === "float-wrap") {
              return (
                <div key={`${group.float.id}-${group.text.id}`} className="flow-root min-w-0">
                  <StoryBlockRowDesignWrap block={group.float} floated>
                    {renderContainerChildCard(group.float)}
                  </StoryBlockRowDesignWrap>
                  <StoryBlockRowDesignWrap block={group.text} floated={false} wrapperClassName="min-w-0">
                    {renderContainerChildCard(group.text)}
                  </StoryBlockRowDesignWrap>
                </div>
              );
            }
            const child = group.block;
            return (
              <StoryBlockRowDesignWrap key={child.id} block={child} floated={false}>
                {renderContainerChildCard(child)}
              </StoryBlockRowDesignWrap>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MediaEmbedCanvasCard({
  block,
  onConfigure,
  compact,
  onResizeWidth,
  onResizeHeight,
}: {
  block: StoryMediaBlock;
  onConfigure: () => void;
  /** Narrow column: use a slim placeholder when no file is picked yet. */
  compact?: boolean;
  onResizeWidth?: (pct: number) => void;
  onResizeHeight?: (px: number | undefined) => void;
}) {
  return <MediaBlockContentRenderer block={block} variant="editor" compact={compact} onConfigure={onConfigure} onResizeWidth={onResizeWidth} onResizeHeight={onResizeHeight} />;
}

function EmbedCanvasCard({
  block,
  compact,
  onConfigure,
}: {
  block: StoryEmbedBlock;
  compact?: boolean;
  onConfigure?: () => void;
}) {
  return <EmbedBlockContentRenderer block={block} variant="editor" compact={compact} onConfigure={onConfigure} />;
}
