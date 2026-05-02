"use client";

import { Columns2, ImageIcon, Layers, LayoutTemplate, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StoryColumnNestedInsertKind } from "@/lib/admin/story-creator/story-block-factory";

export function StoryColumnInsertAffordance({
  mobile,
  allowNestedColumns,
  onInsert,
}: {
  mobile?: boolean;
  /** When false, Columns is disabled with helper copy (max nesting depth). */
  allowNestedColumns: boolean;
  onInsert: (kind: StoryColumnNestedInsertKind) => void;
}) {
  return (
    <div className={cn("group relative flex items-center justify-center", mobile ? "py-2.5" : "h-6 py-0.5")}>
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-base-content/[0.12] opacity-80 transition-opacity group-hover:opacity-100" />
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full border border-base-content/12 bg-base-100/95 text-primary shadow-md transition-[opacity,transform,box-shadow]",
            mobile
              ? "size-10 min-h-[40px] min-w-[40px] opacity-100 hover:scale-[1.02] active:scale-[0.98]"
              : "size-7 opacity-40 hover:scale-105 hover:opacity-100 group-hover:opacity-75",
          )}
          aria-label="Insert block in column"
        >
          <Plus className={cn(mobile ? "size-4" : "size-3.5")} strokeWidth={2.25} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[10rem]">
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
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("container")}>
            <LayoutTemplate className="size-3.5 opacity-80" aria-hidden />
            Container
          </DropdownMenuItem>
          {allowNestedColumns ? (
            <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("columns")}>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
