import type { CSSProperties } from "react";
import type { StoryColumnSlot, StoryColumnStackJustify, StoryColumnsBlock } from "@/lib/admin/story-creator/story-types";

/** Equal split — default for new blocks. */
export const DEFAULT_COLUMN_WIDTH_PERCENTS: [number, number] = [50, 50];

/** Default gutter between columns (`rem`, stable across zoom). */
export const DEFAULT_COLUMN_GAP_REM = 1;

export const STORY_COLUMNS_GAP_PRESETS = [
  { gapRem: 0, label: "None" },
  { gapRem: 0.5, label: "Tight" },
  { gapRem: 1, label: "Default" },
  { gapRem: 1.5, label: "Comfortable" },
  { gapRem: 2.5, label: "Spacious" },
] as const;

/** Width presets as column 1 % (column 2 is remainder). One-click sensible layouts. */
export const DEFAULT_COLUMN_STACK_JUSTIFY: StoryColumnStackJustify = "flex-start";

export const DEFAULT_COLUMN_STACK_GAP_REM = 0.75;

export const STORY_COLUMN_STACK_JUSTIFY_PRESETS: {
  label: string;
  value: StoryColumnStackJustify;
  hint?: string;
}[] = [
  { label: "Top", value: "flex-start" },
  { label: "Middle", value: "center", hint: "Group centered vertically" },
  { label: "Bottom", value: "flex-end" },
  { label: "Space between", value: "space-between", hint: "First at top, last at bottom" },
  { label: "Space around", value: "space-around" },
  { label: "Space evenly", value: "space-evenly" },
];

export const STORY_COLUMN_STACK_GAP_PRESETS = [
  { gapRem: 0, label: "None" },
  { gapRem: 0.5, label: "Tight" },
  { gapRem: 0.75, label: "Default" },
  { gapRem: 1.25, label: "Comfortable" },
  { gapRem: 2, label: "Spacious" },
] as const;

const VALID_JUSTIFY = new Set<string>(STORY_COLUMN_STACK_JUSTIFY_PRESETS.map((p) => p.value));

export const STORY_COLUMNS_WIDTH_PRESETS: { label: string; percents: [number, number] }[] = [
  { label: "50 · 50", percents: [50, 50] },
  { label: "60 · 40", percents: [60, 40] },
  { label: "40 · 60", percents: [40, 60] },
  { label: "67 · 33", percents: [67, 33] },
  { label: "33 · 67", percents: [33, 67] },
  { label: "75 · 25", percents: [75, 25] },
  { label: "25 · 75", percents: [25, 75] },
];

function isValidPercentPair(p: unknown): p is [number, number] {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] > 0 &&
    p[1] > 0
  );
}

/** Normalize to whole-number percents that sum to 100. */
export function normalizeColumnWidthPercents(p: [number, number]): [number, number] {
  if (!isValidPercentPair(p)) return [...DEFAULT_COLUMN_WIDTH_PERCENTS];
  const sum = p[0] + p[1];
  if (sum <= 0) return [...DEFAULT_COLUMN_WIDTH_PERCENTS];
  const a = Math.round((100 * p[0]) / sum);
  const b = 100 - a;
  if (a < 5 || b < 5) return [...DEFAULT_COLUMN_WIDTH_PERCENTS];
  return [a, b];
}

export function resolveColumnWidthPercents(block: StoryColumnsBlock): [number, number] {
  return normalizeColumnWidthPercents(block.columnWidthPercents ?? DEFAULT_COLUMN_WIDTH_PERCENTS);
}

export function resolveColumnGapRem(block: StoryColumnsBlock): number {
  const g = block.columnGapRem;
  if (typeof g !== "number" || !Number.isFinite(g) || g < 0) return DEFAULT_COLUMN_GAP_REM;
  return Math.min(6, g);
}

/**
 * Renders as CSS Grid: percent intent becomes `fr` tracks (minmax(0, Nfr)) so gap does not skew ratios.
 * @param layout `two-column` side-by-side; `stacked` single column (narrow viewports).
 */
export function resolveColumnStackJustify(slot: StoryColumnSlot): StoryColumnStackJustify {
  const j = slot.stackJustify;
  if (typeof j === "string" && VALID_JUSTIFY.has(j)) return j as StoryColumnStackJustify;
  return DEFAULT_COLUMN_STACK_JUSTIFY;
}

export function resolveColumnStackGapRem(slot: StoryColumnSlot): number {
  const g = slot.stackGapRem;
  if (typeof g !== "number" || !Number.isFinite(g) || g < 0) return DEFAULT_COLUMN_STACK_GAP_REM;
  return Math.min(4, g);
}

/** Vertical stack inside one column (blocks laid out in document order). */
export function storyColumnStackStyle(slot: StoryColumnSlot): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: resolveColumnStackJustify(slot),
    alignItems: "stretch",
    gap: `${resolveColumnStackGapRem(slot)}rem`,
    minWidth: 0,
    minHeight: 0,
  };
}

/** Persist explicit stack layout (fills in defaults when fields were omitted). */
export function withColumnSlotDefaults(slot: StoryColumnSlot): StoryColumnSlot {
  const blocks = Array.isArray(slot.blocks) ? slot.blocks : [];
  const slotNorm: StoryColumnSlot = { id: slot.id, blocks, stackJustify: slot.stackJustify, stackGapRem: slot.stackGapRem };
  return {
    ...slotNorm,
    stackJustify: resolveColumnStackJustify(slotNorm),
    stackGapRem: resolveColumnStackGapRem(slotNorm),
  };
}

export function storyColumnsGridStyle(block: StoryColumnsBlock, layout: "two-column" | "stacked"): CSSProperties {
  const [w0, w1] = resolveColumnWidthPercents(block);
  const gapRem = resolveColumnGapRem(block);
  const base: CSSProperties = {
    display: "grid",
    gap: `${gapRem}rem`,
    minWidth: 0,
  };
  if (layout === "stacked") {
    return { ...base, gridTemplateColumns: "minmax(0, 1fr)" };
  }
  return {
    ...base,
    gridTemplateColumns: `minmax(0, ${w0}fr) minmax(0, ${w1}fr)`,
  };
}
