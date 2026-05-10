"use client";

import { Info, Trash2 } from "lucide-react";
import type {
  StoryBlock,
  StoryBlockDateAnnotation,
  StoryBlockDesign,
  StoryBlockPlaceAnnotation,
  StoryBlockRowLayout,
  StoryColumnSlot,
  StoryColumnsBlock,
  StoryContainerBlockProps,
  StoryEmbedBlock,
  StoryMediaBlock,
  StorySection,
} from "@/lib/admin/story-creator/story-types";
import type { StoryDividerMetaPatch, StoryRichTextMetaPatch } from "@/lib/admin/story-creator/story-doc-mutators";
import { effectiveRowLayoutForRichText } from "@/lib/admin/story-creator/story-block-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import {
  BlockDateAnnotationInspector,
  ColumnsLayoutInspector,
  ContainerLayoutInspector,
  DividerBlockInspector,
  FieldLabel,
  HelperCard,
  MediaBlockInspector,
  OtherEmbedInspector,
  RichTextBlockInspector,
  SplitContentInspector,
  StoryBlockDesignInspector,
  StoryBlockRowLayoutInspector,
  TableBlockInspector,
  type TableLayoutPatch,
} from "@/components/admin/story-creator/StoryCreatorInspector";

export function StoryBlockInspector({
  storyId,
  selectedBlock,
  selectedSection,
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
  onPatchSection,
  onPatchRichTextMeta,
  onPatchDividerMeta,
  onDeleteBlock,
  onPatchSplitContent,
  onPatchTable,
  selectedBlockInSplitPanel = false,
  touchComfort,
}: {
  storyId: string;
  selectedBlock: StoryBlock | null;
  selectedSection: StorySection | null;
  columnsLayoutBlock: StoryColumnsBlock | null;
  columnsNestingDepth: number;
  onPatchColumns?: (patch: Partial<Pick<StoryColumnsBlock, "columnWidthPercents" | "columnGapRem">>) => void;
  onPatchColumnSlot?: (columnIndex: 0 | 1, patch: Partial<Pick<StoryColumnSlot, "stackJustify" | "stackGapRem">>) => void;
  onPatchEmbed: (patch: Partial<StoryEmbedBlock>) => void;
  onPatchMedia: (patch: Partial<StoryMediaBlock>) => void;
  onPatchContainer?: (patch: Partial<StoryContainerBlockProps>) => void;
  onPatchBlockRowLayout: (patch: Partial<StoryBlockRowLayout>) => void;
  onPatchBlockDesign: (patch: Partial<StoryBlockDesign> | null) => void;
  onPatchBlockDateAnnotation?: (next: { dateAnnotations?: StoryBlockDateAnnotation[]; placeAnnotations?: StoryBlockPlaceAnnotation[] }) => void;
  onPatchSection?: (sectionId: string, patch: Partial<StorySection>) => void;
  onPatchRichTextMeta?: (patch: StoryRichTextMetaPatch) => void;
  onPatchDividerMeta?: (patch: StoryDividerMetaPatch) => void;
  onDeleteBlock?: () => void;
  onPatchSplitContent?: (patch: { supportingWidthPct?: number; supportingGapRem?: number; supportingSide?: "left" | "right"; supportingFloatPosition?: "top" | "center" | "bottom" }) => void;
  onPatchTable?: (patch: TableLayoutPatch) => void;
  selectedBlockInSplitPanel?: boolean;
  touchComfort?: boolean;
}) {
  return (
    <>
      {selectedSection && onPatchSection ? (
        <CollapsibleFormSection title="Section" defaultOpen>
          <div>
            <FieldLabel>Title</FieldLabel>
            <Input
              className="input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100"
              value={selectedSection.title}
              onChange={(e) => onPatchSection(selectedSection.id, { title: e.target.value })}
            />
          </div>
          <div className="mt-3">
            <FieldLabel>Subtitle</FieldLabel>
            <Input
              className="input input-bordered input-sm mt-1 w-full rounded-lg border-base-content/12 bg-base-100"
              placeholder="Optional subtitle"
              value={selectedSection.subtitle ?? ""}
              onChange={(e) => onPatchSection(selectedSection.id, { subtitle: e.target.value || undefined })}
            />
          </div>
        </CollapsibleFormSection>
      ) : null}
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
          hideLayoutSection={selectedBlockInSplitPanel}
          touchComfort={touchComfort}
        />
      ) : selectedBlock?.type === "embed" ? (
        <OtherEmbedInspector block={selectedBlock} onPatch={onPatchEmbed} hideLayoutSection={selectedBlockInSplitPanel} touchComfort={touchComfort} />
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
                editor styling-structural TipTap commands stay in the canvas, not here.
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
      ) : selectedBlock?.type === "table" && onPatchTable ? (
        <TableBlockInspector block={selectedBlock} onPatch={onPatchTable} touchComfort={touchComfort} />
      ) : selectedBlock?.type === "table" ? (
        <HelperCard title="Table">Select this block on the canvas to adjust headers and sizing.</HelperCard>
      ) : selectedBlock?.type === "splitContent" && onPatchSplitContent ? (
        <SplitContentInspector block={selectedBlock} onPatch={onPatchSplitContent} touchComfort={touchComfort} />
      ) : selectedBlock?.type === "splitContent" ? (
        <HelperCard title="Split content">
          Select side, width, and gap in the inspector above to adjust the supporting panel layout.
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
            dateAnnotations={selectedBlock.dateAnnotations}
            legacyDateAnnotation={selectedBlock.dateAnnotation}
            placeAnnotations={selectedBlock.placeAnnotations}
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

