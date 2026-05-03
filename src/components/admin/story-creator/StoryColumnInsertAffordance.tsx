"use client";

import { Columns2, ChevronDown, ImageIcon, Layers, LayoutTemplate, Type } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StoryColumnNestedInsertKind } from "@/lib/admin/story-creator/story-block-factory";

/** Centered “Add block” menu for empty column slots and empty nested containers (no dashed + row). */
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
    <div className={cn("flex justify-center", mobile ? "py-4" : "py-3")}>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2 border-base-content/15 font-medium text-base-content/80 shadow-sm",
            mobile ? "min-h-11 rounded-xl px-4 text-sm" : "rounded-lg",
          )}
          aria-label="Add block"
        >
          Add block
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[10rem]">
          <DropdownMenuItem className="gap-2 font-medium" onClick={() => onInsert("richText")}>
            <Type className="size-3.5 opacity-80" aria-hidden />
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
