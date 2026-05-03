"use client";

import { Columns2, ChevronDown, ImageIcon, Layers, LayoutTemplate, Minus, Type } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StoryAddBlockPresetId } from "@/lib/admin/story-creator/story-block-presets";

export type StoryEmptySlotAddBlockSurface = "paper" | "sheet";

export type StoryEmptySlotAddBlockDensity = "comfortable" | "compact";

/**
 * “Add block” dropdown for empty column slots, empty nested containers, and empty section-level containers.
 * Callers supply `onInsert` (e.g. append with {@link createStoryBlockFromPreset} or column nested factory).
 */
export function StoryEmptySlotAddBlockMenu({
  mobile,
  allowNestedColumns,
  onInsert,
  includeDivider = false,
  surface = "paper",
  density = "comfortable",
  className,
}: {
  mobile?: boolean;
  /** When false, Columns is disabled with helper copy (max nesting depth). */
  allowNestedColumns: boolean;
  onInsert: (presetId: StoryAddBlockPresetId) => void;
  /** When true, appends a menu separator and Divider preset (section-level containers). */
  includeDivider?: boolean;
  /** `paper`: neutral control on light column cells; `sheet`: outline tuned for document canvas. */
  surface?: StoryEmptySlotAddBlockSurface;
  /** Vertical padding around the centered trigger. */
  density?: StoryEmptySlotAddBlockDensity;
  className?: string;
}) {
  const wrapPad =
    density === "compact"
      ? mobile
        ? "py-3"
        : "py-2"
      : mobile
        ? "py-4"
        : "py-3";

  /* On-canvas only: neutral ink — admin `base-content` is for dark chrome and reads as faint grey on white. */
  const triggerSurface = cn(
    "gap-2 border-neutral-400 bg-white font-semibold text-neutral-900 shadow-sm ring-1 hover:border-neutral-500 hover:bg-neutral-50",
    surface === "sheet" ? "ring-black/[0.08]" : "ring-black/[0.05]",
  );

  return (
    <div className={cn("flex justify-center", wrapPad, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            triggerSurface,
            mobile ? "min-h-11 rounded-xl px-4 text-sm" : "rounded-lg",
          )}
          aria-label="Add block"
        >
          Add block
          <ChevronDown className="size-3.5 shrink-0 text-neutral-600" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[11rem]">
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("text_paragraph")}>
            <Type className="size-3.5 opacity-80" aria-hidden />
            Text
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("media_default")}>
            <ImageIcon className="size-3.5 opacity-80" aria-hidden />
            Media
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("embed_document")}>
            <Layers className="size-3.5 opacity-80" aria-hidden />
            Embed
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("layout_container")}>
            <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
            Container
          </DropdownMenuItem>
          {allowNestedColumns ? (
            <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("layout_columns")}>
              <Columns2 className="size-3.5 opacity-80" aria-hidden />
              Columns
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="flex cursor-not-allowed flex-col items-start gap-0.5 py-2.5 opacity-60">
              <span className="inline-flex items-center gap-2 font-medium">
                <Columns2 className="size-3.5 opacity-80" aria-hidden />
                Columns
              </span>
              <span className="pl-6 text-[11px] font-normal leading-snug text-base-content/50">
                Nested columns are limited to 2 levels.
              </span>
            </DropdownMenuItem>
          )}
          {includeDivider ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("layout_divider")}>
                <Minus className="size-3.5 opacity-80" aria-hidden />
                Divider
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
