"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Expand,
  Eye,
  GripVertical,
  ImageIcon,
  Layers,
  LayoutTemplate,
  Minimize2,
  Minus,
  MoreHorizontal,
  Pencil,
  PanelRight,
  PanelRightClose,
  Loader2,
  Plus,
  Save,
  Send,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StoryGlobalTipTapToolbar } from "@/components/admin/story-creator/StoryGlobalTipTapToolbar";
import { StoryTipTapEditor } from "@/components/admin/story-creator/StoryTipTapEditor";
import { StoryTiptapActiveEditorProvider } from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import { StoryTipTapStoryDocProvider } from "@/components/admin/story-creator/story-tiptap-story-doc-context";
import { StoryCreatorPreview } from "@/components/admin/story-creator/story-creator-preview";
import type { JSONContent } from "@tiptap/core";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
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
  StorySection,
} from "@/lib/admin/story-creator/story-types";
import { newStoryId } from "@/lib/admin/story-creator/story-types";
import { loadStoryDocument, saveStoryDocument } from "@/lib/admin/story-creator/story-storage";
import { EmbedBlockContentRenderer } from "@/components/admin/story-creator/story-block-embed-content";
import { MediaBlockContentRenderer } from "@/components/admin/story-creator/story-block-media-content";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { StoryCreatorInspector, type StoryInspectorTab } from "@/components/admin/story-creator/StoryCreatorInspector";
import {
  StoryAddBlockBottomSheet,
  StoryBlockSettingsBottomSheet,
  StoryEditorBottomDock,
  StoryMobileFullScreenPanel,
  type StoryMobileShellTab,
} from "@/components/admin/story-creator/story-creator-mobile";
import {
  OutlineRenameInput,
  StoryStructureSidebar,
  type OutlineRenameTarget,
} from "@/components/admin/story-creator/StoryStructureSidebar";
import { migrateStoryDocument } from "@/lib/admin/story-creator/migrate-story-document";
import { normalizeStorySlugInput, slugifyStoryTitle } from "@/lib/admin/story-creator/story-slug";
import { ApiError } from "@/lib/infra/api";
import { columnsBlockDepthInSection, MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import {
  resolveColumnGapRem,
  storyColumnStackStyle,
  storyColumnsGridStyle,
} from "@/lib/admin/story-creator/story-columns-layout";
import { moveStoryBlockRelative } from "@/lib/admin/story-creator/story-block-move-relative";
import {
  appendBlockIntoContainer,
  duplicateBlockRelativeToBlockId,
  findStoryBlockAnywhere,
  insertBlockAtIndex,
  insertBlockRelativeToBlockId,
  insertColumnNestedAt,
  patchBlockDesignInSection,
  patchBlockRowLayoutInSection,
  patchColumnSlotLayout,
  patchColumnsInSection,
  patchContainerInSection,
  patchBlockDateAnnotationInSection,
  patchEmbedInSection,
  patchMediaInSection,
  patchRichTextInSection,
  removeBlockById,
} from "@/lib/admin/story-creator/story-doc-mutators";
import {
  groupColumnNestedBlocksForLayout,
  groupStoryBlocksForLayout,
} from "@/lib/admin/story-creator/story-block-layout";
import {
  createColumnNestedBlock,
  createDefaultSectionBlocks,
  createStoryBlock,
  type StoryColumnNestedInsertKind,
  type StoryInsertKind,
} from "@/lib/admin/story-creator/story-block-factory";
import { resolveStorySelection, type StorySelection } from "@/lib/admin/story-creator/story-selection";
import {
  StoryBlockPlacementDialog,
  type StoryBlockPlacementVariant,
} from "@/components/admin/story-creator/StoryBlockPlacementDialog";
import { StoryBlockRowDesignWrap } from "@/components/admin/story-creator/StoryBlockDesignWrap";
import { StoryEditorBlockFrame } from "@/components/admin/story-creator/StoryEditorBlockFrame";
import { StoryColumnInsertAffordance } from "@/components/admin/story-creator/StoryColumnInsertAffordance";
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

function blockCanvasHeaderLabel(block: StoryBlock): string {
  if (block.type === "richText") return "Rich text";
  if (block.type === "columns") return "Columns (2)";
  if (block.type === "divider") return "Divider";
  if (block.type === "media") return "Media";
  if (block.type === "embed") return `Embed (${block.embedKind})`;
  if (block.type === "container") return block.props.label?.trim() || "Container";
  return "Block";
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

type StoryBlockPlacementModalArgs = {
  flow: "add" | "duplicate";
  targetBlockId: string;
  variant: StoryBlockPlacementVariant;
  allowNestedColumns: boolean;
  initialAddPosition?: "above" | "below";
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
    kind: StoryColumnNestedInsertKind,
  ) => void;
  removeBlock: (sectionId: string, blockId: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setInspectorTab: (t: StoryInspectorTab) => void;
  setInspectorOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setBlockSettingsSheetOpen: (open: boolean) => void;
  updateRichBlock: (sectionId: string, blockId: string, json: JSONContent) => void;
  openBlockPlacement: (args: StoryBlockPlacementModalArgs) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  appendIntoContainer: (sectionId: string, containerId: string, block: StoryBlock) => void;
};

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
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
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
  const cellBorder =
    depth >= 2 ? "border-base-content/[0.045] ring-primary/10" : "border-base-content/[0.08] hover:border-base-content/14";
  const cellActiveBorder = depth >= 2 ? "border-primary/30 ring-1 ring-primary/12" : "border-primary/40 ring-1 ring-primary/18";

  function renderContainerInColumn(nest: StoryContainerBlock) {
    const nestSelected = storySelection?.mode === "section" && storySelection.block.id === nest.id;
    const frameLabel = nest.props.label?.trim() || "Container";
    const placementVariant: StoryBlockPlacementVariant = "column";

    function renderColContainerChildBody(child: StoryBlock) {
      if (child.type === "richText") {
        return (
          <StoryTipTapEditor
            editorKey={`${sectionId}-${nest.id}-${child.id}`}
            content={child.doc}
            onChange={(json) => updateRichBlock(sectionId, child.id, json)}
            toolbarDensity={isLg ? "default" : "touch"}
            surface="canvas"
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
              if (!isLg) setBlockSettingsSheetOpen(true);
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
              if (!isLg) setBlockSettingsSheetOpen(true);
            }}
          />
        );
      }
      if (child.type === "divider") {
        return (
          <div className="py-2">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-base-content/18 to-transparent" />
          </div>
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
            openBlockPlacement={openBlockPlacement}
            moveBlock={moveBlock}
            appendIntoContainer={appendIntoContainer}
          />
        );
      }
      return renderContainerInColumn(child);
    }

    function renderColContainerChildCard(child: StoryBlock) {
      const sel = storySelection?.mode === "section" && storySelection.block.id === child.id;
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
          frameLabel={blockCanvasHeaderLabel(child)}
          selected={sel}
          isLg={isLg}
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
          contentClassName={cn(child.type === "richText" && "pb-4 pt-5")}
        >
          {renderColContainerChildBody(child)}
        </StoryEditorBlockFrame>
      );
    }

    return (
      <StoryEditorBlockFrame
        block={nest}
        frameLabel={frameLabel}
        selected={nestSelected}
        isLg={isLg}
        visualQuietContainer
        onSelect={() => {
          setSelectedBlockId(nest.id);
          setInspectorTab("block");
        }}
        onAddAbove={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: nest.id,
            variant: placementVariant,
            allowNestedColumns,
            initialAddPosition: "above",
          })
        }
        onAddBelow={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: nest.id,
            variant: placementVariant,
            allowNestedColumns,
            initialAddPosition: "below",
          })
        }
        onAddInsideContainer={() =>
          openBlockPlacement({
            flow: "add",
            targetBlockId: nest.children?.[0]?.id ?? nest.id,
            variant: "container",
            allowNestedColumns,
          })
        }
        onDuplicate={() =>
          openBlockPlacement({
            flow: "duplicate",
            targetBlockId: nest.id,
            variant: placementVariant,
            allowNestedColumns,
          })
        }
        onDelete={() => removeBlock(sectionId, nest.id)}
        onOpenInspector={() => {
          setSelectedBlockId(nest.id);
          setInspectorTab("block");
          if (isLg) setInspectorOpen(true);
          else setBlockSettingsSheetOpen(true);
        }}
        onMove={(dir) => moveBlock(sectionId, nest.id, dir)}
      >
        {nest.children.length === 0 ? (
          <>
            <p className="text-center text-xs leading-relaxed text-base-content/55">
              This container is empty. Add a block.
            </p>
            <StoryColumnInsertAffordance
              mobile={!isLg}
              allowNestedColumns={allowNestedColumns}
              onInsert={(kind) => {
                const b = createColumnNestedBlock(kind);
                appendIntoContainer(sectionId, nest.id, b);
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
      </StoryEditorBlockFrame>
    );
  }

  function renderColumnNestedChrome(nested: StoryColumnNestedBlock) {
    const nestedSelected = storySelection?.mode === "column" && storySelection.block.id === nested.id;
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
        frameLabel={blockCanvasHeaderLabel(asBlock)}
        selected={nestedSelected}
        isLg={isLg}
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
        contentClassName={cn(nested.type === "richText" && "pb-4 pt-5")}
      >
        {nested.type === "richText" ? (
          <StoryTipTapEditor
            editorKey={`${sectionId}-${columnsBlock.id}-${nested.id}`}
            content={nested.doc}
            onChange={(json) => updateRichBlock(sectionId, nested.id, json)}
            toolbarDensity={isLg ? "default" : "touch"}
            surface="canvas"
          />
        ) : nested.type === "media" ? (
          <MediaEmbedCanvasCard
            compact
            block={nested}
            onConfigure={() => {
              setSelectedBlockId(nested.id);
              setInspectorTab("block");
              if (!isLg) setBlockSettingsSheetOpen(true);
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
            openBlockPlacement={openBlockPlacement}
            moveBlock={moveBlock}
            appendIntoContainer={appendIntoContainer}
          />
        ) : nested.type === "embed" ? (
          <EmbedCanvasCard
            block={nested}
            compact
            onConfigure={() => {
              setSelectedBlockId(nested.id);
              setInspectorTab("block");
              if (!isLg) setBlockSettingsSheetOpen(true);
            }}
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
              "flex min-w-0 flex-col overflow-visible rounded-xl border bg-base-200/20 transition-[border-color,box-shadow]",
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
                    onInsert={(kind) => insertColumnNested(sectionId, columnsBlock.id, colIdx, 0, kind)}
                  />
                  <p className="mt-2 px-1 text-center text-xs leading-relaxed text-base-content/45">
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
  | "openBlockPlacement"
  | "moveBlock"
  | "appendIntoContainer"
>;

function StoryEditorSectionBlockCard({
  sectionId,
  block,
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
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
}: StoryEditorSectionBlockCardProps) {
  const selected = storySelection?.mode === "section" && storySelection.block.id === block.id;
  const header = blockCanvasHeaderLabel(block);
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
        <div className="max-w-full overflow-x-auto">
          <StoryTipTapEditor
            editorKey={`${sectionId}-${block.id}`}
            content={block.doc}
            onChange={(json) => updateRichBlock(sectionId, block.id, json)}
            toolbarDensity={isLg ? "default" : "touch"}
            surface="canvas"
          />
        </div>
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
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
        />
      ) : block.type === "divider" ? (
        <div className="py-3">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-base-content/20 to-transparent" />
        </div>
      ) : block.type === "media" ? (
        <MediaEmbedCanvasCard
          block={block}
          onConfigure={() => {
            setSelectedBlockId(block.id);
            setInspectorTab("block");
            if (!isLg) setBlockSettingsSheetOpen(true);
          }}
        />
      ) : block.type === "embed" ? (
        <EmbedCanvasCard
          block={block}
          onConfigure={() => {
            setSelectedBlockId(block.id);
            setInspectorTab("block");
            if (!isLg) setBlockSettingsSheetOpen(true);
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
          insertColumnNested={insertColumnNested}
          removeBlock={removeBlock}
          setSelectedBlockId={setSelectedBlockId}
          setInspectorTab={setInspectorTab}
          setInspectorOpen={setInspectorOpen}
          setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
        />
      ) : null}
    </StoryEditorBlockFrame>
  );
}

type StorySaveStatus = "idle" | "saving" | "error";

export function StoryCreatorClient({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<StoryDocument | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [mobileShellTab, setMobileShellTab] = useState<StoryMobileShellTab>("add-block");
  const [addBlockSheetOpen, setAddBlockSheetOpen] = useState(false);
  const [blockSettingsSheetOpen, setBlockSettingsSheetOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<StoryInspectorTab>("block");
  const [isLeftPanelOpen, setLeftPanelOpen] = useState(true);
  const [leftPanelWidthPx, setLeftPanelWidthPx] = useState(STORY_LEFT_PANEL_DEFAULT);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [rightPanelWidthPx, setRightPanelWidthPx] = useState(STORY_RIGHT_PANEL_DEFAULT);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [outlineRename, setOutlineRename] = useState<OutlineRenameTarget | null>(null);
  const [persistedSnapshot, setPersistedSnapshot] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const docRef = useRef<StoryDocument | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLg = useMediaQueryMinLg();
  const isSm = useMediaQuery("(min-width: 640px)");

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setSaveStatus("idle");
    (async () => {
      try {
        const existing = await loadStoryDocument(storyId);
        if (cancelled) return;
        if (!existing) {
          setDoc(null);
          setPersistedSnapshot(null);
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
              "Chapters are now a flexible section tree; columns, media/embed, and legacy tables were upgraded (tables live in Text blocks now).",
          });
        }
        setDoc(loadedDoc);
        setPersistedSnapshot(JSON.stringify(loadedDoc));
        const roots = Array.isArray(loadedDoc.sections) ? loadedDoc.sections : [];
        const firstSec = firstSectionInOrder(roots);
        setActiveSectionId(firstSec?.id ?? null);
        setSelectedBlockId(firstSec?.blocks?.[0]?.id ?? null);
      } catch (err) {
        console.error("Story load / migration failed", err);
        if (cancelled) return;
        setDoc(null);
        setPersistedSnapshot(null);
        const msg =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not load story.";
        setLoadError(msg);
        toast.error("Story could not be loaded", { description: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, router]);

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
    if (mode !== "edit") setIsFullscreen(false);
  }, [mode]);

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

  const storyEditorDirty = useMemo(() => {
    if (!doc || persistedSnapshot == null) return false;
    return JSON.stringify(doc) !== persistedSnapshot;
  }, [doc, persistedSnapshot]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(async (next: StoryDocument) => {
    clearAutosaveTimer();
    setSaveStatus("saving");
    try {
      const saved = await saveStoryDocument(next);
      setDoc(saved);
      setPersistedSnapshot(JSON.stringify(saved));
      setSaveStatus("idle");
      return saved;
    } catch (e) {
      console.error("Story save failed", e);
      setSaveStatus("error");
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Save failed";
      toast.error("Save failed", { description: msg });
      throw e;
    }
  }, [clearAutosaveTimer]);

  docRef.current = doc;

  const storySelectionRepairRef = useRef<{ doc: StoryDocument | null; activeSectionId: string | null }>({
    doc: null,
    activeSectionId: null,
  });
  storySelectionRepairRef.current = { doc, activeSectionId };

  useEffect(() => {
    if (!doc || persistedSnapshot == null) return;
    if (!storyEditorDirty) return;
    clearAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      const cur = docRef.current;
      if (!cur) return;
      void flushSave(cur);
    }, 2500);
    return () => clearAutosaveTimer();
  }, [doc, storyEditorDirty, persistedSnapshot, clearAutosaveTimer, flushSave]);

  const updateDoc = useCallback((fn: (d: StoryDocument) => StoryDocument) => {
    setDoc((cur) => {
      if (!cur) return cur;
      const next = fn(cloneDoc(cur));
      return next;
    });
  }, []);

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
    (dateAnnotation: StoryBlockDateAnnotation | undefined) => {
      if (!activePair || !selectedBlockId) return;
      const sid = activePair.section.id;
      const bid = selectedBlockId;
      updateDoc((d) => mapDocSection(d, sid, (sec) => patchBlockDateAnnotationInSection(sec, bid, dateAnnotation)));
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

  const insertBlock = useCallback(
    (sectionId: string, index: number, kind: StoryInsertKind) => {
      const block = createStoryBlock(kind);
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => insertBlockAtIndex(sec, index, block)));
      setActiveSectionId(sectionId);
      setSelectedBlockId(block.id);
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
    (kind: StoryInsertKind) => {
      if (!activePair) {
        toast.error("Pick a section in the outline first.");
        return;
      }
      insertBlock(activePair.section.id, activePair.section.blocks.length, kind);
      setAddBlockSheetOpen(false);
    },
    [activePair, insertBlock],
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
      kind: StoryColumnNestedInsertKind,
    ) => {
      if (kind === "columns" && doc) {
        const pair = findSectionPath(doc.sections ?? [], sectionId);
        const depth = pair ? columnsBlockDepthInSection(pair.section, columnsBlockId) : null;
        if (depth != null && depth >= MAX_STORY_COLUMNS_NEST_DEPTH) {
          toast.error("Nested columns are limited to 2 levels.");
          return;
        }
      }
      const nested = createColumnNestedBlock(kind);
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

  const openBlockPlacement = useCallback((args: StoryBlockPlacementModalArgs) => {
    setBlockPlacementModal(args);
  }, []);

  const handlePlacementModalOpenChange = useCallback((open: boolean) => {
    if (!open) setBlockPlacementModal(null);
  }, []);

  const applyPlacementAdd = useCallback(
    (position: "above" | "below", kind: StoryInsertKind | StoryColumnNestedInsertKind) => {
      const ctx = blockPlacementModalRef.current;
      if (!activePair || !ctx) return;
      const block =
        ctx.variant === "column"
          ? createColumnNestedBlock(kind as StoryColumnNestedInsertKind)
          : createStoryBlock(kind as StoryInsertKind);
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
        isCompact={!isLg}
        mobileOverlay={mobileOverlay}
        onCloseMobileOverlay={mobileOverlay ? () => setMobileShellTab("add-block") : undefined}
        showCollapsedRail={Boolean(mobileOverlay)}
      />
    ) : null;

  const structurePanel = renderStructureSidebar(false);

  const lastSavedLabel = doc ? formatLastSaved(doc.updatedAt) : "";

  const saveRibbon =
    saveStatus === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-base-content/65">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    ) : saveStatus === "error" ? (
      <span className="flex flex-wrap items-center gap-2 text-xs text-destructive">
        Save failed — retry
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs font-medium" onClick={handleRetrySave}>
          Retry
        </Button>
      </span>
    ) : lastSavedLabel ? (
      <span className="text-xs text-base-content/50">Last saved {lastSavedLabel}</span>
    ) : null;

  const editorPanel =
    doc && activePair ? (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          isFullscreen ? "bg-base-300" : "bg-gradient-to-b from-base-300/20 to-base-300/40",
        )}
      >
        {isFullscreen ? (
          <div className="sticky top-0 z-20 shrink-0 border-b border-base-content/10 bg-base-300/95 px-3 py-2.5 shadow-sm backdrop-blur-md lg:px-4">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 shrink-0 gap-1.5 rounded-xl border-base-content/15 px-3 font-medium sm:h-9 sm:rounded-lg"
                title="Exit fullscreen (Esc)"
                aria-label="Exit fullscreen writing mode"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="size-4 shrink-0 opacity-90" aria-hidden />
                <span className="hidden sm:inline">Exit fullscreen</span>
              </Button>
              {!isLg ? (
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
              <div className="min-w-0 flex-1 basis-full sm:basis-[min(100%,14rem)] sm:flex-1">
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
              {isLg ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 rounded-lg border-base-content/12 px-3 font-medium"
                  title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                  aria-label={inspectorOpen ? "Hide inspector panel" : "Show inspector panel"}
                  onClick={() => setInspectorOpen((o) => !o)}
                >
                  {inspectorOpen ? (
                    <PanelRightClose className="size-4 opacity-90" aria-hidden />
                  ) : (
                    <PanelRight className="size-4 opacity-90" aria-hidden />
                  )}
                  <span className="hidden md:inline">{inspectorOpen ? "Hide panel" : "Inspector"}</span>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-b border-base-content/10 bg-base-100/50 px-4 py-3 backdrop-blur-sm lg:px-8 lg:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Section</p>
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
                    <p className="truncate text-xs text-base-content/50">
                      {activePair.breadcrumb.map((b) => b.title).join(" · ")}
                    </p>
                  ) : null}
                  <p className="truncate font-heading text-lg font-semibold leading-snug tracking-tight text-base-content">
                    {activePair.section.title}
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-11 w-11 shrink-0 rounded-xl p-0 text-base-content/55 hover:bg-base-content/[0.08] lg:h-9 lg:w-9 lg:rounded-lg",
                  )}
                  aria-label="Rename section"
                  onClick={() => setOutlineRename({ kind: "section", id: activePair.section.id })}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}
        <StoryGlobalTipTapToolbar
          toolbarDensity={isLg ? "default" : "touch"}
          className={cn(isFullscreen && "px-2 pb-2 pt-1 lg:px-4")}
          frameClassName={isFullscreen ? "rounded-lg border-base-content/10 bg-base-200/70" : undefined}
        />
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 pt-5 lg:px-10 lg:pt-8",
            isFullscreen && "px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-8 lg:px-12 lg:pb-14 lg:pt-10",
            !isFullscreen && mode === "edit" ? "pb-24 lg:pb-20" : !isFullscreen ? "pb-8 lg:pb-8" : "pb-8",
          )}
        >
          <div
            className={cn(
              "w-full min-w-0 space-y-4 pb-2 lg:space-y-2",
              isFullscreen && "mx-auto max-w-[min(1100px,100%)]",
            )}
          >
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
                | "openBlockPlacement"
                | "moveBlock"
                | "appendIntoContainer"
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
                openBlockPlacement,
                moveBlock,
                appendIntoContainer,
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
        onTitleChange={setTitle}
        onExcerptChange={setExcerpt}
        onStoryMetaChange={patchStoryMeta}
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
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100",
          isFullscreen &&
            mode === "edit" &&
            "fixed inset-0 z-[100] h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] overflow-hidden bg-base-300",
        )}
      >
      {!isFullscreen ? (
      <header className="flex shrink-0 flex-col gap-2 border-b border-base-content/10 bg-base-100/95 px-3 py-3 backdrop-blur-md lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-2 lg:px-5 lg:py-3.5">
        {!isLg ? (
          <>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/stories"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-11 shrink-0 gap-1 rounded-xl px-2.5 text-sm font-medium text-base-content/80 hover:bg-base-content/[0.08] hover:text-base-content",
                )}
              >
                ← Stories
              </Link>
              <input
                className="input input-ghost input-sm h-11 min-h-[44px] min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-center text-sm font-semibold text-base-content hover:border-base-content/10 focus:border-primary/30"
                value={doc.title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Story title"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-11 w-11 shrink-0 rounded-xl border-base-content/12 p-0",
                  )}
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-5 opacity-90" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem className="min-h-10 py-2.5 font-medium" onClick={handleSaveDraft}>
                    <Save className="size-3.5 opacity-80" aria-hidden />
                    Save draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-10 py-2.5 font-medium"
                    onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                  >
                    <Eye className="size-3.5 opacity-80" aria-hidden />
                    {mode === "edit" ? "Preview" : "Back to edit"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {mode === "edit" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 w-11 shrink-0 rounded-xl border-base-content/12 p-0"
                  title="Fullscreen writing (Esc to exit)"
                  aria-label="Enter fullscreen writing mode"
                  onClick={() => {
                    setMobileShellTab("add-block");
                    setIsFullscreen(true);
                  }}
                >
                  <Expand className="size-5 opacity-90" aria-hidden />
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-11 shrink-0 gap-1.5 rounded-xl px-4 font-semibold shadow-sm"
                onClick={handlePublish}
              >
                <Send className="size-3.5 opacity-90" />
                Publish
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-base-content/55">
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
              {saveRibbon}
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 lg:gap-x-4">
              <Link
                href="/admin/stories"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-9 shrink-0 gap-1 rounded-lg px-2.5 text-sm font-medium text-base-content/80 hover:bg-base-content/[0.08] hover:text-base-content",
                )}
              >
                ← Stories
              </Link>
              <input
                className="input input-ghost input-sm h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-semibold text-base-content hover:border-base-content/10 focus:border-primary/30 lg:max-w-xl"
                value={doc.title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Story title"
              />
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
                {saveRibbon}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end lg:gap-3">
              <div className="flex rounded-xl border border-base-content/10 bg-base-200/50 p-1 shadow-inner">
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors",
                    mode === "edit"
                      ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
                      : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
                  )}
                  onClick={() => setMode("edit")}
                >
                  <Pencil className="size-3.5 opacity-80" />
                  Edit
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors",
                    mode === "preview"
                      ? "bg-base-100 text-base-content shadow-sm ring-1 ring-base-content/[0.06]"
                      : "text-base-content/55 hover:bg-base-content/[0.06] hover:text-base-content",
                  )}
                  onClick={() => setMode("preview")}
                >
                  <Eye className="size-3.5 opacity-80" />
                  Preview
                </button>
              </div>
              {mode === "edit" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg border-base-content/12 px-3 font-medium"
                  title="Fullscreen writing (Esc to exit)"
                  aria-label="Enter fullscreen writing mode"
                  onClick={() => {
                    setMobileShellTab("add-block");
                    setIsFullscreen(true);
                  }}
                >
                  <Expand className="size-4 opacity-90" aria-hidden />
                  <span className="hidden lg:inline">Fullscreen</span>
                </Button>
              ) : null}
              {mode === "edit" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg border-base-content/12 px-3 font-medium"
                  title={inspectorOpen ? "Hide inspector" : "Show inspector"}
                  onClick={() => setInspectorOpen((o) => !o)}
                >
                  {inspectorOpen ? (
                    <PanelRightClose className="size-4 opacity-90" />
                  ) : (
                    <PanelRight className="size-4 opacity-90" />
                  )}
                  <span className="hidden sm:inline">{inspectorOpen ? "Hide panel" : "Inspector"}</span>
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-base-content/10 sm:border-l sm:pl-3 lg:pl-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg border-base-content/12 px-3.5 font-medium"
                  onClick={handleSaveDraft}
                >
                  <Save className="size-3.5 opacity-90" />
                  Save draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg px-3.5 font-semibold shadow-sm"
                  onClick={handlePublish}
                >
                  <Send className="size-3.5 opacity-90" />
                  Publish
                </Button>
              </div>
            </div>
          </>
        )}
      </header>
      ) : null}

      {isLg ? (
        mode === "preview" ? (
          <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
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
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-base-300/30",
                isFullscreen && "min-h-0 min-w-0 flex-1",
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
            <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
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
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 p-4 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("richText")}
            >
              <Type className="size-7 text-primary opacity-90" strokeWidth={2} aria-hidden />
              <span className="text-sm font-semibold text-base-content">Text</span>
            </button>
            <button
              type="button"
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 p-4 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("media")}
            >
              <ImageIcon className="size-7 text-primary opacity-90" aria-hidden />
              <span className="text-sm font-semibold text-base-content">Media</span>
            </button>
            <button
              type="button"
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 p-4 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("embed")}
            >
              <Layers className="size-7 text-primary opacity-90" aria-hidden />
              <span className="text-sm font-semibold text-base-content">Embed</span>
            </button>
            <button
              type="button"
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 p-4 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("columns")}
            >
              <Columns2 className="size-7 text-primary opacity-90" aria-hidden />
              <span className="text-sm font-semibold text-base-content">Columns</span>
            </button>
            <button
              type="button"
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 p-4 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("container")}
            >
              <LayoutTemplate className="size-7 text-primary opacity-90" aria-hidden />
              <span className="text-sm font-semibold text-base-content">Container</span>
            </button>
            <button
              type="button"
              className="col-span-2 flex min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl border border-base-content/12 bg-base-100/75 px-4 py-3 text-center shadow-sm transition-[transform,box-shadow] active:scale-[0.98]"
              onClick={() => insertBlockFromDockPicker("divider")}
            >
              <Minus className="size-6 text-primary opacity-90" aria-hidden />
              <span className="text-sm font-semibold text-base-content">Divider</span>
            </button>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-base-content/45">
            Tables: add a Text block, then use the global formatting toolbar (More → table).
          </p>
        </StoryAddBlockBottomSheet>
      ) : null}
      {mode === "edit" && !isFullscreen ? (
        <StoryEditorBottomDock
          active={isLg ? null : mobileShellTab}
          emphasizeAddBlockFab={isLg}
          onNavigate={handleDockNavigate}
        />
      ) : null}
      <StoryBlockPlacementDialog
        open={blockPlacementModal !== null}
        onOpenChange={handlePlacementModalOpenChange}
        flow={blockPlacementModal?.flow ?? null}
        variant={blockPlacementModal?.variant ?? "section"}
        allowNestedColumns={blockPlacementModal?.allowNestedColumns ?? true}
        initialAddPosition={blockPlacementModal?.initialAddPosition ?? null}
        onAddComplete={applyPlacementAdd}
        onDuplicateComplete={applyPlacementDuplicate}
      />
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
  insertColumnNested: (
    sectionId: string,
    columnsBlockId: string,
    columnIndex: 0 | 1,
    atIndex: number,
    kind: StoryColumnNestedInsertKind,
  ) => void;
  removeBlock: (sectionId: string, blockId: string) => void;
  setSelectedBlockId: (id: string | null) => void;
  setInspectorTab: (t: StoryInspectorTab) => void;
  setInspectorOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setBlockSettingsSheetOpen: (open: boolean) => void;
  openBlockPlacement: (args: StoryBlockPlacementModalArgs) => void;
  moveBlock: (sectionId: string, blockId: string, direction: -1 | 1) => void;
  appendIntoContainer: (sectionId: string, containerId: string, block: StoryBlock) => void;
};

