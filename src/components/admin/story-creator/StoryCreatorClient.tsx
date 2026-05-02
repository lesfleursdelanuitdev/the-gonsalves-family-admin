"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Columns2,
  Copy,
  LayoutTemplate,
  Eye,
  ImageIcon,
  GripVertical,
  Layers,
  Minus,
  MoreHorizontal,
  Pencil,
  PanelRight,
  PanelRightClose,
  Plus,
  Loader2,
  Save,
  Send,
  Trash2,
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
import { StoryTipTapEditor } from "@/components/admin/story-creator/StoryTipTapEditor";
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
import { ApiError } from "@/lib/infra/api";
import { columnsBlockDepthInSection, MAX_STORY_COLUMNS_NEST_DEPTH } from "@/lib/admin/story-creator/story-columns-depth";
import {
  resolveColumnGapRem,
  storyColumnStackStyle,
  storyColumnsGridStyle,
} from "@/lib/admin/story-creator/story-columns-layout";
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

function sectionBlockSubtreeContainsSelection(block: StoryBlock, sel: StorySelection | null): boolean {
  if (!sel || sel.mode !== "section") return false;
  if (sel.block.id === block.id) return true;
  if (block.type === "container") {
    return block.children.some((c: StoryBlock) => sectionBlockSubtreeContainsSelection(c, sel));
  }
  if (block.type === "columns") {
    for (const slot of block.columns) {
      for (const nb of slot.blocks) {
        if (columnNestedSubtreeContainsSectionSelection(nb, sel)) return true;
      }
    }
  }
  return false;
}

