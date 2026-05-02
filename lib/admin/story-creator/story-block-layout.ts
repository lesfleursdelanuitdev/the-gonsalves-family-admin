import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type {
  StoryBlock,
  StoryBlockRowLayout,
  StoryColumnNestedBlock,
  StoryContainerBlockProps,
  StoryEmbedBlock,
  StoryMediaBlock,
  StoryRichTextBlock,
} from "@/lib/admin/story-creator/story-types";

/** Row layout for editor/preview wrapping (null = full-width block types without row layout). */
export function effectiveBlockRowLayout(block: StoryBlock): StoryBlockRowLayout | null {
  if (block.type === "richText") return effectiveRowLayoutForRichText(block.rowLayout);
  if (block.type === "media" || block.type === "embed") return effectiveRowLayout(block.rowLayout);
  if (block.type === "container") return effectiveContainerRowLayout(block.props);
  return null;
}

export function storyBlockRowWrapClassAndStyle(
  block: StoryBlock,
  opts: { floated: boolean; referencePreviewMobile?: boolean },
): { className: string; style: CSSProperties } {
  const row = effectiveBlockRowLayout(block);
  if (!row) return { className: "w-full min-w-0", style: {} };
  return {
    className: cn("min-w-0", storyRowOuterClassName(row, opts)),
    style: storyRowOuterStyle(row, opts),
  };
}

export const STORY_WIDTH_MODE_PERCENT: Record<"full" | "wide" | "medium" | "narrow", number> = {
  full: 100,
  wide: 80,
  medium: 65,
  narrow: 45,
};

export function mergeStoryRowLayout(
  existing: StoryBlockRowLayout | undefined,
  patch: Partial<StoryBlockRowLayout>,
): StoryBlockRowLayout {
  return { ...existing, ...patch };
}

/** Effective row layout with defaults (no mutation). */
export function effectiveRowLayout(row?: StoryBlockRowLayout): StoryBlockRowLayout {
  return {
    widthMode: row?.widthMode ?? "full",
    widthValue: row?.widthValue,
    widthUnit: row?.widthUnit ?? "%",
    alignment: row?.alignment ?? "center",
    displayMode: row?.displayMode ?? "block",
    float: row?.float,
  };
}

/** Rich text is always its own row in the editor (ignore any legacy float flags). */
export function effectiveRowLayoutForRichText(row?: StoryBlockRowLayout): StoryBlockRowLayout {
  const r = effectiveRowLayout(row);
  return { ...r, displayMode: "block", float: undefined };
}

export function resolveRowLayoutWidthCss(row: StoryBlockRowLayout): { width: string; maxWidth?: string } {
  const mode = row.widthMode ?? "full";
  if (mode === "full") return { width: "100%" };
  if (mode === "custom" && row.widthValue != null && Number.isFinite(row.widthValue)) {
    const u = row.widthUnit ?? "%";
    return { width: `${row.widthValue}${u}`, maxWidth: "100%" };
  }
  if (mode === "custom") return { width: "100%" };
  const pct = STORY_WIDTH_MODE_PERCENT[mode];
  return { width: `${pct}%`, maxWidth: "100%" };
}

/** Outer wrapper classes: alignment (non-float), mobile reset, optional float. */
export function storyRowOuterClassName(row: StoryBlockRowLayout, opts: { floated: boolean; referencePreviewMobile?: boolean }): string {
  const align = row.alignment ?? "center";
  const mx =
    align === "center"
      ? "mx-auto"
      : align === "right"
        ? opts.referencePreviewMobile
          ? "ml-auto mr-0 mx-0"
          : "ml-auto mr-0 max-md:mx-0"
        : opts.referencePreviewMobile
          ? "mr-auto ml-0 mx-0"
          : "mr-auto ml-0 max-md:mx-0";
  const mobile = opts.referencePreviewMobile
    ? "float-none !w-full max-w-full mx-0"
    : "max-md:float-none max-md:!w-full max-md:mx-0";
  if (opts.floated && row.displayMode === "float") {
    const f = opts.referencePreviewMobile ? "block w-full" : row.float === "right" ? "float-right" : "float-left";
    const gutter = opts.referencePreviewMobile ? "mb-3" : row.float === "right" ? "ml-4 mb-3" : "mr-4 mb-3";
    return [mobile, f, gutter, opts.referencePreviewMobile ? "" : "shrink-0"].filter(Boolean).join(" ");
  }
  return [mobile, mx].join(" ");
}