/** Recursive section-level container body (nested containers inside a section container). */
function StorySectionContainerInner({
  nest,
  sectionId,
  isLg,
  isSm,
  storySelection,
  updateRichBlock,
  insertColumnNested,
  removeBlock,
  setSelectedBlockId,
  setInspectorTab,
  setInspectorOpen,
  setBlockSettingsSheetOpen,
  openBlockPlacement,
  moveBlock,
  appendIntoContainer,
}: StorySectionContainerInnerProps) {
  function renderContainerChildBody(child: StoryBlock) {
    if (child.type === "richText") {
      return (
        <StoryTipTapEditor
          editorKey={`${sectionId}-${nest.id}-${child.id}`}
          content={child.doc}
          onChange={(json) => updateRichBlock(sectionId, child.id, json)}
          toolbarDensity={isLg ? "default" : "touch"}
          surface="canvas"
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
            if (!isLg) setBlockSettingsSheetOpen(true);
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
            if (!isLg) setBlockSettingsSheetOpen(true);
          }}
        />
      );
    }
    if (child.type === "divider") {
      return (
        <div className="py-2">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-base-content/20 to-transparent" />
        </div>
      );
    }
    if (child.type === "columns") {
      return (
        <StoryNestedColumnsGrid
          sectionId={sectionId}
          columnsBlock={child}
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
          openBlockPlacement={openBlockPlacement}
          moveBlock={moveBlock}
          appendIntoContainer={appendIntoContainer}
        />
      );
    }
    return (
      <StorySectionContainerInner
        nest={child}
        sectionId={sectionId}
        isLg={isLg}
        isSm={isSm}
        storySelection={storySelection}
        updateRichBlock={updateRichBlock}
        insertColumnNested={insertColumnNested}
        removeBlock={removeBlock}
        setSelectedBlockId={setSelectedBlockId}
        setInspectorTab={setInspectorTab}
        setInspectorOpen={setInspectorOpen}
        setBlockSettingsSheetOpen={setBlockSettingsSheetOpen}
        openBlockPlacement={openBlockPlacement}
        moveBlock={moveBlock}
        appendIntoContainer={appendIntoContainer}
      />
    );
  }

  function renderContainerChildCard(child: StoryBlock) {
    const sel = storySelection?.mode === "section" && storySelection.block.id === child.id;
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
        frameLabel={blockCanvasHeaderLabel(child)}
        selected={sel}
        isLg={isLg}
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
        contentClassName={cn(child.type === "richText" && "pb-4 pt-5")}
      >
        {renderContainerChildBody(child)}
      </StoryEditorBlockFrame>
    );
  }

  return nest.children.length === 0 ? (
    <>
      <p className="text-center text-sm leading-relaxed text-base-content/55">This container is empty. Add a block.</p>
      <div className={cn("flex justify-center", !isLg ? "py-3" : "py-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2 border-base-content/15 font-medium text-base-content/80 shadow-sm",
              !isLg ? "min-h-11 rounded-xl px-4 text-sm" : "rounded-lg",
            )}
            aria-label="Add block"
          >
            Add block
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[11rem]">
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("richText"))}
            >
              <Type className="size-3.5 opacity-80" aria-hidden />
              Text
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("media"))}
            >
              <ImageIcon className="size-3.5 opacity-80" aria-hidden />
              Media
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("embed"))}
            >
              <Layers className="size-3.5 opacity-80" aria-hidden />
              Embed
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("columns"))}
            >
              <Columns2 className="size-3.5 opacity-80" aria-hidden />
              Columns
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("container"))}
            >
              <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
              Container
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 font-medium"
              onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("divider"))}
            >
              <Minus className="size-3.5 opacity-80" aria-hidden />
              Divider
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  );
}

function MediaEmbedCanvasCard({
  block,
  onConfigure,
  compact,
}: {
  block: StoryMediaBlock;
  onConfigure: () => void;
  /** Narrow column: use a slim placeholder when no file is picked yet. */
  compact?: boolean;
}) {
  return <MediaBlockContentRenderer block={block} variant="editor" compact={compact} onConfigure={onConfigure} />;
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