function columnNestedSubtreeContainsSectionSelection(nb: StoryColumnNestedBlock, sel: StorySelection): boolean {
  if (sel.mode !== "section") return false;
  if (nb.id === sel.block.id) return true;
  if (nb.type === "container") {
    return nb.children.some((c: StoryBlock) => sectionBlockSubtreeContainsSelection(c, sel));
  }
  if (nb.type === "columns") {
    for (const slot of nb.columns) {
      for (const inner of slot.blocks) {
        if (columnNestedSubtreeContainsSectionSelection(inner, sel)) return true;
      }
    }
  }
  return false;
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
    return (
      <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
          {nest.props.label?.trim() || "Container"}
        </p>
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
              function renderColContainerChildBody(child: StoryBlock) {
                if (child.type === "richText") {
                  return (
                    <StoryTipTapEditor
                      editorKey={`${sectionId}-${nest.id}-${child.id}`}
                      content={child.doc}
                      onChange={(json) => updateRichBlock(sectionId, child.id, json)}
                      placeholder="Start writing…"
                      toolbarDensity={isLg ? "default" : "touch"}
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
                      appendIntoContainer={appendIntoContainer}
                    />
                  );
                }
                return renderContainerInColumn(child);
              }
              function renderColContainerChildCard(child: StoryBlock) {
                const sel = storySelection?.mode === "section" && storySelection.block.id === child.id;
                return (
                  <div
                    className={cn(
                      "rounded-lg border bg-base-100/50 p-2 sm:p-2.5",
                      sel ? "border-primary/35 ring-1 ring-primary/12" : "border-base-content/[0.07]",
                    )}
                    onPointerDownCapture={() => {
                      setSelectedBlockId(child.id);
                      setInspectorTab("block");
                    }}
                  >
                    {renderColContainerChildBody(child)}
                  </div>
                );
              }
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
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-1 w-full justify-center gap-2 rounded-lg border-dashed border-primary/30 text-xs font-medium text-primary/90",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="size-3.5 opacity-80" aria-hidden />
                Add block inside container
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[10rem]">
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
                  onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("divider"))}
                >
                  <Minus className="size-3.5 opacity-80" aria-hidden />
                  Divider
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 font-medium"
                  onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("container"))}
                >
                  <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
                  Container
                </DropdownMenuItem>
                {allowNestedColumns ? (
                  <DropdownMenuItem
                    className="gap-2 font-medium"
                    onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("columns"))}
                  >
                    <Columns2 className="size-3.5 opacity-80" aria-hidden />
                    Columns
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }

  function renderColumnNestedChrome(nested: StoryColumnNestedBlock) {
    const nestedSelected = storySelection?.mode === "column" && storySelection.block.id === nested.id;
    return (
      <div
        className={cn(
          "overflow-visible rounded-xl border bg-base-100/25 transition-[border-color,box-shadow]",
          nestedSelected
            ? "border-primary/45 ring-1 ring-primary/16"
            : depth >= 2
              ? "border-base-content/[0.05]"
              : "border-base-content/[0.06]",
        )}
      >
        <div className="flex min-h-9 shrink-0 items-center justify-end gap-2 border-b border-base-content/10 bg-base-200/20 px-2 py-1 lg:min-h-8">
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-9 w-9 shrink-0 rounded-lg p-0 text-base-content/50 hover:bg-base-content/[0.08] lg:h-8 lg:w-8",
              )}
              aria-label="Block menu"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[200] min-w-[10rem]">
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(nested.id);
                  setInspectorTab("block");
                  if (isLg) {
                    setInspectorOpen(true);
                  } else {
                    setBlockSettingsSheetOpen(true);
                  }
                }}
              >
                <PanelRight className="size-3.5 opacity-80" aria-hidden />
                Open inspector
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  openBlockPlacement({
                    flow: "add",
                    targetBlockId: nested.id,
                    variant: "column",
                    allowNestedColumns,
                  });
                }}
              >
                <Plus className="size-3.5 opacity-80" aria-hidden />
                Add block
              </DropdownMenuItem>
              {nested.type === "container" ? (
                <DropdownMenuItem
                  className="gap-2 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBlockPlacement({
                      flow: "add",
                      targetBlockId: nested.children?.[0]?.id ?? nested.id,
                      variant: "container",
                      allowNestedColumns,
                    });
                  }}
                >
                  <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
                  Add block inside container
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  openBlockPlacement({
                    flow: "duplicate",
                    targetBlockId: nested.id,
                    variant: "column",
                    allowNestedColumns,
                  });
                }}
              >
                <Copy className="size-3.5 opacity-80" aria-hidden />
                Duplicate block
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 font-medium text-error focus:text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlock(sectionId, nested.id);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div
          className={cn("p-2 sm:p-3", nested.type === "richText" && "pb-2 pt-1")}
          onPointerDownCapture={() => {
            setSelectedBlockId(nested.id);
            setInspectorTab("block");
          }}
        >
          {nested.type === "richText" ? (
            <StoryTipTapEditor
              editorKey={`${sectionId}-${columnsBlock.id}-${nested.id}`}
              content={nested.doc}
              onChange={(json) => updateRichBlock(sectionId, nested.id, json)}
              placeholder="Start writing your story…"
              toolbarDensity={isLg ? "default" : "touch"}
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
        </div>
      </div>
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
                <StoryColumnInsertAffordance
                  mobile={!isLg}
                  allowNestedColumns={allowNestedColumns}
                  onInsert={(kind) => insertColumnNested(sectionId, columnsBlock.id, colIdx, 0, kind)}
                />
              ) : (
                <>
                  {groupColumnNestedBlocksForLayout(slot.blocks).map((grp) => (
                    <Fragment key={grp.kind === "single" ? grp.block.id : `${grp.float.id}-${grp.text.id}`}>
                      <StoryColumnInsertAffordance
                        mobile={!isLg}
                        allowNestedColumns={allowNestedColumns}
                        onInsert={(kind) => insertColumnNested(sectionId, columnsBlock.id, colIdx, grp.startIndex, kind)}
                      />
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
                  <StoryColumnInsertAffordance
                    mobile={!isLg}
                    allowNestedColumns={allowNestedColumns}
                    onInsert={(kind) => insertColumnNested(sectionId, columnsBlock.id, colIdx, slot.blocks.length, kind)}
                  />
                </>
              )}
              {slot.blocks.length === 0 ? (
                <p className="mt-1 text-center text-xs leading-relaxed text-base-content/45">
                  Use + to add text, media, embed, or columns. Add more + rows to stack blocks.
                </p>
              ) : null}
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
  appendIntoContainer,
}: StoryEditorSectionBlockCardProps) {
  const columnsInnerSelected =
    storySelection?.mode === "column" && storySelection.columnsBlock.id === block.id;
  const topSelected = storySelection?.mode === "section" && storySelection.block.id === block.id;
  const subtreeSelected =
    storySelection?.mode === "section" && sectionBlockSubtreeContainsSelection(block, storySelection);
  const blockSelected =
    topSelected || subtreeSelected || (block.type === "columns" && columnsInnerSelected);
  const header = blockCanvasHeaderLabel(block);
  return (
    <div
      onClick={() => {
        setSelectedBlockId(block.id);
        setInspectorTab("block");
      }}
      className={cn(
        "cursor-pointer rounded-2xl border bg-base-100/90 shadow-sm outline-none transition-[box-shadow,border-color,ring]",
        blockSelected
          ? "border-primary/45 shadow-md ring-1 ring-primary/22"
          : "border-base-content/[0.09] hover:border-base-content/15 hover:shadow-md",
      )}
    >
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-base-content/10 bg-base-200/25 px-3 py-2 lg:h-12 lg:gap-3 lg:px-4 lg:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GripVertical className="size-4 shrink-0 text-base-content/25 lg:hidden" aria-hidden strokeWidth={2} />
          <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
            {header}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {isLg ? (
            blockSelected ? (
              <span className="hidden whitespace-nowrap pr-1 text-[11px] font-medium text-primary sm:inline">
                Inspector
              </span>
            ) : (
              <span className="hidden whitespace-nowrap pr-1 text-[11px] text-base-content/45 sm:inline">Select</span>
            )
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-11 w-11 shrink-0 rounded-xl p-0 text-base-content/50 hover:bg-base-content/[0.08] lg:h-8 lg:w-8 lg:rounded-lg",
              )}
              aria-label="Block menu"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlockId(block.id);
                  setInspectorTab("block");
                  if (isLg) {
                    setInspectorOpen(true);
                  } else {
                    setBlockSettingsSheetOpen(true);
                  }
                }}
              >
                <PanelRight className="size-3.5 opacity-80" aria-hidden />
                Open inspector
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  openBlockPlacement({
                    flow: "add",
                    targetBlockId: block.id,
                    variant: "section",
                    allowNestedColumns: true,
                  });
                }}
              >
                <Plus className="size-3.5 opacity-80" aria-hidden />
                Add block
              </DropdownMenuItem>
              {block.type === "container" ? (
                <DropdownMenuItem
                  className="gap-2 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBlockPlacement({
                      flow: "add",
                      targetBlockId: block.children?.[0]?.id ?? block.id,
                      variant: "container",
                      allowNestedColumns: true,
                    });
                  }}
                >
                  <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
                  Add block inside container
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  openBlockPlacement({
                    flow: "duplicate",
                    targetBlockId: block.id,
                    variant: "section",
                    allowNestedColumns: true,
                  });
                }}
              >
                <Copy className="size-3.5 opacity-80" aria-hidden />
                Duplicate block
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 font-medium text-error focus:text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlock(sectionId, block.id);
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={cn("p-4 lg:p-4", block.type === "richText" && "pb-3 pt-1")}>
        {block.type === "richText" ? (
          <div
            className="max-w-full overflow-x-auto"
            onPointerDownCapture={() => {
              setSelectedBlockId(block.id);
              setInspectorTab("block");
            }}
          >
            <StoryTipTapEditor
              editorKey={`${sectionId}-${block.id}`}
              content={block.doc}
              onChange={(json) => updateRichBlock(sectionId, block.id, json)}
              placeholder="Start writing your story…"
              toolbarDensity={isLg ? "default" : "touch"}
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
            appendIntoContainer={appendIntoContainer}
          />
        ) : block.type === "divider" ? (
          <div className="py-3">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-base-content/20 to-transparent" />
          </div>
        ) : block.type === "media" ? (
          <div
            onPointerDownCapture={() => {
              setSelectedBlockId(block.id);
              setInspectorTab("block");
            }}
          >
            <MediaEmbedCanvasCard
              block={block}
              onConfigure={() => {
                setSelectedBlockId(block.id);
                setInspectorTab("block");
                if (!isLg) setBlockSettingsSheetOpen(true);
              }}
            />
          </div>
        ) : block.type === "embed" ? (
          <div
            onPointerDownCapture={() => {
              setSelectedBlockId(block.id);
              setInspectorTab("block");
            }}
          >
            <EmbedCanvasCard
              block={block}
              onConfigure={() => {
                setSelectedBlockId(block.id);
                setInspectorTab("block");
                if (!isLg) setBlockSettingsSheetOpen(true);
              }}
            />
          </div>
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
            appendIntoContainer={appendIntoContainer}
          />
        ) : null}
      </div>
    </div>
  );
}

