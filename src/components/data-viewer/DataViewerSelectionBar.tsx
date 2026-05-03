"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataViewerActions } from "./types";

type DataViewerSelectionBarProps<TRecord> = {
  selectedCount: number;
  /** Row ids on the current page (table or card grid). */
  pageRowIds: string[];
  selectedIds: Set<string>;
  actions: DataViewerActions<TRecord>;
  onClear: () => void;
  onToggleSelectPage: () => void;
  /** Opens the DataViewer bulk-delete confirmation (when configured). */
  onBulkDelete?: () => void;
  className?: string;
};

export function DataViewerSelectionBar<TRecord>({
  selectedCount,
  pageRowIds,
  selectedIds,
  actions,
  onClear,
  onToggleSelectPage,
  onBulkDelete,
  className,
}: DataViewerSelectionBarProps<TRecord>) {
  if (selectedCount <= 0) return null;

  const allOnPageSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-box border border-base-content/[0.08] bg-base-100/95 px-3 py-2.5 shadow-md shadow-black/10 backdrop-blur-md sm:gap-3 sm:px-4",
        className,
      )}
    >
      <span className="text-sm font-semibold text-base-content">
        {selectedCount} selected
      </span>
      {pageRowIds.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-base-content/15 text-xs"
          onClick={onToggleSelectPage}
        >
          {allOnPageSelected ? "Deselect page" : "Select page"}
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions.bulkEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-primary text-primary-content hover:bg-primary/90"
            onClick={() => actions.bulkEdit!.handler(Array.from(selectedIds))}
          >
            <Pencil className="size-3.5" aria-hidden />
            {actions.bulkEdit.label}
          </Button>
        ) : null}
        {onBulkDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-destructive/35 text-destructive hover:bg-destructive/10"
            onClick={onBulkDelete}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Delete selected
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-base-content hover:underline"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