export function storyRowOuterStyle(row: StoryBlockRowLayout, opts: { floated: boolean; referencePreviewMobile?: boolean }): CSSProperties {
  if (opts.referencePreviewMobile) {
    return { width: "100%", maxWidth: "100%" };
  }
  const { width, maxWidth } = resolveRowLayoutWidthCss(row);
  const base: CSSProperties = { width, maxWidth };
  if (opts.floated && row.displayMode === "float") {
    return base;
  }
  return base;
}

/** Text alignment for title/caption inside media and embed blocks (matches row alignment). */
export function storyRowInnerTextAlignClass(row?: StoryBlockRowLayout): string {
  const align = effectiveRowLayout(row).alignment ?? "center";
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}

export function isFloatMediaOrEmbed(block: StoryBlock): block is StoryMediaBlock | StoryEmbedBlock {
  return (
    (block.type === "media" || block.type === "embed") &&
    effectiveRowLayout(block.rowLayout).displayMode === "float"
  );
}

export function isFloatNestedMediaOrEmbed(block: StoryColumnNestedBlock): block is StoryMediaBlock | StoryEmbedBlock {
  return (
    (block.type === "media" || block.type === "embed") &&
    effectiveRowLayout(block.rowLayout).displayMode === "float"
  );
}

export type StoryBlockLayoutGroup =
  | { kind: "single"; block: StoryBlock; startIndex: number }
  | { kind: "float-wrap"; float: StoryMediaBlock | StoryEmbedBlock; text: StoryRichTextBlock; startIndex: number };

export function groupStoryBlocksForLayout(blocks: readonly StoryBlock[]): StoryBlockLayoutGroup[] {
  const out: StoryBlockLayoutGroup[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    const next = blocks[i + 1];
    if (isFloatMediaOrEmbed(b) && next?.type === "richText") {
      out.push({ kind: "float-wrap", float: b, text: next, startIndex: i });
      i += 2;
    } else {
      out.push({ kind: "single", block: b, startIndex: i });
      i += 1;
    }
  }
  return out;
}

export type StoryColumnLayoutGroup =
  | { kind: "single"; block: StoryColumnNestedBlock; startIndex: number }
  | { kind: "float-wrap"; float: StoryMediaBlock | StoryEmbedBlock; text: StoryRichTextBlock; startIndex: number };

export function groupColumnNestedBlocksForLayout(blocks: readonly StoryColumnNestedBlock[]): StoryColumnLayoutGroup[] {
  const out: StoryColumnLayoutGroup[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    const next = blocks[i + 1];
    if (isFloatNestedMediaOrEmbed(b) && next?.type === "richText") {
      out.push({ kind: "float-wrap", float: b, text: next, startIndex: i });
      i += 2;
    } else {
      out.push({ kind: "single", block: b, startIndex: i });
      i += 1;
    }
  }
  return out;
}

/** Container shell: combine new rowLayout with legacy width/align when rowLayout is sparse. */
export function effectiveContainerRowLayout(props: StoryContainerBlockProps): StoryBlockRowLayout {
  if (props.rowLayout && Object.keys(props.rowLayout).length > 0) {
    const rl = effectiveRowLayout(props.rowLayout);
    if (props.rowLayout.widthMode == null && props.width === "constrained") {
      return { ...rl, widthMode: "medium", alignment: props.align ?? rl.alignment };
    }
    if (props.rowLayout.widthMode == null && props.width === "full") {
      return { ...rl, widthMode: "full", alignment: props.align ?? rl.alignment };
    }
    return rl;
  }
  if (props.width === "constrained") {
    return effectiveRowLayout({
      widthMode: "medium",
      alignment: props.align ?? "left",
      displayMode: "block",
    });
  }
  return effectiveRowLayout({
    widthMode: "full",
    alignment: props.align ?? "left",
    displayMode: "block",
  });
}