function BlockInsertAffordance({ onInsert, mobile }: { onInsert: (kind: StoryInsertKind) => void; mobile?: boolean }) {
  return (
    <div className={cn("group relative flex items-center justify-center", mobile ? "py-3" : "h-7 py-0.5")}>
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-base-content/[0.12] opacity-80 transition-opacity group-hover:opacity-100" />
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full border border-base-content/12 bg-base-100/95 text-primary shadow-md transition-[opacity,transform,box-shadow]",
            mobile
              ? "size-11 min-h-[44px] min-w-[44px] opacity-100 hover:scale-[1.02] active:scale-[0.98]"
              : "size-8 opacity-35 hover:scale-105 hover:opacity-100 group-hover:opacity-80",
          )}
          aria-label="Insert block here"
        >
          <Plus className={cn(mobile ? "size-5" : "size-4")} strokeWidth={2.25} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[11rem]">
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("richText")}>
            Text
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("media")}>
            <ImageIcon className="size-3.5 opacity-80" aria-hidden />
            Media
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("embed")}>
            <Layers className="size-3.5 opacity-80" aria-hidden />
            Embed
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("columns")}>
            <Columns2 className="size-3.5 opacity-80" aria-hidden />
            Columns
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("container")}>
            <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
            Container
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("divider")}>
            <Minus className="size-3.5 opacity-80" aria-hidden />
            Divider
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [outlineRename, setOutlineRename] = useState<OutlineRenameTarget | null>(null);
  const [persistedSnapshot, setPersistedSnapshot] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>("idle");
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

  const activePair = useMemo(() => {
    if (!doc || !activeSectionId) return null;
    return findSectionPath(doc.sections ?? [], activeSectionId);
  }, [doc, activeSectionId]);

  const storySelection = useMemo(() => {
    if (!activePair || !selectedBlockId) return null;
    return resolveStorySelection(activePair.section, selectedBlockId);
  }, [activePair, selectedBlockId]);

  const selectedBlock = storySelection?.block ?? null;

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
      updateDoc((d) => ({ ...d, title }));
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
      setActiveSectionId(sectionId);
      setSelectedBlockId(firstBlockId);
      setInspectorTab("block");
      if (!isLg) {
        setMobileShellTab("add-block");
        setBlockSettingsSheetOpen(false);
        setAddBlockSheetOpen(false);
      }
    },
    [isLg],
  );

  const insertBlock = useCallback(
    (sectionId: string, index: number, kind: StoryInsertKind) => {
      const block = createStoryBlock(kind);
      updateDoc((d) => mapDocSection(d, sectionId, (sec) => insertBlockAtIndex(sec, index, block)));
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

  const deleteSelectedBlock = useCallback(() => {
    if (!activePair || !selectedBlockId) return;
    removeBlock(activePair.section.id, selectedBlockId);
    setBlockSettingsSheetOpen(false);
  }, [activePair, selectedBlockId, removeBlock]);

  const handleDockNavigate = useCallback(
    (tab: StoryMobileShellTab) => {
      if (isLg) {
        if (tab === "structure") {
          setOutlineOpen(true);
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
        outlineOpen={mobileOverlay ? true : outlineOpen}
        onOutlineOpenChange={mobileOverlay ? () => {} : setOutlineOpen}
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-base-300/20 to-base-300/35">
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
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 pt-5 lg:px-10 lg:pt-8",
            mode === "edit" ? "pb-24 lg:pb-20" : "pb-8 lg:pb-8",
          )}
        >
          <div className="w-full min-w-0 space-y-4 pb-2 lg:space-y-2">
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
                appendIntoContainer,
              };
              if (group.kind === "float-wrap") {
                return (
                  <Fragment key={`${group.float.id}-${group.text.id}`}>
                    <BlockInsertAffordance
                      mobile={!isLg}
                      onInsert={(kind) => insertBlock(sectionId, group.startIndex, kind)}
                    />
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
                  <BlockInsertAffordance
                    mobile={!isLg}
                    onInsert={(kind) => insertBlock(sectionId, group.startIndex, kind)}
                  />
                  <StoryBlockRowDesignWrap block={block} floated={false}>
                    <StoryEditorSectionBlockCard sectionId={sectionId} block={block} {...shared} />
                  </StoryBlockRowDesignWrap>
                </Fragment>
              );
            })}
            <BlockInsertAffordance
              mobile={!isLg}
              onInsert={(kind) => insertBlock(activePair.section.id, activePair.section.blocks.length, kind)}
            />
            <div className="mt-5 rounded-2xl border border-dashed border-base-content/18 bg-base-200/25 px-4 py-6 shadow-inner lg:mt-4">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-base-content/50">Add block</p>
              <p className="mt-2 w-full text-center text-[13px] leading-snug text-base-content/45">
                {isLg ? (
                  <>
                    Click the + buttons above to insert a block between existing content. Tables belong in a Text block
                    (Insert table in the editor toolbar).
                  </>
                ) : (
                  <>
                    Use the + between blocks or pick a type below. Tables live inside a Text block (toolbar → More →
                    table).
                  </>
                )}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "richText")}
                >
                  Text
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 gap-1.5 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "media")}
                >
                  <ImageIcon className="size-3.5 opacity-80" />
                  Media
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 gap-1.5 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "embed")}
                >
                  <Layers className="size-3.5 opacity-80" />
                  Embed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 gap-1.5 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "columns")}
                >
                  <Columns2 className="size-3.5 opacity-80" />
                  Columns
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 gap-1.5 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "container")}
                >
                  <LayoutTemplate className="size-3.5 opacity-80" />
                  Container
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 h-11 gap-1.5 rounded-xl border-base-content/12 px-3 text-sm font-medium sm:h-9 sm:min-h-0 sm:min-w-[5.5rem] sm:rounded-lg"
                  onClick={() => insertBlock(activePair.section.id, activePair.section.blocks.length, "divider")}
                >
                  <Minus className="size-3.5 opacity-80" />
                  Divider
                </Button>
              </div>
            </div>
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
        className={cn(!isLg && "w-full min-h-0 flex-1 border-l-0 border-t")}
      />
    ) : null;

  return (
    <StoryTipTapStoryDocProvider doc={doc}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100">
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

      {isLg ? (
        mode === "preview" ? (
          <StoryCreatorPreview doc={doc} activeSectionId={activeSectionId} onPickSection={setActiveSectionId} />
        ) : (
          <div className="flex min-h-0 flex-1 pb-16">
            {structurePanel}
            {editorPanel}
            {inspectorOpen ? inspectorEl : null}
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
            Tables: add a Text block, then use the editor toolbar (More → table).
          </p>
        </StoryAddBlockBottomSheet>
      ) : null}
      {mode === "edit" ? (
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
        onAddComplete={applyPlacementAdd}
        onDuplicateComplete={applyPlacementDuplicate}
      />
      </div>
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
  appendIntoContainer,
}: StorySectionContainerInnerProps) {
  function renderContainerChildBody(child: StoryBlock) {
    if (child.type === "richText") {
      return (
        <StoryTipTapEditor
          editorKey={`${sectionId}-${nest.id}-${child.id}`}
          content={child.doc}
          onChange={(json) => updateRichBlock(sectionId, child.id, json)}
          placeholder="Start writing…"
          toolbarDensity={isLg ? "default" : "touch"}
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
        appendIntoContainer={appendIntoContainer}
      />
    );
  }

  function renderContainerChildCard(child: StoryBlock) {
    const sel = storySelection?.mode === "section" && storySelection.block.id === child.id;
    return (
      <div
        className={cn(
          "rounded-xl border bg-base-100/60 p-3 shadow-sm",
          sel ? "border-primary/40 ring-1 ring-primary/14" : "border-base-content/[0.08]",
        )}
        onPointerDownCapture={() => {
          setSelectedBlockId(child.id);
          setInspectorTab("block");
        }}
      >
        {renderContainerChildBody(child)}
      </div>
    );
  }

  return (
    <div
      className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4"
      onPointerDownCapture={() => {
        setSelectedBlockId(nest.id);
        setInspectorTab("block");
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
        {nest.props.label?.trim() || "Container"}
      </p>
      {nest.children.length === 0 ? (
        <>
          <p className="text-center text-sm leading-relaxed text-base-content/55">This container is empty. Add a block.</p>
          <BlockInsertAffordance
            mobile={!isLg}
            onInsert={(kind) => {
              const b = createStoryBlock(kind);
              appendIntoContainer(sectionId, nest.id, b);
            }}
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
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full justify-center gap-2 border-dashed border-primary/30 text-sm font-medium text-primary/90",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="size-3.5 opacity-80" aria-hidden />
              Add block inside container
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
                onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("divider"))}
              >
                <Minus className="size-3.5 opacity-80" aria-hidden />
                Divider
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("container"))}
              >
                <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
                Container
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 font-medium"
                onClick={() => appendIntoContainer(sectionId, nest.id, createStoryBlock("columns"))}
              >
                <Columns2 className="size-3.5 opacity-80" aria-hidden />
                Columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
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
